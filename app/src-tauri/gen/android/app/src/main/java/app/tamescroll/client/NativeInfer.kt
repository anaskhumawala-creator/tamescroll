package app.tamescroll.client

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
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
    // defect the WebGL runtime has), so MoveNet computes in fp32. BlazeFace
    // and faceres keep their reads at fp16 (parity: face IoU / gender raw /
    // descriptor cosine against the fp32 arm in the plan log) and run
    // 20-25% cheaper there.
    private val MODEL_FP16 = setOf(1, 2)
  }

  private class LoadedModel(
    val id: Int,
    val interpreter: Interpreter,
    val delegate: GpuDelegate?,
    val gpu: Boolean,
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
  // A page that produced three consecutive inference errors on one model
  // is told `native-failed` once and served status 1 from then on; the
  // NEXT page gets a fresh chance, because the failure may have been its
  // own (a bad crop size) rather than the engine's.
  private var deadForThisPage = false
  @Volatile private var closed = false

  init {
    handler.post { loadAll() }
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

  private fun loadModel(id: Int, assetBase: String): LoadedModel {
    val bytes = loadAssetModel("$assetBase.tflite")
    var delegate: GpuDelegate? = null
    var interp: Interpreter? = null
    var gpu = false
    val cl = CompatibilityList()
    if (cl.isDelegateSupportedOnThisDevice) {
      try {
        val dopts = cl.bestOptionsForThisDevice
        // Allowing precision loss computes in f16 on the Adreno 610.
        // MoveNet cannot (see MODEL_FP16); the face models can.
        dopts.setPrecisionLossAllowed(id in MODEL_FP16)
        delegate = GpuDelegate(dopts)
        interp = Interpreter(bytes, Interpreter.Options().addDelegate(delegate))
        gpu = true
      } catch (e: Throwable) {
        try { delegate?.close() } catch (_: Throwable) {}
        delegate = null
        interp = null
        Log.w(TAG, "GPU delegate failed for $assetBase, falling back to CPU: " + e.message)
      }
    }
    if (interp == null) {
      // XNNPACK on 4 threads is still 1.8x the WebGL path on the Redmi.
      interp = Interpreter(bytes, Interpreter.Options().setNumThreads(4).setUseXNNPACK(true))
      gpu = false
    }
    interp.allocateTensors()
    val inT = interp.getInputTensor(0)
    val shape = inT.shape() // NHWC
    val inputBuffer = ByteBuffer.allocateDirect(inT.numBytes()).order(ByteOrder.nativeOrder())
    val outputBuffers = Array(interp.outputTensorCount) { i ->
      ByteBuffer.allocateDirect(interp.getOutputTensor(i).numBytes()).order(ByteOrder.nativeOrder())
    }
    val outputNames = (0 until interp.outputTensorCount).map { interp.getOutputTensor(it).name() }
    val model = LoadedModel(id, interp, delegate, gpu, shape[2], shape[1], inputBuffer, outputBuffers, outputNames)
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
      reply(reqId, 0, model.outputBuffers, ((SystemClock.elapsedRealtimeNanos() - t0) / 1000L).toInt())
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
    for ((id, name) in MODEL_REPORT_NAME) {
      val outs = JSONArray()
      models[id]?.outputNames?.forEach { outs.put(it) }
      modelsJson.put(JSONObject().put("id", id).put("name", name).put("outputs", outs))
    }
    val msg = JSONObject()
      .put("type", "native-ready")
      .put("backend", if (models.values.all { it.gpu }) "gpu" else "cpu")
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
