package app.tamescroll.client

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import android.util.Log
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebMessagePortCompat
import org.json.JSONArray
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

/**
 * The native tensor runner behind the page's `native-client.mjs`.
 *
 * ONE engine per process, ONE port per page. The three interpreters are
 * loaded once and kept: on the Redmi the GPU delegate spends 1.4-3.9s
 * per model compiling shaders (spikes/native/GPU-REPORT.md), so loading
 * per page load would put ~8s of compile in front of every YouTube open.
 * A page binds its own WebMessagePort (`bind`); a later page's bind
 * closes the previous port and the models simply carry over.
 *
 * All policy stays in the page. This class knows how to turn RGBA bytes
 * into each model's input tensor and how to ship the raw output tensors
 * back -- nothing about faces, persons or verdicts.
 *
 * Protocol (little-endian). Request: `[u32 reqId, u32 modelId, u32 w,
 * u32 h]` then RGBA `w*h*4`. Reply: `[u32 reqId, u32 status (0 ok /
 * 1 error), u32 nOutputs, u32 elapsedUs]` then per output
 * `[u32 byteLength]` + float32 data, in `getOutputTensor(i)` order.
 * Before any request the port carries a string: `native-ready` (with
 * backend + each model's output tensor names) or `native-failed`.
 *
 * Threading: everything runs on the `ts-infer` HandlerThread -- the
 * port callback is bound to it via the Handler overload of
 * setWebMessageCallback, and WebMessagePortCompat is @AnyThread (checked
 * in androidx.webkit 1.14.0), so replies are posted from there directly.
 */
class NativeInfer(private val ctx: Context) {
  companion object {
    private const val TAG = "TsNative"
    private const val MAX_CONSECUTIVE_ERRORS = 3
    private val MODEL_ASSET = mapOf(1 to "blazeface", 2 to "faceres", 3 to "movenet-multipose")
    private val MODEL_REPORT_NAME = mapOf(1 to "blazeface", 2 to "faceres", 3 to "movenet")
    // Per-model delegate precision. fp16 is BLIND to MoveNet on Adreno 610
    // (engine-findings 25: maxKp 0.03-0.19, admits nobody -- the same
    // defect the WebGL runtime has), so MoveNet computes in fp32. faceres
    // runs at fp16: gender raw |diff| p50 0.0025 max 0.018, descriptor
    // cosine p50 0.9990 min 0.995 against fp32, 220 -> 182ms per read.
    // BlazeFace does NOT (phase-k K1): on the one parity frame where
    // MoveNet admits nobody and a face exists (t=90, conf 0.455), fp16
    // found NO face -- a close-up with no patch. The detector that
    // decides whether anyone is there stays fp32; it is the cheap model.
    private val MODEL_FP16 = setOf(2)
  }

  private class LoadedModel(
    val id: Int,
    val interpreter: Interpreter,
    val delegate: GpuDelegate?,
    val backend: String, // "npu" | "gpu" | "cpu" -- see loadModel's NPU_STUB note
    val inputW: Int,
    val inputH: Int,
    val inputBuffer: ByteBuffer,
    val outputBuffers: Array<ByteBuffer>,
    val outputNames: List<String>,
  ) {
    var consecutiveErrors = 0
  }

  private val thread = HandlerThread("ts-infer").also { it.start() }
  private val handler = Handler(thread.looper)
  private val models = HashMap<Int, LoadedModel>()
  private var loadState = 0 // 0 loading, 1 ready, 2 failed
  private var loadWhy = ""
  private var initMs = 0
  private var port: WebMessagePortCompat? = null
  // NATIVE_CPU_MASK / NATIVE_NPU (native-client.mjs `configure`): bit i
  // of cpuMask forces model (i+1) onto XNNPACK CPU regardless of GPU
  // availability; flags bit 0 says whether the page allows an NPU
  // delegate. Defaults match the page's own defaults (mask 0 = every
  // model tries its normal delegate order; flags 1 = NPU allowed) so a
  // page that never sends a CONFIG behaves exactly as before.
  private var cpuMask = 0
  private var flags = 1
  // The `ts-infer` thread's Linux tid, captured from inside the thread
  // itself (Process.myTid() is only meaningful called from the thread
  // it is asking about) -- MainActivity's PerfBridge needs it for
  // Process.setThreadPriority and a PerformanceHintManager session.
  @Volatile var inferTid: Int = -1
    private set
  // Set by PerfBridge.hint(true); called with the elapsed nanos of every
  // successful model inference (never CONFIG) so an ADPF hint session
  // can report actual work duration. Cleared by hint(false)/close().
  @Volatile var onInferenceDuration: ((Long) -> Unit)? = null
  // A page that produced three consecutive inference errors on one model
  // is told `native-failed` once and served status 1 from then on; the
  // NEXT page gets a fresh chance, because the failure may have been its
  // own (a bad crop size) rather than the engine's.
  private var deadForThisPage = false
  @Volatile private var closed = false

  init {
    handler.post {
      inferTid = Process.myTid()
      loadAll()
    }
  }

  /** Hand this page's end of the channel to the engine. Called on the
   * UI thread from onPageStarted; the previous page's port is closed. */
  private var bindGen = 0
  private var warnedType = false

  fun bind(newPort: WebMessagePortCompat) {
    handler.post {
      if (closed) { try { newPort.close() } catch (_: Throwable) {}; return@post }
      try { port?.close() } catch (_: Throwable) {}
      port = newPort
      deadForThisPage = false
      for (m in models.values) m.consecutiveErrors = 0
      // A message from a port this bind has since replaced must not be
      // answered on the new one. The port handed to onMessage is NOT the
      // object bind() was given -- androidx wraps the framework port in a
      // fresh WebMessagePortCompat per message -- so identity on it is
      // always false (measured 2026-09-02: every frame dropped, no log,
      // the page timed out into `native dead`). A generation counter is
      // the comparison that works.
      val gen = ++bindGen
      newPort.setWebMessageCallback(handler, object : WebMessagePortCompat.WebMessageCallbackCompat() {
        override fun onMessage(p: WebMessagePortCompat, message: WebMessageCompat?) {
          if (gen == bindGen) handleMessage(message)
        }
      })
      Log.i(TAG, "bound gen=$gen loadState=$loadState")
      when (loadState) {
        1 -> postReady()
        2 -> postFailed(loadWhy)
        // 0: loadAll posts to whatever port is bound when it finishes.
      }
    }
  }

  private fun loadAll() {
    val t0 = SystemClock.elapsedRealtimeNanos()
    try {
      for ((id, asset) in MODEL_ASSET) models[id] = loadModel(id, asset)
      initMs = ((SystemClock.elapsedRealtimeNanos() - t0) / 1e6).toInt()
      loadState = 1
      if (port != null) postReady()
    } catch (e: Throwable) {
      Log.w(TAG, "model load failed: " + e.message)
      loadState = 2
      loadWhy = e.message ?: e.toString()
      releaseModels()
      if (port != null) postFailed(loadWhy)
    }
  }

  /** Per-model bit in NATIVE_CPU_MASK (native-client.mjs `configure`):
   * bit0 BlazeFace (id1), bit1 faceres (id2), bit2 MoveNet (id3). */
  private fun forceCpuFor(id: Int): Boolean = (cpuMask shr (id - 1)) and 1 == 1

  /** flags bit0 = NATIVE_NPU. Read only for postReady's `npu` field --
   * see the NPU_STUB note below for why nothing here ever acts on it. */
  private fun npuAllowedByFlags(): Boolean = flags and 1 == 1

  private fun loadModel(id: Int, assetBase: String): LoadedModel {
    val bytes = loadAssetModel("$assetBase.tflite")
    var delegate: GpuDelegate? = null
    var interp: Interpreter? = null
    var backend = "cpu"
    if (!forceCpuFor(id)) {
      // NPU_STUB (performance batch 2026-09-03, plan Task 2): the
      // Qualcomm QNN LiteRT delegate is deliberately NOT wired in. Its
      // Maven artifact (com.qualcomm.qti:qnn-litert-delegate) ships
      // under the "Qualcomm AI Hub Model License", whose Section 2.c
      // forbids using the Software for "biometric and biometrics-based
      // systems, including categorization of persons based on sensitive
      // characteristics" -- and gender/age classification on detected
      // faces is this whole engine's job, not an edge case of it. See
      // NOTICE. So `npuAllowedByFlags()` has nothing to try here; it
      // only decides what postReady's `npu` field reports (absent vs
      // disabled). GPU is attempted next exactly as it was before this
      // task -- a device with no NPU story at all sees no behavior
      // change.
      val cl = CompatibilityList()
      if (cl.isDelegateSupportedOnThisDevice) {
        try {
          val dopts = cl.bestOptionsForThisDevice
          // Allowing precision loss computes in f16 on the Adreno 610.
          // MoveNet cannot (see MODEL_FP16); the face models can.
          dopts.setPrecisionLossAllowed(id in MODEL_FP16)
          delegate = GpuDelegate(dopts)
          interp = Interpreter(bytes, Interpreter.Options().addDelegate(delegate))
          backend = "gpu"
        } catch (e: Throwable) {
          try { delegate?.close() } catch (_: Throwable) {}
          delegate = null
          interp = null
          Log.w(TAG, "GPU delegate failed for $assetBase, falling back to CPU: " + e.message)
        }
      }
    }
    if (interp == null) {
      // XNNPACK on 4 threads is still 1.8x the WebGL path on the Redmi.
      // Also where a forced CPU mask bit for this model lands.
      interp = Interpreter(bytes, Interpreter.Options().setNumThreads(4).setUseXNNPACK(true))
      backend = "cpu"
    }
    interp.allocateTensors()
    val inT = interp.getInputTensor(0)
    val shape = inT.shape() // NHWC
    val inputBuffer = ByteBuffer.allocateDirect(inT.numBytes()).order(ByteOrder.nativeOrder())
    val outputBuffers = Array(interp.outputTensorCount) { i ->
      ByteBuffer.allocateDirect(interp.getOutputTensor(i).numBytes()).order(ByteOrder.nativeOrder())
    }
    val outputNames = (0 until interp.outputTensorCount).map { interp.getOutputTensor(it).name() }
    val model = LoadedModel(id, interp, delegate, backend, shape[2], shape[1], inputBuffer, outputBuffers, outputNames)
    // One warm run: the delegate's first invocation carries allocation
    // and clock ramp that must not land on the first real frame.
    run(model)
    return model
  }

  private fun loadAssetModel(name: String): ByteBuffer {
    val fd = ctx.assets.openFd("models/$name")
    fd.createInputStream().channel.use { ch ->
      return ch.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
    }
  }

  private fun run(model: LoadedModel) {
    val outputsMap = HashMap<Int, Any>()
    for (i in model.outputBuffers.indices) {
      model.outputBuffers[i].rewind()
      outputsMap[i] = model.outputBuffers[i]
    }
    model.inputBuffer.rewind()
    model.interpreter.runForMultipleInputsOutputs(arrayOf(model.inputBuffer), outputsMap)
  }

  private fun handleMessage(message: WebMessageCompat?) {
    if (closed || message == null) return
    if (message.type != WebMessageCompat.TYPE_ARRAY_BUFFER) {
      // The page only ever posts ArrayBuffers on this port; anything else
      // is a protocol drift worth one line, not a silent drop.
      if (!warnedType) { warnedType = true; Log.w(TAG, "unexpected message type " + message.type) }
      return
    }
    val buf = message.arrayBuffer ?: return
    handleFrame(buf)
  }

  private fun handleFrame(buf: ByteArray) {
    if (buf.size < 16) return // no reqId to answer
    val hdr = ByteBuffer.wrap(buf, 0, 16).order(ByteOrder.LITTLE_ENDIAN)
    val reqId = hdr.getInt(0)
    val modelId = hdr.getInt(4)
    val w = hdr.getInt(8)
    val h = hdr.getInt(12)
    if (deadForThisPage || loadState != 1) { replyError(reqId); return }
    // CONFIG (native-client.mjs `configure`): a bare 16-byte header, no
    // pixel payload, modelId 0, `w` = NATIVE_CPU_MASK, `h` = NATIVE_NPU
    // flags. Runs on this same ts-infer thread, so a rebuild can never
    // race a model frame -- the port has exactly one reader.
    if (modelId == 0) { handleConfig(reqId, w, h); return }
    val model = models[modelId] ?: run { replyError(reqId); return }
    // The page sends exactly the model's input size; a mismatch is the
    // page's bug and is answered, never resized here.
    if (w != model.inputW || h != model.inputH || buf.size.toLong() < 16L + w.toLong() * h.toLong() * 4L) {
      replyError(reqId)
      return
    }
    val t0 = SystemClock.elapsedRealtimeNanos()
    try {
      fillInput(model, buf, 16, w * h)
      run(model)
      model.consecutiveErrors = 0
      val elapsedNanos = SystemClock.elapsedRealtimeNanos() - t0
      reply(reqId, 0, model.outputBuffers, (elapsedNanos / 1000L).toInt())
      // ADPF hint feed (PerfBridge.hint): only real inferences count as
      // "work" here, never a CONFIG rebuild.
      try { onInferenceDuration?.invoke(elapsedNanos) } catch (_: Throwable) {}
    } catch (e: Throwable) {
      Log.w(TAG, "native inference failed model=$modelId: " + e.message)
      model.consecutiveErrors++
      replyError(reqId)
      if (model.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && !deadForThisPage) {
        deadForThisPage = true
        postFailed("model $modelId failed $MAX_CONSECUTIVE_ERRORS times in a row: " + (e.message ?: e.toString()))
      }
    }
  }

  /** Rebuilds every named interpreter under the new mask/flags and acks
   * with the ordinary empty-outputs reply (`reply(reqId, 0, emptyArray(),
   * ...)`), never a model's own outputs. A per-model failure leaves that
   * model's PREVIOUS interpreter in place -- models[id] is only
   * overwritten once the replacement has loaded clean -- so one bad
   * rebuild cannot take the whole engine down. */
  private fun handleConfig(reqId: Int, newCpuMask: Int, newFlags: Int) {
    val t0 = SystemClock.elapsedRealtimeNanos()
    cpuMask = newCpuMask
    flags = newFlags
    var failed = false
    for ((id, asset) in MODEL_ASSET) {
      try {
        val old = models[id]
        val fresh = loadModel(id, asset)
        models[id] = fresh
        if (old != null) {
          try { old.interpreter.close() } catch (_: Throwable) {}
          try { old.delegate?.close() } catch (_: Throwable) {}
        }
      } catch (e: Throwable) {
        Log.w(TAG, "CONFIG rebuild failed for model=$id: " + e.message)
        failed = true
      }
    }
    if (failed) { replyError(reqId); return }
    reply(reqId, 0, emptyArray(), ((SystemClock.elapsedRealtimeNanos() - t0) / 1000L).toInt())
  }

  /** RGBA -> the model's input tensor, alpha dropped. The ranges are the
   * ones detector.js feeds the same graphs (spikes/native/REPORT.md):
   * BlazeFace (x/127.5)-1, faceres raw 0..255 as float, MoveNet raw int32. */
  private fun fillInput(model: LoadedModel, src: ByteArray, offset: Int, n: Int) {
    val buf = model.inputBuffer
    buf.rewind()
    var p = offset
    when (model.id) {
      1 -> {
        val fb = buf.asFloatBuffer()
        for (i in 0 until n) {
          fb.put((src[p].toInt() and 0xFF) / 127.5f - 1f)
          fb.put((src[p + 1].toInt() and 0xFF) / 127.5f - 1f)
          fb.put((src[p + 2].toInt() and 0xFF) / 127.5f - 1f)
          p += 4
        }
      }
      2 -> {
        val fb = buf.asFloatBuffer()
        for (i in 0 until n) {
          fb.put((src[p].toInt() and 0xFF).toFloat())
          fb.put((src[p + 1].toInt() and 0xFF).toFloat())
          fb.put((src[p + 2].toInt() and 0xFF).toFloat())
          p += 4
        }
      }
      3 -> {
        val ib = buf.asIntBuffer()
        for (i in 0 until n) {
          ib.put(src[p].toInt() and 0xFF)
          ib.put(src[p + 1].toInt() and 0xFF)
          ib.put(src[p + 2].toInt() and 0xFF)
          p += 4
        }
      }
    }
    buf.rewind()
  }

  private fun replyError(reqId: Int) = reply(reqId, 1, emptyArray(), 0)

  private fun reply(reqId: Int, status: Int, outputs: Array<ByteBuffer>, elapsedUs: Int) {
    val p = port ?: return
    var total = 16
    for (o in outputs) total += 4 + o.capacity()
    // Output buffers are in native order, which is little-endian on every
    // Android ABI we build, so the bytes go across as they are.
    val out = ByteBuffer.allocate(total).order(ByteOrder.LITTLE_ENDIAN)
    out.putInt(reqId).putInt(status).putInt(outputs.size).putInt(elapsedUs)
    for (o in outputs) {
      o.rewind()
      out.putInt(o.capacity())
      out.put(o)
    }
    try {
      p.postMessage(WebMessageCompat(out.array()))
    } catch (e: Throwable) {
      Log.w(TAG, "reply failed: " + e.message)
    }
  }

  private fun postReady() {
    val p = port ?: return
    val modelsJson = JSONArray()
    val backendsJson = JSONObject()
    for ((id, name) in MODEL_REPORT_NAME) {
      val outs = JSONArray()
      models[id]?.outputNames?.forEach { outs.put(it) }
      modelsJson.put(JSONObject().put("id", id).put("name", name).put("outputs", outs))
      backendsJson.put(id.toString(), models[id]?.backend ?: "cpu")
    }
    // Worst of the three, per the plan: 'cpu' if any model landed on
    // CPU, else 'gpu' (an 'npu' backend -- never reached today, see the
    // NPU_STUB note on loadModel -- would count as gpu-or-better here).
    val anyCpu = models.values.any { it.backend == "cpu" }
    val npuState = if (!npuAllowedByFlags()) "disabled" else "absent"
    val msg = JSONObject()
      .put("type", "native-ready")
      .put("backend", if (anyCpu) "cpu" else "gpu")
      .put("backends", backendsJson)
      .put("npu", npuState)
      .put("models", modelsJson)
      .put("initMs", initMs)
    try { p.postMessage(WebMessageCompat(msg.toString())) } catch (e: Throwable) { Log.w(TAG, "ready post failed: " + e.message) }
  }

  private fun postFailed(why: String) {
    val p = port ?: return
    val msg = JSONObject().put("type", "native-failed").put("why", why)
    try { p.postMessage(WebMessageCompat(msg.toString())) } catch (e: Throwable) { Log.w(TAG, "failed post failed: " + e.message) }
  }

  private fun releaseModels() {
    for (m in models.values) {
      try { m.interpreter.close() } catch (_: Throwable) {}
      try { m.delegate?.close() } catch (_: Throwable) {}
    }
    models.clear()
  }

  fun close() {
    if (closed) return
    closed = true
    handler.post {
      releaseModels()
      try { port?.close() } catch (_: Throwable) {}
      port = null
      thread.quitSafely()
    }
  }
}
