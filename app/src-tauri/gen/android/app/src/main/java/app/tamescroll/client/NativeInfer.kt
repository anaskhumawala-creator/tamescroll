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
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
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
    // Model 3 is the SPLIT graph (spikes/native/HEADS-REPORT.md):
    // movenet-heads.tflite stops at the six conv heads (101 ops, no
    // TopK/GatherNd/ArgMax -- the GPU delegate takes it whole) and
    // MoveNetHeadsDecoder re-implements the CenterNet decode tail in
    // Kotlin, so the page still gets the full model's [1,6,56]. The
    // report name stays "movenet" so About/native.models.person do not
    // rebase across this swap.
    private val MODEL_ASSET = mapOf(1 to "blazeface", 2 to "faceres", 3 to "movenet-heads")
    private val MODEL_REPORT_NAME = mapOf(1 to "blazeface", 2 to "faceres", 3 to "movenet")
    // PartitionedCall:<slot> -> expected channel count, keyed by the
    // slot each tensor name resolves to (HEADS-REPORT.md section 1):
    // 0 centre[1], 1 kptHeat[17], 2 kptRegress[34], 3 kptOffset[34],
    // 4 boxScale[2], 5 boxOffset[2].
    private val MOVENET_HEAD_CHANNELS = intArrayOf(1, 17, 34, 34, 2, 2)
    private val MOVENET_HEAD_NAME = Regex("^PartitionedCall:([0-5])$")
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

    /** How much faster a trial delegate must be before it is worth
     * swapping a working engine for. */
    private const val TRIAL_WIN_RATIO = 0.9

    /** The arbiter's whole decision, in the companion so it can be
     * tested off a device: a trial wins only by AGREEING with the
     * shipping model on every output head AND beating it by a clear
     * margin. A tie, a hair's-breadth win, or a missing measurement is
     * not worth swapping a working engine for -- which is the same bar
     * `npu: ok` has meant since 1098. */
    @JvmStatic
    fun shouldSwap(agree: Boolean, trialMs: Double, shadowMs: Double): Boolean =
      agree && trialMs > 0 && shadowMs > 0 && trialMs < shadowMs * TRIAL_WIN_RATIO
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
    // Non-null only for id 3 (the movenet-heads split): the pure Kotlin
    // CenterNet decode tail, six FloatBuffer views over outputBuffers in
    // [center, kptHeat, kptRegress, kptOffset, boxScale, boxOffset]
    // order, and the single-tensor reply buffer handleFrame ships
    // instead of outputBuffers. Built once per model load (buildModel)
    // so every copy of model 3 -- the shipping one, an NNAPI trial, an
    // arbiter shadow -- carries its own.
    val decoder: MoveNetHeadsDecoder? = null,
    val decoderHeads: Array<FloatBuffer>? = null,
    val replyBuffer: ByteBuffer? = null,
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
  // GPU_KERNEL_CACHE: logged once, either side, so a device that never
  // gets the cache (dir failure) or falls back (API throw) is visible
  // without spamming per-model.
  private var warnedGpuCache = false

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
      scheduleTrials()
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
  // stays lost for the process (`lost`): its answer does not change.
  private var trialThread: HandlerThread? = null
  private var trialHandler: Handler? = null
  private var configGen = 0
  private var trialsPending = 0
  // Keyed "<kind>:<id>" -- a model that lost a GPU trial and a model
  // that lost an NNAPI trial are different facts about the same id.
  private val lost = HashSet<String>()
  // The NNAPI arm runs only after the GPU arm has settled, so two
  // shadow interpreters never build at once on one device.
  private var npuScheduled = false

  /** What happened to this model's GPU, for the report. Every field is
   * a number, a boolean or an `R` (redacted) string, because
   * `reportViolations` walks the serialized report and rejects anything
   * else. `listed`/`remembered` are what we KNEW before trying;
   * `attempted`/`loadThrewR` are the load; the `trial*` fields are the
   * measurement. All of it exists so one Share from any phone says why
   * that phone is on the backend it is on -- no cable, no logcat. */
  private class GpuNote(
    var listed: Boolean = false,
    var remembered: Boolean = false,
    var attempted: Boolean = false,
    var loadThrewR: String? = null,
    var trialRan: Boolean = false,
    var trialAgree: Boolean = false,
    var trialWon: Boolean = false,
    var trialGpuMs: Double = -1.0,
    var trialCpuMs: Double = -1.0,
    var trialThrewR: String? = null,
  )

  private val gpuNotes = HashMap<Int, GpuNote>()

  /** Identifies THIS model file on THIS build: a remembered GPU win
   * cannot survive a new versionCode or a swapped .tflite. Same shape
   * as the shader cache's token, deliberately. */
  private fun gpuToken(assetBase: String, bytes: ByteBuffer): String =
    "$assetBase-${BuildConfig.VERSION_CODE}-${bytes.remaining()}"

  private fun gpuPrefs() = ctx.getSharedPreferences("ts-native", Context.MODE_PRIVATE)

  // THE UNLISTED PATH NEEDS A DEVICE TO RUN ON. The old Redmi (Mali-G52)
  // IS in TFLite's compatibility database, so on the only phone on a
  // cable here the new trial can never fire -- which would leave the
  // whole point of 1101 shipped unverified. Dropping this file in the
  // app's own external files dir makes any device answer "unlisted" and
  // take the measured path:
  //   adb shell touch /sdcard/Android/data/app.tamescroll.client/files/force-gpu-unlisted
  // Absent (the normal case, and every phone that never had adb on it)
  // it costs one File.exists per model load. Read once per load, never
  // cached, so it can be toggled between launches.
  private fun forceUnlisted(): Boolean =
    try { File(ctx.getExternalFilesDir(null), "force-gpu-unlisted").exists() } catch (_: Throwable) { false }

  private fun gpuRemembered(assetBase: String, bytes: ByteBuffer): Boolean =
    try { gpuPrefs().getBoolean("gpuOk:" + gpuToken(assetBase, bytes), false) } catch (_: Throwable) { false }

  private fun rememberGpu(assetBase: String, bytes: ByteBuffer) {
    try { gpuPrefs().edit().putBoolean("gpuOk:" + gpuToken(assetBase, bytes), true).apply() } catch (_: Throwable) {}
  }

  private fun forgetGpu(assetBase: String, bytes: ByteBuffer) {
    try { gpuPrefs().edit().remove("gpuOk:" + gpuToken(assetBase, bytes)).apply() } catch (_: Throwable) {}
  }

  // A GPU DRIVER CAN TAKE THE PROCESS WITH IT. Constructing a delegate
  // on a device TFLite has never heard of runs vendor code we have not
  // measured; a throw is caught below, but a segfault in the driver is
  // not catchable from Kotlin and would repeat on every launch. So the
  // trial writes a breadcrumb BEFORE it touches the driver and removes
  // it after -- `commit`, not `apply`, because a crash must not lose the
  // write. A breadcrumb still there at the next launch means the last
  // attempt did not come back, and this model never tries again on this
  // build. Worst case is therefore one bad launch, not a crash loop.
  private fun gpuTrialStarted(assetBase: String, bytes: ByteBuffer): Boolean =
    try { gpuPrefs().getBoolean("gpuTrying:" + gpuToken(assetBase, bytes), false) } catch (_: Throwable) { false }

  private fun markGpuTrialStart(assetBase: String, bytes: ByteBuffer) {
    try { gpuPrefs().edit().putBoolean("gpuTrying:" + gpuToken(assetBase, bytes), true).commit() } catch (_: Throwable) {}
  }

  private fun clearGpuTrialMark(assetBase: String, bytes: ByteBuffer) {
    try { gpuPrefs().edit().remove("gpuTrying:" + gpuToken(assetBase, bytes)).commit() } catch (_: Throwable) {}
  }


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
    var decoder: MoveNetHeadsDecoder? = null
    var decoderHeads: Array<FloatBuffer>? = null
    var replyBuffer: ByteBuffer? = null
    if (id == 3) {
      val bound = bindMoveNetHeads(interp, outputNames, outputBuffers)
      decoder = MoveNetHeadsDecoder(bound.h, bound.w)
      decoderHeads = bound.views
      replyBuffer = ByteBuffer.allocateDirect(MoveNetHeadsDecoder.OUTPUT_FLOATS * 4).order(ByteOrder.nativeOrder())
      Log.i(TAG, "movenet-heads bound: H=${bound.h} W=${bound.w} order=[center,kptHeat,kptRegress,kptOffset,boxScale,boxOffset]")
    }
    return LoadedModel(id, interp, delegate, backend, shape[2], shape[1], inputBuffer, outputBuffers, outputNames,
      decoder, decoderHeads, replyBuffer)
  }

  private class MoveNetHeadsBinding(val h: Int, val w: Int, val views: Array<FloatBuffer>)

  /** Resolves the six movenet-heads output tensors to fixed roles by
   * their `PartitionedCall:<slot>` NAME, never by tensor position --
   * the interpreter's own output-detail order is NOT signature order
   * (measured: index 0 is slot 4 / box_scale) -- and fails the model
   * (throws, caught by loadAll -> the page falls back to the worker)
   * if any name, shape or H/W does not match what the decoder expects.
   * HEADS-REPORT.md section 5. */
  private fun bindMoveNetHeads(interp: Interpreter, outputNames: List<String>, outputBuffers: Array<ByteBuffer>): MoveNetHeadsBinding {
    val views = arrayOfNulls<FloatBuffer>(6)
    val seen = BooleanArray(6)
    var h = -1
    var w = -1
    for (i in outputNames.indices) {
      val name = outputNames[i]
      val m = MOVENET_HEAD_NAME.matchEntire(name)
        ?: throw IllegalStateException("movenet-heads: unrecognised output tensor name '$name'")
      val slot = m.groupValues[1].toInt()
      if (seen[slot]) throw IllegalStateException("movenet-heads: duplicate output slot $slot ('$name')")
      seen[slot] = true
      val tshape = interp.getOutputTensor(i).shape() // [1, H, W, C]
      if (tshape.size != 4 || tshape[0] != 1 || tshape[3] != MOVENET_HEAD_CHANNELS[slot]) {
        throw IllegalStateException("movenet-heads: slot $slot shape ${tshape.joinToString(",", "[", "]")} " +
          "!= expected [1,H,W,${MOVENET_HEAD_CHANNELS[slot]}]")
      }
      if (h == -1) { h = tshape[1]; w = tshape[2] }
      else if (h != tshape[1] || w != tshape[2]) {
        throw IllegalStateException("movenet-heads: slot $slot is ${tshape[1]}x${tshape[2]}, disagrees with ${h}x$w")
      }
      outputBuffers[i].rewind()
      views[slot] = outputBuffers[i].asFloatBuffer()
    }
    if (seen.any { !it }) throw IllegalStateException("movenet-heads: missing output slot(s) among ${outputNames.joinToString()}")
    @Suppress("UNCHECKED_CAST")
    return MoveNetHeadsBinding(h, w, views as Array<FloatBuffer>)
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
      if (maxDiff > 0.02f * (maxRef + 1e-3f)) {
        // Model 3 is now movenet-heads: SIX raw regression/offset heads
        // compared per-head instead of one [1,6,56] -- named here so the
        // next Redmi NNAPI trial log says WHICH head tripped the 2%
        // bar and by how much, not just "disagree".
        val name = a.outputNames.getOrElse(h) { "output$h" }
        Log.i(TAG, "outputsAgree: head '$name' (idx $h) disagrees, maxDiff=${"%.5f".format(maxDiff)} maxRef=${"%.5f".format(maxRef)}")
        return false
      }
    }
    return true
  }

  /** A subdirectory of codeCacheDir for TFLite's serialized GPU kernel
   * cache, created on demand. Null (never thrown) if it cannot be made,
   * which is the fallback-to-uncached signal loadModel acts on. */
  private fun gpuKernelCacheDir(): File? {
    return try {
      val dir = File(ctx.codeCacheDir, "tflite-gpu")
      if (dir.isDirectory || dir.mkdirs()) dir else null
    } catch (e: Throwable) {
      null
    }
  }

  /** A GPU interpreter for this model, or a throw. `listed` picks the
   * options source: the compatibility list's own recommendation where
   * the device is in its database, plain defaults where it is not (a
   * device the list has never heard of has no recommendation to give,
   * and asking for one there is not meaningful). */
  private fun newGpuInterpreter(id: Int, assetBase: String, bytes: ByteBuffer, listed: Boolean): Pair<Interpreter, GpuDelegate> {
    val dopts = if (listed) {
      try { CompatibilityList().bestOptionsForThisDevice } catch (_: Throwable) { GpuDelegate.Options() }
    } else GpuDelegate.Options()
    // Allowing precision loss computes in f16 on the Adreno 610.
    // MoveNet cannot (see MODEL_FP16); the face models can.
    dopts.setPrecisionLossAllowed(id in MODEL_FP16)
    // GPU delegate init spends 1.4-3.9s per model compiling
    // shaders (spikes/native/GPU-REPORT.md) -- TFLite can persist
    // the compiled kernels to disk and skip the compile on a
    // later load of the SAME model on the SAME device. Token
    // carries the build's versionCode and the asset's byte
    // length so a new build or a swapped .tflite can never load
    // a stale cache. Never let this stop the model from loading:
    // a missing dir or a throw here falls back to today's
    // uncached options.
    try {
      val dir = gpuKernelCacheDir()
      if (dir != null) {
        dopts.setSerializationParams(dir.absolutePath, gpuToken(assetBase, bytes))
      } else if (!warnedGpuCache) {
        warnedGpuCache = true
        Log.w(TAG, "GPU kernel cache dir unavailable, delegate init will not be cached")
      }
    } catch (e: Throwable) {
      if (!warnedGpuCache) {
        warnedGpuCache = true
        Log.w(TAG, "GPU kernel cache setup failed, delegate init will not be cached: " + e.message)
      }
    }
    val delegate = GpuDelegate(dopts)
    try {
      return Pair(Interpreter(bytes, Interpreter.Options().addDelegate(delegate)), delegate)
    } catch (e: Throwable) {
      try { delegate.close() } catch (_: Throwable) {}
      throw e
    }
  }

  /** @param allowGpu false builds a deliberately CPU copy -- the shadow
   *   the GPU arbiter measures against.
   * @param record false for a shadow or trial copy, so a throwaway
   *   interpreter never rewrites what the report says about the
   *   shipping one. */
  private fun loadModel(id: Int, assetBase: String, allowGpu: Boolean = true, record: Boolean = true): LoadedModel {
    val t0 = SystemClock.elapsedRealtimeNanos()
    val bytes = loadAssetModel("$assetBase.tflite")
    var delegate: GpuDelegate? = null
    var interp: Interpreter? = null
    var backend = "cpu"
    val note = if (record) gpuNotes.getOrPut(id) { GpuNote() } else GpuNote()
    if (record) { note.loadThrewR = null }
    if (!forceCpuFor(id)) {
      // THE COMPATIBILITY LIST IS NOT AN AUTHORITY, IT IS A HINT.
      // `isDelegateSupportedOnThisDevice` answers out of
      // gpu_compatibility.bin, a device database frozen when
      // tensorflow-lite-gpu 2.16.1 was built. His Redmi 13 (SM4450 /
      // Adreno 613, 2023) is absent from it, so every model landed on
      // CPU with NO throw and NO log line -- invisible in the report,
      // and the same silent fallback awaits every phone newer than the
      // database. So an unlisted device is no longer refused here: it
      // is refused a GPU at LOAD (a cold delegate costs 1.4-3.9s of
      // shader compile per model and three of those would run the page
      // past its 15s ready timeout -- the 1098 NNAPI-in-loadAll defect)
      // and given a MEASURED trial after ready instead, on its own
      // thread. A trial that won is remembered, so only the first
      // launch on a given build pays for it.
      note.listed = !forceUnlisted() &&
        try { CompatibilityList().isDelegateSupportedOnThisDevice } catch (_: Throwable) { false }
      note.remembered = gpuRemembered(assetBase, bytes)
      if (allowGpu && (note.listed || note.remembered)) {
        try {
          val pair = newGpuInterpreter(id, assetBase, bytes, note.listed)
          interp = pair.first
          delegate = pair.second
          backend = "gpu"
          note.attempted = true
        } catch (e: Throwable) {
          delegate = null
          interp = null
          note.attempted = true
          if (record) note.loadThrewR = e.message ?: e.toString()
          // A remembered win that now throws is stale -- a driver or an
          // OS update can take a delegate away. Forget it so the next
          // launch measures again instead of failing again.
          if (note.remembered) forgetGpu(assetBase, bytes)
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
    val ms = ((SystemClock.elapsedRealtimeNanos() - t0) / 1e6).toInt()
    Log.i(TAG, "loaded $assetBase backend=$backend ms=$ms")
    return candidate
  }

  /** Which models an NNAPI trial may still be worth running for. */
  private fun npuTrialIds(): List<Int> =
    if (!npuAllowedByFlags() || Build.VERSION.SDK_INT < 27) emptyList()
    else MODEL_ASSET.keys.filter { !forceCpuFor(it) && "npu:$it" !in lost && models[it]?.backend != "npu" }

  /** Which models are on CPU only because the compatibility list has
   * never heard of this device. A model that TRIED the GPU and threw is
   * not here -- retrying a delegate that refused to build buys nothing.
   * Neither is one the page masked to CPU on purpose. */
  private fun gpuTrialIds(): List<Int> =
    MODEL_ASSET.keys.filter {
      val n = gpuNotes[it]
      !forceCpuFor(it) && "gpu:$it" !in lost && models[it]?.backend == "cpu" &&
        n != null && !n.listed && !n.attempted
    }

  private fun ensureTrialHandler(): Handler {
    var h = trialHandler
    if (h == null) {
      val t = HandlerThread("ts-delegate-trial", Process.THREAD_PRIORITY_BACKGROUND).also { it.start() }
      trialThread = t
      h = Handler(t.looper)
      trialHandler = h
    }
    return h
  }

  /** GPU arm first, NNAPI only once it has settled (see `decide`). With
   * no GPU trial to run -- a listed device, or every model already off
   * CPU -- the NNAPI arm starts immediately, which is 1100's behaviour
   * unchanged. */
  private fun scheduleTrials() {
    npuScheduled = false
    scheduleGpuTrials()
    if (trialsPending <= 0) { npuScheduled = true; scheduleNpuTrials() }
  }

  private fun scheduleGpuTrials() {
    val ids = gpuTrialIds()
    if (ids.isEmpty()) return
    val h = ensureTrialHandler()
    val gen = configGen
    trialsPending += ids.size
    for (id in ids) h.post { gpuTrial(id, MODEL_ASSET[id]!!, gen) }
  }

  private fun scheduleNpuTrials() {
    val ids = npuTrialIds()
    if (ids.isEmpty()) return
    val h = ensureTrialHandler()
    val gen = configGen
    trialsPending += ids.size
    for (id in ids) h.post { npuTrial(id, MODEL_ASSET[id]!!, gen) }
  }

  // THE GPU ARM. Same arbiter shape as the NNAPI one below and for the
  // same reason: a delegate that initialises is not a delegate that
  // works. On a device the compatibility list does not know, the driver
  // may take the graph and return garbage, or take it and be slower
  // than XNNPACK on four threads. So the GPU has to AGREE with the CPU
  // copy on every output head within 2% and beat it by 10% on the clock,
  // measured on the last REAL frame the page sent, or the CPU model
  // stays. Runs entirely off ts-infer: build and warm here, one buffer
  // copy on ts-infer, time and compare here, swap on ts-infer.
  private fun gpuTrial(id: Int, assetBase: String, gen: Int) {
    var gm: LoadedModel? = null
    var marked: ByteBuffer? = null
    try {
      val bytes = loadAssetModel("$assetBase.tflite")
      if (gpuTrialStarted(assetBase, bytes)) {
        Log.w(TAG, "GPU trial for $assetBase did not survive a previous launch, not retrying on this build")
        handler.post { gpuNotes[id]?.trialThrewR = "previous trial did not return" }
        handler.post { decide("gpu", id, assetBase, null, false, gen) }
        return
      }
      markGpuTrialStart(assetBase, bytes)
      marked = bytes
      val pair = newGpuInterpreter(id, assetBase, bytes, false)
      val built = try {
        buildModel(id, pair.first, pair.second, "gpu")
      } catch (e: Throwable) {
        try { pair.first.close() } catch (_: Throwable) {}
        try { pair.second.close() } catch (_: Throwable) {}
        throw e
      }
      gm = built
      run(built) // warm: allocation and shader compile, not the cost being compared
    } catch (e: Throwable) {
      Log.w(TAG, "GPU trial failed to build for $assetBase: " + e.message)
      handler.post { gpuNotes[id]?.trialThrewR = e.message ?: e.toString() }
      if (gm != null) closeModel(gm)
      gm = null
    } finally {
      // It came back, whatever the outcome -- the breadcrumb has done
      // its job. Cleared here rather than after the arbitration so a
      // driver that dies while TIMING (not while building) is still
      // caught by the next launch's `attempted` path.
      marked?.let { clearGpuTrialMark(assetBase, it) }
    }
    val trial = gm
    if (trial == null) { handler.post { decide("gpu", id, assetBase, null, false, gen) }; return }
    handler.post { snapshotInput("gpu", id, assetBase, trial, gen, 0) }
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
    if (trial == null) { handler.post { decide("npu", id, assetBase, null, false, gen) }; return }
    handler.post { snapshotInput("npu", id, assetBase, trial, gen, 0) }
  }

  /** On ts-infer: copy the shipping model's LAST REAL INPUT for the
   * arbiter -- one buffer copy, the only work this thread does before
   * the decision. No real frame yet: try again in a second, up to
   * NPU_SNAPSHOT_TRIES, then the arm loses. */
  private fun snapshotInput(kind: String, id: Int, assetBase: String, nn: LoadedModel, gen: Int, tries: Int) {
    val candidate = models[id]
    if (closed || gen != configGen || candidate == null) {
      decide(kind, id, assetBase, nn, false, gen)
      return
    }
    if (!candidate.realInput) {
      if (tries >= NPU_SNAPSHOT_TRIES) { decide(kind, id, assetBase, nn, false, gen); return }
      handler.postDelayed({ snapshotInput(kind, id, assetBase, nn, gen, tries + 1) }, 1000L)
      return
    }
    val ib = candidate.inputBuffer.duplicate()
    ib.rewind()
    val input = ByteArray(ib.remaining())
    ib.get(input)
    val th = trialHandler
    if (th == null || !th.post { arbitrate(kind, id, assetBase, nn, input, gen) }) decide(kind, id, assetBase, nn, false, gen)
  }

  /** On the trial thread: a SHADOW copy of the shipping candidate (its
   * own interpreter and context, this thread's) against the trial on the
   * same real frame. Nothing here touches ts-infer. The GPU arm forces
   * its shadow to CPU -- the shipping model IS the CPU one there, and a
   * remembered GPU win must not make the shadow a second GPU copy. */
  private fun arbitrate(kind: String, id: Int, assetBase: String, nn: LoadedModel, input: ByteArray, gen: Int) {
    var win = false
    var shadow: LoadedModel? = null
    var agree = false
    var trialMs = -1.0
    var shadowMs = -1.0
    try {
      shadow = loadModel(id, assetBase, allowGpu = kind != "gpu", record = false)
      val sb = shadow.inputBuffer; sb.rewind(); sb.put(input)
      val nb = nn.inputBuffer; nb.rewind(); nb.put(input)
      trialMs = bestRunMs(nn, 3)
      shadowMs = bestRunMs(shadow, 3)
      agree = outputsAgree(nn, shadow)
      win = shouldSwap(agree, trialMs, shadowMs)
      Log.i(TAG, "$kind arbiter $assetBase: $kind=${"%.1f".format(trialMs)}ms ${shadow.backend}=${"%.1f".format(shadowMs)}ms agree=$agree -> " + (if (win) kind else shadow.backend))
    } catch (e: Throwable) {
      Log.w(TAG, "$kind arbitration failed for $assetBase: " + e.message)
      if (kind == "gpu") handler.post { gpuNotes[id]?.trialThrewR = e.message ?: e.toString() }
      win = false
    }
    if (shadow != null) closeModel(shadow)
    val fAgree = agree; val fTrial = trialMs; val fShadow = shadowMs
    if (kind == "gpu") handler.post {
      gpuNotes[id]?.let { it.trialRan = true; it.trialAgree = fAgree; it.trialGpuMs = fTrial; it.trialCpuMs = fShadow }
    }
    handler.post { decide(kind, id, assetBase, nn, win, gen) }
  }

  /** On ts-infer: swap or drop. The only arbiter work on this thread. */
  private fun decide(kind: String, id: Int, assetBase: String, nn: LoadedModel?, win: Boolean, gen: Int) {
    if (gen == configGen) trialsPending--
    val candidate = models[id]
    val stillWanted = !closed && gen == configGen && candidate != null && !forceCpuFor(id) &&
      (kind != "npu" || npuAllowedByFlags())
    if (!stillWanted) {
      if (nn != null) closeModel(nn)
    } else if (nn == null || !win) {
      if (nn != null) closeModel(nn)
      lost.add("$kind:$id")
    } else {
      nn.realInput = candidate!!.realInput
      models[id] = nn
      closeModel(candidate)
      if (kind == "gpu") {
        gpuNotes[id]?.trialWon = true
        try { rememberGpu(assetBase, loadAssetModel("$assetBase.tflite")) } catch (_: Throwable) {}
      }
      Log.i(TAG, "$kind arbiter: $assetBase now on $kind")
    }
    if (gen == configGen && trialsPending <= 0) {
      trialsPending = 0
      // The NNAPI arm waits for the GPU arm: a model that just moved to
      // the GPU is a different (and better) shadow to beat, and two
      // trials building shadow interpreters at once is exactly the load
      // spike that killed native on 1098.
      if (!npuScheduled) { npuScheduled = true; scheduleNpuTrials() }
      if (trialsPending <= 0) postBackends()
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
      // Model 3 (movenet-heads): the six raw heads never leave this
      // class. MoveNetHeadsDecoder reproduces the full model's
      // [1,6,56] from them, on this same thread, inside this same
      // try/catch -- a decode exception is a failed request like any
      // other, never a silent zero reply.
      val outputsToSend: Array<ByteBuffer>
      if (model.id == 3) {
        val heads = model.decoderHeads!!
        val out = model.decoder!!.decode(heads[0], heads[1], heads[2], heads[3], heads[4], heads[5])
        val rb = model.replyBuffer!!
        rb.rewind()
        val fb = rb.asFloatBuffer()
        fb.put(out)
        outputsToSend = arrayOf(rb)
      } else {
        outputsToSend = model.outputBuffers
      }
      model.consecutiveErrors = 0
      val elapsedNanos = SystemClock.elapsedRealtimeNanos() - t0
      reply(reqId, 0, outputsToSend, (elapsedNanos / 1000L).toInt())
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
    // 1100: the report's per-model backends were one DOCUMENT late --
    // the ready message carries the engine's state from BEFORE this
    // page's CONFIG, and nothing re-posted them after the rebuild, so
    // the auto test's "faces on CPU" row read gpu and the NEXT row read
    // cpu. Post them now that the rebuild has settled.
    postBackends()
    scheduleTrials()
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

  /** WHY each model is on the backend it is on -- the whole point of
   * 1101. Before this, a device the compatibility list had never heard
   * of reported `cpu` with no reason anywhere but logcat, so answering
   * "why is this phone slow" needed the phone on a cable. `listed` is
   * the list's own answer, `tried` whether a delegate was constructed at
   * load, `ran`/`agree`/`won` the post-ready measurement, and `gpuMs`
   * /`cpuMs` what it measured. -1 means "not measured", never zero. */
  private fun gpuJson(): JSONObject {
    val j = JSONObject()
    for (id in MODEL_REPORT_NAME.keys) {
      val n = gpuNotes[id] ?: continue
      val o = JSONObject()
        .put("listed", n.listed)
        .put("remembered", n.remembered)
        .put("tried", n.attempted)
        .put("ran", n.trialRan)
        .put("agree", n.trialAgree)
        .put("won", n.trialWon)
        .put("gpuMs", if (n.trialGpuMs < 0) -1 else Math.round(n.trialGpuMs).toInt())
        .put("cpuMs", if (n.trialCpuMs < 0) -1 else Math.round(n.trialCpuMs).toInt())
      val why = n.loadThrewR ?: n.trialThrewR
      if (why != null) o.put("whyR", why)
      j.put(id.toString(), o)
    }
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
    lost.any { it.startsWith("npu:") } && npuTrialIds().isEmpty() -> "failed"
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
      // Model 3 replies with ONE decoded [6,56] tensor, never the six
      // raw heads -- publishing all six here would tell the page it is
      // getting six tensors back (HEADS-REPORT.md section 5 point 4).
      if (models[id]?.decoder != null) outs.put("movenet-decoded")
      else models[id]?.outputNames?.forEach { outs.put(it) }
      modelsJson.put(JSONObject().put("id", id).put("name", name).put("outputs", outs))
    }
    val msg = JSONObject()
      .put("type", "native-ready")
      .put("backend", worstBackend())
      .put("backends", backendsJson())
      .put("npu", npuState())
      .put("gpu", gpuJson())
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
      .put("gpu", gpuJson())
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
