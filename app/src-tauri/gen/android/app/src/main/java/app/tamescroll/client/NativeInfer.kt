package app.tamescroll.client

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import android.util.Log
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebMessagePortCompat
import org.json.JSONArray
import org.json.JSONObject
import org.tensorflow.lite.Delegate
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import org.tensorflow.lite.nnapi.NnApiDelegate
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
    val delegate: Delegate?,
    val backend: String, // "npu" | "gpu" | "cpu" -- see loadModel's NNAPI note
    val inputW: Int,
    val inputH: Int,
    val inputBuffer: ByteBuffer,
    val outputBuffers: Array<ByteBuffer>,
    val outputNames: List<String>,
  ) {
    var consecutiveErrors = 0
    // True once a page request has filled inputBuffer: the NNAPI
    // arbiter compares on the last REAL frame, never on zeros.
    var realInput = false
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
  // delegate. Defaults: mask 0 = every model on its normal delegate
  // order; flags 0 = NO NPU trial until a page asks (phase-n N1: the
  // arbiter is unpriced on real crops, NATIVE_NPU ships 0). The page
  // sends a CONFIG on every ready, so a mask one document set never
  // leaks into the next (the 1098 smoke's cpumask1 arm did exactly that).
  private var cpuMask = 0
  private var flags = 0
  private val NPU_SNAPSHOT_TRIES = 30
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
      scheduleNpuTrials()
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

  /** flags bit0 = NATIVE_NPU: whether loadModel may try the NNAPI arm. */
  private fun npuAllowedByFlags(): Boolean = flags and 1 == 1

  // NNAPI TRIALS RUN OFF THE INFER THREAD, AFTER READY. The 1098 smoke on
  // the Redmi: arbitrating all three models INSIDE loadAll took 19s (NNAPI
  // compiles MoveNet in ~10s on the Helio G85) against the page's 15s
  // ready timeout, so the client died and that page ran on the WebGL
  // worker for good -- drops 26.5% against 13.2% on 1097. Now loadAll
  // ships GPU/CPU exactly as 1097 and posts ready; each trial builds its
  // NNAPI interpreter AND a shadow copy of the shipping model on
  // `ts-npu-trial`, times and compares them there on the last real frame
  // (phase-n N9: ts-infer does one buffer copy and, on a win, the swap --
  // never a timed run under the page's 4s request timeout). The page
  // hears the outcome as a `native-backends` update. A model that lost
  // stays lost for the process (npuLost): its answer does not change.
  private var trialThread: HandlerThread? = null
  private var trialHandler: Handler? = null
  private var configGen = 0
  private var trialsPending = 0
  private val npuLost = HashSet<Int>()

  /** A model's interpreter plus the buffers `run` needs, tensors allocated. */
  private fun buildModel(id: Int, interp: Interpreter, delegate: Delegate?, backend: String): LoadedModel {
    interp.allocateTensors()
    val inT = interp.getInputTensor(0)
    val shape = inT.shape() // NHWC
    val inputBuffer = ByteBuffer.allocateDirect(inT.numBytes()).order(ByteOrder.nativeOrder())
    val outputBuffers = Array(interp.outputTensorCount) { i ->
      ByteBuffer.allocateDirect(interp.getOutputTensor(i).numBytes()).order(ByteOrder.nativeOrder())
    }
    val outputNames = (0 until interp.outputTensorCount).map { interp.getOutputTensor(it).name() }
    return LoadedModel(id, interp, delegate, backend, shape[2], shape[1], inputBuffer, outputBuffers, outputNames)
  }

  private fun closeModel(m: LoadedModel) {
    try { m.interpreter.close() } catch (_: Throwable) {}
    try { m.delegate?.close() } catch (_: Throwable) {}
  }

  /** Best of `n` runs on whatever the input buffer holds, in ms. The first run
   * is the delegate's warm-up and is excluded: it carries allocation
   * and clock ramp, not the steady cost the arbiter is comparing. */
  private fun bestRunMs(m: LoadedModel, n: Int): Double {
    run(m)
    var best = Double.MAX_VALUE
    repeat(n) {
      val t0 = SystemClock.elapsedRealtimeNanos()
      run(m)
      best = minOf(best, (SystemClock.elapsedRealtimeNanos() - t0) / 1e6)
    }
    return best
  }

  /** EVERY output head of `a` against `b` on the SAME input: false on a
   * non-finite value, a head-count or size mismatch, or a max-abs
   * difference over 2% of that head's own max-abs. Phase-n N1: output 0
   * alone skipped faceres' age head (the child gate) and its descriptor
   * (the identity memory and the nm floor that decides whether a face
   * may mint a patch at all), and 10% was looser than the uint8 requant
   * loop 34 refused on a MEASURED p50 0.023. Catches a delegate that
   * "works" and returns garbage, which is what an accelerator driver
   * mishandling an op looks like from Java. */
  private fun outputsAgree(a: LoadedModel, b: LoadedModel): Boolean {
    if (a.outputBuffers.isEmpty() || a.outputBuffers.size != b.outputBuffers.size) return false
    for (h in a.outputBuffers.indices) {
      val fa = a.outputBuffers[h].duplicate().order(ByteOrder.nativeOrder()).asFloatBuffer()
      val fb = b.outputBuffers[h].duplicate().order(ByteOrder.nativeOrder()).asFloatBuffer()
      if (fa.capacity() != fb.capacity()) return false
      var maxDiff = 0f
      var maxRef = 0f
      for (i in 0 until fa.capacity()) {
        val x = fa.get(i); val y = fb.get(i)
        if (!x.isFinite() || !y.isFinite()) return false
        maxDiff = maxOf(maxDiff, Math.abs(x - y))
        maxRef = maxOf(maxRef, Math.abs(y))
      }
      if (maxDiff > 0.02f * (maxRef + 1e-3f)) return false
    }
    return true
  }

  private fun loadModel(id: Int, assetBase: String): LoadedModel {
    val bytes = loadAssetModel("$assetBase.tflite")
    var delegate: GpuDelegate? = null
    var interp: Interpreter? = null
    var backend = "cpu"
    if (!forceCpuFor(id)) {
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
    val candidate = buildModel(id, interp, delegate, backend)
    // One warm run: the delegate's first invocation carries allocation
    // and clock ramp that must not land on the first real frame.
    run(candidate)
    return candidate
  }

  /** Which models an NNAPI trial may still be worth running for. */
  private fun npuTrialIds(): List<Int> =
    if (!npuAllowedByFlags() || Build.VERSION.SDK_INT < 27) emptyList()
    else MODEL_ASSET.keys.filter { !forceCpuFor(it) && it !in npuLost && models[it]?.backend != "npu" }

  private fun scheduleNpuTrials() {
    val ids = npuTrialIds()
    if (ids.isEmpty()) return
    if (trialHandler == null) {
      val t = HandlerThread("ts-npu-trial", Process.THREAD_PRIORITY_BACKGROUND).also { it.start() }
      trialThread = t
      trialHandler = Handler(t.looper)
    }
    val gen = configGen
    trialsPending += ids.size
    for (id in ids) trialHandler!!.post { npuTrial(id, MODEL_ASSET[id]!!, gen) }
  }

  // NNAPI arm (performance batch 2026-09-03). Android's own Neural
  // Networks API hands the graph to whatever accelerator driver the
  // phone ships -- Qualcomm's Hexagon on the SM4450, MediaTek's APU
  // where there is one -- through code that is Apache-2.0 and already
  // in the TFLite we vendor. Qualcomm's OWN LiteRT delegate is NOT
  // used: its "AI Model Hub License" 2.c forbids biometric systems and
  // categorization of persons by sensitive characteristics, which is
  // this engine (see NOTICE). NNAPI never puts us under that licence:
  // the driver is the phone's, not something we distribute.
  //
  // NNAPI cannot be trusted on its say-so. With useNnapiCpu(false) a
  // device with no accelerator gets a delegate that takes NO nodes and
  // the graph silently runs on CPU kernels -- initialising is not
  // proof of an NPU. So the arm is an ARBITER: NNAPI has to beat a
  // SHADOW copy of the shipping GPU/CPU graph on the clock by 10% AND
  // agree with it on every output head within 2%, on the last REAL
  // frame the shipping model saw (never zeros: a black frame is where
  // the heads sit on their priors and every gate in the page was
  // calibrated where they differ), or it is closed and the candidate
  // stays. `npu: ok` in the report therefore means "measured faster
  // and agreeing", never "present". Three hops: build + warm on
  // ts-npu-trial; copy the live input on ts-infer (cheap); time both
  // and compare on ts-npu-trial; swap or drop on ts-infer. NNAPI is
  // deprecated since Android 15 (still there, no new features); on a
  // phone whose vendor dropped the driver the arm loses the race.
  private fun npuTrial(id: Int, assetBase: String, gen: Int) {
    var nn: LoadedModel? = null
    var nd: NnApiDelegate? = null
    try {
      val bytes = loadAssetModel("$assetBase.tflite")
      val nopts = NnApiDelegate.Options()
        .setUseNnapiCpu(false)
        .setAllowFp16(id in MODEL_FP16)
        .setExecutionPreference(NnApiDelegate.Options.EXECUTION_PREFERENCE_SUSTAINED_SPEED)
      nd = NnApiDelegate(nopts)
      nn = buildModel(id, Interpreter(bytes, Interpreter.Options().addDelegate(nd)), nd, "npu")
      run(nn) // warm: allocation and clock ramp, not the cost the arbiter compares
    } catch (e: Throwable) {
      Log.w(TAG, "NNAPI failed for $assetBase: " + e.message)
      if (nn != null) closeModel(nn) else try { nd?.close() } catch (_: Throwable) {}
      nn = null
    }
    val trial = nn
    if (trial == null) { handler.post { decideNpu(id, assetBase, null, false, gen) }; return }
    handler.post { snapshotInput(id, assetBase, trial, gen, 0) }
  }

  /** On ts-infer: copy the shipping model's LAST REAL INPUT for the
   * arbiter -- one buffer copy, the only work this thread does before
   * the decision. No real frame yet: try again in a second, up to
   * NPU_SNAPSHOT_TRIES, then the arm loses. */
  private fun snapshotInput(id: Int, assetBase: String, nn: LoadedModel, gen: Int, tries: Int) {
    val candidate = models[id]
    if (closed || gen != configGen || candidate == null) {
      decideNpu(id, assetBase, nn, false, gen)
      return
    }
    if (!candidate.realInput) {
      if (tries >= NPU_SNAPSHOT_TRIES) { decideNpu(id, assetBase, nn, false, gen); return }
      handler.postDelayed({ snapshotInput(id, assetBase, nn, gen, tries + 1) }, 1000L)
      return
    }
    val ib = candidate.inputBuffer.duplicate()
    ib.rewind()
    val input = ByteArray(ib.remaining())
    ib.get(input)
    val th = trialHandler
    if (th == null || !th.post { arbitrate(id, assetBase, nn, input, gen) }) decideNpu(id, assetBase, nn, false, gen)
  }

  /** On ts-npu-trial: a SHADOW copy of the shipping candidate (its own
   * interpreter and GPU context, this thread's) against the NNAPI trial
   * on the same real frame. Nothing here touches ts-infer. */
  private fun arbitrate(id: Int, assetBase: String, nn: LoadedModel, input: ByteArray, gen: Int) {
    var win = false
    var shadow: LoadedModel? = null
    try {
      shadow = loadModel(id, assetBase)
      val sb = shadow.inputBuffer; sb.rewind(); sb.put(input)
      val nb = nn.inputBuffer; nb.rewind(); nb.put(input)
      val nnMs = bestRunMs(nn, 3)
      val shadowMs = bestRunMs(shadow, 3)
      val agree = outputsAgree(nn, shadow)
      win = agree && nnMs < shadowMs * 0.9
      Log.i(TAG, "NNAPI arbiter $assetBase: nnapi=${"%.1f".format(nnMs)}ms ${shadow.backend}=${"%.1f".format(shadowMs)}ms agree=$agree -> " + (if (win) "npu" else shadow.backend))
    } catch (e: Throwable) {
      Log.w(TAG, "NNAPI arbitration failed for $assetBase: " + e.message)
      win = false
    }
    if (shadow != null) closeModel(shadow)
    handler.post { decideNpu(id, assetBase, nn, win, gen) }
  }

  /** On ts-infer: swap or drop. The only arbiter work on this thread. */
  private fun decideNpu(id: Int, assetBase: String, nn: LoadedModel?, win: Boolean, gen: Int) {
    if (gen == configGen) trialsPending--
    val candidate = models[id]
    if (closed || gen != configGen || candidate == null || forceCpuFor(id) || !npuAllowedByFlags()) {
      if (nn != null) closeModel(nn)
    } else if (nn == null || !win) {
      if (nn != null) closeModel(nn)
      npuLost.add(id)
    } else {
      nn.realInput = candidate.realInput
      models[id] = nn
      closeModel(candidate)
      Log.i(TAG, "NNAPI arbiter: $assetBase now on npu")
    }
    if (gen == configGen && trialsPending <= 0) {
      trialsPending = 0
      postBackends()
    }
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
    val oldMask = cpuMask
    cpuMask = newCpuMask
    flags = newFlags
    // Trials in flight were priced against the old configuration.
    configGen++
    trialsPending = 0
    var failed = false
    for ((id, asset) in MODEL_ASSET) {
      val old = models[id] ?: continue
      val maskChanged = ((oldMask xor newCpuMask) shr (id - 1)) and 1 == 1
      val leaveNpu = old.backend == "npu" && (!npuAllowedByFlags() || forceCpuFor(id))
      if (!maskChanged && !leaveNpu) continue
      try {
        val fresh = loadModel(id, asset)
        models[id] = fresh
        closeModel(old)
      } catch (e: Throwable) {
        Log.w(TAG, "CONFIG rebuild failed for model=$id: " + e.message)
        failed = true
      }
    }
    if (failed) { replyError(reqId); return }
    reply(reqId, 0, emptyArray(), ((SystemClock.elapsedRealtimeNanos() - t0) / 1000L).toInt())
    scheduleNpuTrials()
  }

  /** RGBA -> the model's input tensor, alpha dropped. The ranges are the
   * ones detector.js feeds the same graphs (spikes/native/REPORT.md):
   * BlazeFace (x/127.5)-1, faceres raw 0..255 as float, MoveNet raw int32. */
  private fun fillInput(model: LoadedModel, src: ByteArray, offset: Int, n: Int) {
    val buf = model.inputBuffer
    model.realInput = true
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

  private fun backendsJson(): JSONObject {
    val j = JSONObject()
    for (id in MODEL_REPORT_NAME.keys) j.put(id.toString(), models[id]?.backend ?: "cpu")
    return j
  }

  // ok = at least one model measured faster on NNAPI (decideNpu's
  // arbiter); pending = trials still running; failed = every eligible
  // model tried and lost; absent = nothing to try (API < 27 or every
  // model forced to CPU); disabled = the page said no.
  private fun npuState(): String = when {
    !npuAllowedByFlags() -> "disabled"
    models.values.any { it.backend == "npu" } -> "ok"
    trialsPending > 0 -> "pending"
    npuLost.isNotEmpty() && npuTrialIds().isEmpty() -> "failed"
    else -> "absent"
  }

  // Worst of the three, per the plan: 'cpu' if any model landed on
  // CPU, else 'gpu' (an 'npu' backend counts as gpu-or-better here).
  private fun worstBackend(): String = if (models.values.any { it.backend == "cpu" }) "cpu" else "gpu"

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
      .put("backend", worstBackend())
      .put("backends", backendsJson())
      .put("npu", npuState())
      .put("models", modelsJson)
      .put("initMs", initMs)
    try { p.postMessage(WebMessageCompat(msg.toString())) } catch (e: Throwable) { Log.w(TAG, "ready post failed: " + e.message) }
  }

  /** After the NPU trials settle: the report fields only. */
  private fun postBackends() {
    val p = port ?: return
    val msg = JSONObject()
      .put("type", "native-backends")
      .put("backend", worstBackend())
      .put("backends", backendsJson())
      .put("npu", npuState())
    try { p.postMessage(WebMessageCompat(msg.toString())) } catch (e: Throwable) { Log.w(TAG, "backends post failed: " + e.message) }
  }

  private fun postFailed(why: String) {
    val p = port ?: return
    val msg = JSONObject().put("type", "native-failed").put("why", why)
    try { p.postMessage(WebMessageCompat(msg.toString())) } catch (e: Throwable) { Log.w(TAG, "failed post failed: " + e.message) }
  }

  private fun releaseModels() {
    for (m in models.values) closeModel(m)
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
      trialThread?.quitSafely()
    }
  }
}
