package app.tamescroll.bench

import android.app.Activity
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

// Times each .tflite under assets/models on the GPU delegate and on
// XNNPACK (4 threads). Prints ONE line: `TSBENCH RESULT <json>`.
// Intent extra `runs` (int) overrides the 100-run default; extra
// `models` (comma list) restricts the set.
class BenchActivity : Activity() {
    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        val runs = intent?.getIntExtra("runs", 100) ?: 100
        val only = intent?.getStringExtra("models")?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() }
        Thread {
            val out = JSONArray()
            val names = (assets.list("models") ?: emptyArray()).filter { it.endsWith(".tflite") }
                .filter { only == null || only.contains(it) || only.contains(it.removeSuffix(".tflite")) }
                .sorted()
            val cl = CompatibilityList()
            out.put(
                JSONObject().put("device", android.os.Build.MODEL)
                    .put("gpuDelegateSupported", cl.isDelegateSupportedOnThisDevice)
                    .put("runs", runs).put("models", JSONArray(names))
            )
            for (name in names) for (gpu in listOf(true, false)) {
                val row = JSONObject().put("model", name).put("gpu", gpu)
                var delegate: GpuDelegate? = null
                var interp: Interpreter? = null
                try {
                    val opts = Interpreter.Options()
                    if (gpu) {
                        if (!cl.isDelegateSupportedOnThisDevice) {
                            row.put("skipped", "delegate unsupported"); out.put(row); continue
                        }
                        val dopts = cl.bestOptionsForThisDevice
                        dopts.setPrecisionLossAllowed(true)
                        delegate = GpuDelegate(dopts)
                        opts.addDelegate(delegate)
                    } else {
                        opts.setNumThreads(4)
                        opts.setUseXNNPACK(true)
                    }
                    val t0 = SystemClock.elapsedRealtimeNanos()
                    interp = Interpreter(loadModel(name), opts)
                    interp.allocateTensors()
                    row.put("initMs", (SystemClock.elapsedRealtimeNanos() - t0) / 1e6)
                    val inT = interp.getInputTensor(0)
                    row.put("input", JSONObject().put("shape", JSONArray(inT.shape().toList())).put("type", inT.dataType().name))
                    val input = fillInput(inT.numBytes(), inT.dataType(), inT.shape())
                    val outputs = HashMap<Int, Any>()
                    val outMeta = JSONArray()
                    for (i in 0 until interp.outputTensorCount) {
                        val t = interp.getOutputTensor(i)
                        outputs[i] = ByteBuffer.allocateDirect(t.numBytes()).order(ByteOrder.nativeOrder())
                        outMeta.put(JSONObject().put("name", t.name()).put("shape", JSONArray(t.shape().toList())).put("type", t.dataType().name))
                    }
                    row.put("outputs", outMeta)
                    val warm = timeMs { input.rewind(); rewindAll(outputs); interp.runForMultipleInputsOutputs(arrayOf(input), outputs) }
                    row.put("warmMs", warm)
                    val samples = DoubleArray(runs) {
                        timeMs { input.rewind(); rewindAll(outputs); interp.runForMultipleInputsOutputs(arrayOf(input), outputs) }
                    }
                    samples.sort()
                    row.put("p50", samples[samples.size / 2]).put("p95", samples[(samples.size * 95) / 100])
                        .put("min", samples[0]).put("max", samples[samples.size - 1])
                    // A fingerprint of output 0 so parity across arms can be eyeballed.
                    val o0 = outputs[0] as ByteBuffer
                    o0.rewind()
                    var sum = 0.0
                    val f = o0.asFloatBuffer()
                    val n = minOf(f.limit(), 4096)
                    for (k in 0 until n) sum += f.get(k)
                    row.put("out0Sum4096", sum)
                } catch (e: Throwable) {
                    row.put("error", e.toString())
                } finally {
                    try { interp?.close() } catch (_: Throwable) {}
                    try { delegate?.close() } catch (_: Throwable) {}
                }
                out.put(row)
                Log.i("TSBENCH", "ROW " + row.toString())
            }
            Log.i("TSBENCH", "RESULT " + out.toString())
        }.start()
    }

    private fun loadModel(name: String): ByteBuffer {
        val fd = assets.openFd("models/" + name)
        fd.createInputStream().channel.use { ch ->
            return ch.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
        }
    }

    private fun fillInput(bytes: Int, type: DataType, shape: IntArray): ByteBuffer {
        val b = ByteBuffer.allocateDirect(bytes).order(ByteOrder.nativeOrder())
        // Deterministic gradient so every arm sees identical pixels.
        val n = shape.fold(1) { a, v -> a * v }
        when (type) {
            DataType.FLOAT32 -> { val f = b.asFloatBuffer(); for (i in 0 until n) f.put(i, ((i * 7919) % 256) / 255f) }
            DataType.UINT8 -> for (i in 0 until n) b.put(i, ((i * 7919) % 256).toByte())
            DataType.INT32 -> { val ib = b.asIntBuffer(); for (i in 0 until n) ib.put(i, (i * 7919) % 256) }
            else -> for (i in 0 until bytes) b.put(i, ((i * 7919) % 256).toByte())
        }
        b.rewind()
        return b
    }

    private fun rewindAll(m: HashMap<Int, Any>) { for (v in m.values) (v as ByteBuffer).rewind() }

    private inline fun timeMs(block: () -> Unit): Double {
        val t0 = SystemClock.elapsedRealtimeNanos()
        block()
        return (SystemClock.elapsedRealtimeNanos() - t0) / 1e6
    }
}
