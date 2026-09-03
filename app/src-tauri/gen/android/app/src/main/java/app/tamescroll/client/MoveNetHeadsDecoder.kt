package app.tamescroll.client

import java.nio.FloatBuffer
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min

/**
 * Pure Kotlin port of MoveNet MultiPose Lightning's CenterNet decode
 * tail, so `movenet-heads.tflite` (the same graph cut at the six conv
 * heads -- spikes/native/HEADS-REPORT.md) can reproduce the full fused
 * model's `[1,6,56]` output that `native-client.mjs` / `person-gate.mjs`
 * expect.
 *
 * Ported from `spikes/native/movenet_decode_port.py` (box-restricted
 * candidate search + separable exponential weight), itself derived
 * from the 324 graph nodes downstream of the six heads
 * (`spikes/native/graph_dump2.py`), not from a paper -- structure
 * mirrors TensorFlow Models' CenterNet meta-architecture (Apache-2.0,
 * `object_detection/meta_architectures/center_net_meta_arch.py`),
 * written from the graph, nothing copied.
 *
 * Bit-exact on keypoint coordinates and boxes, ~1 ulp on scores,
 * against the full fused graph over 159 corpus frames
 * (HEADS-REPORT.md section 3). Two deliberate graph-vs-textbook quirks
 * are reproduced on purpose (same section, read from the graph, not
 * assumed): the NMS window is 5x5 (not the reference's 3x3), and a
 * keypoint's reported score is the MAX over ALL SIX instances at its
 * chosen cell -- never just this instance's own value.
 *
 * Every array below is allocated ONCE, sized off H/W at construction,
 * and reused on every `decode()` call: zero allocation per frame.
 * Inputs are plain `FloatBuffer`s over whatever memory holds the raw
 * head tensors -- no `Interpreter` in sight, so this class is
 * unit-testable off a fixture with no TFLite runtime at all.
 */
class MoveNetHeadsDecoder(private val h: Int, private val w: Int) {
  companion object {
    const val NUM_KEYPOINTS = 17
    const val MAX_INSTANCES = 6
    const val NMS_KSIZE = 5
    private const val NMS_HALF = NMS_KSIZE / 2
    // f16 quantization of 1e-6 in the shipped weights (StatefulPartitionedCall/Less/y).
    const val PEAK_EPS = 1.013279e-06f
    // f16 quantization of 0.3 (StatefulPartitionedCall/mul_6/y).
    const val KP_SIGMA_FRAC = 0.300049f
    // f16 quantization of 0.127 (StatefulPartitionedCall/Greater_1/y).
    const val KP_SCORE_THRESHOLD = 0.126953f
    // 17 x (y, x, score), then ymin/xmin/ymax/xmax, then the instance score.
    const val OUT_STRIDE = NUM_KEYPOINTS * 3 + 4 + 1 // 56
    const val OUTPUT_FLOATS = MAX_INSTANCES * OUT_STRIDE // 336
  }

  private val k = NUM_KEYPOINTS
  private val n = MAX_INSTANCES
  private val sigma = min(h, w).toFloat() * KP_SIGMA_FRAC

  // ---- scratch, allocated once, reused every decode() call -----------
  private val peakScore = FloatArray(h * w)
  private val topScore = FloatArray(n)
  private val topIdx = IntArray(n)
  private val cy = IntArray(n)
  private val cx = IntArray(n)
  private val boxYmin = FloatArray(n)
  private val boxXmin = FloatArray(n)
  private val boxYmax = FloatArray(n)
  private val boxXmax = FloatArray(n)
  private val seedY = FloatArray(n * k)
  private val seedX = FloatArray(n * k)
  // the "instance-max" plane the graph gathers a keypoint's score from,
  // built over every instance's box before anyone reads it (step 5).
  private val instMax = FloatArray(h * w * k)
  private val bestVal = FloatArray(n * k)
  private val bestY = IntArray(n * k)
  private val bestX = IntArray(n * k)
  // sized to the worst case (a box spanning the whole frame); only the
  // first (extent * k) entries are used for a given instance's box.
  private val expY = FloatArray(h * k)
  private val expX = FloatArray(w * k)

  /** `[6*56]` in the shipped layout. Owned by this decoder and
   * overwritten by every `decode()` call -- copy it out before the
   * next call if you need to keep it. */
  val output = FloatArray(OUTPUT_FLOATS)

  /**
   * `heads` in the fixed order [center, kptHeat, kptRegress, kptOffset,
   * boxScale, boxOffset] -- NHWC float32 as TFLite delivers them, batch
   * dimension already stripped by the caller (index `(y*w+x)*C + c`).
   * Writes into and returns `output`.
   */
  fun decode(
    center: FloatBuffer,
    kptHeat: FloatBuffer,
    kptRegress: FloatBuffer,
    kptOffset: FloatBuffer,
    boxScale: FloatBuffer,
    boxOffset: FloatBuffer,
  ): FloatArray {
    // ---- 1. instance centres: 5x5 SAME local-max NMS, then top-6 -------
    // (MaxPool -> |c - max| < eps survives; suppressed cells are zeroed,
    // not masked out, so a tie on the top-k must break to the LOWER flat
    // index -- exactly what a strict '>' insert scanning idx ascending
    // gives.)
    for (y in 0 until h) {
      for (x in 0 until w) {
        val c = center.get(y * w + x)
        var m = -Float.MAX_VALUE
        for (dy in -NMS_HALF..NMS_HALF) {
          val oy = y + dy
          if (oy < 0 || oy >= h) continue
          for (dx in -NMS_HALF..NMS_HALF) {
            val ox = x + dx
            if (ox < 0 || ox >= w) continue
            val v = center.get(oy * w + ox)
            if (v > m) m = v
          }
        }
        peakScore[y * w + x] = if (abs(c - m) < PEAK_EPS) c else 0f
      }
    }
    for (i in 0 until n) { topScore[i] = -Float.MAX_VALUE; topIdx[i] = 0 }
    for (idx in 0 until h * w) {
      val v = peakScore[idx]
      if (v > topScore[n - 1]) {
        var pos = n - 1
        while (pos > 0 && v > topScore[pos - 1]) {
          topScore[pos] = topScore[pos - 1]
          topIdx[pos] = topIdx[pos - 1]
          pos--
        }
        topScore[pos] = v
        topIdx[pos] = idx
      }
    }
    for (i in 0 until n) {
      cy[i] = topIdx[i] / w
      cx[i] = topIdx[i] - cy[i] * w
    }

    // ---- 2. boxes: gather box_scale/box_offset at each centre cell -----
    for (i in 0 until n) {
      val cell = cy[i] * w + cx[i]
      val hgt = max(boxScale.get(cell * 2), 0f)
      val wid = max(boxScale.get(cell * 2 + 1), 0f)
      val offY = boxOffset.get(cell * 2)
      val offX = boxOffset.get(cell * 2 + 1)
      val ccy = cy[i].toFloat() + offY
      val ccx = cx[i].toFloat() + offX
      boxYmin[i] = (ccy - hgt * 0.5f).coerceIn(0f, h.toFloat())
      boxXmin[i] = (ccx - wid * 0.5f).coerceIn(0f, w.toFloat())
      boxYmax[i] = (ccy + hgt * 0.5f).coerceIn(0f, h.toFloat())
      boxXmax[i] = (ccx + wid * 0.5f).coerceIn(0f, w.toFloat())
    }

    // ---- 3. keypoint seeds from the regression head --------------------
    for (i in 0 until n) {
      val cell = cy[i] * w + cx[i]
      val base = cell * (k * 2)
      for (kk in 0 until k) {
        seedY[i * k + kk] = cy[i].toFloat() + kptRegress.get(base + kk * 2)
        seedX[i * k + kk] = cx[i].toFloat() + kptRegress.get(base + kk * 2 + 1)
      }
    }

    // ---- 4. box-restricted candidate search + the instance-max plane --
    // score(y,x,k) = heat(y,x,k) * exp(-dy^2/sigma) * exp(-dx^2/sigma),
    // scanned only inside instance n's own (clipped, grid-unit) box --
    // exact because the score is 0 outside it (movenet_decode_port.py).
    java.util.Arrays.fill(instMax, 0f)
    java.util.Arrays.fill(bestVal, 0f)
    java.util.Arrays.fill(bestY, 0)
    java.util.Arrays.fill(bestX, 0)
    for (i in 0 until n) {
      val y0 = ceil(boxYmin[i]).toInt().coerceIn(0, h)
      val y1 = ceil(boxYmax[i]).toInt().coerceIn(0, h)
      val x0 = ceil(boxXmin[i]).toInt().coerceIn(0, w)
      val x1 = ceil(boxXmax[i]).toInt().coerceIn(0, w)
      if (y1 <= y0 || x1 <= x0) continue // empty box: this instance contributes nothing
      val rows = y1 - y0
      val cols = x1 - x0
      val nBase = i * k
      for (row in 0 until rows) {
        val yv = (y0 + row).toFloat()
        val rowBase = row * k
        for (kk in 0 until k) {
          val dy = yv - seedY[nBase + kk]
          expY[rowBase + kk] = exp(-(dy * dy) / sigma)
        }
      }
      for (col in 0 until cols) {
        val xv = (x0 + col).toFloat()
        val colBase = col * k
        for (kk in 0 until k) {
          val dx = xv - seedX[nBase + kk]
          expX[colBase + kk] = exp(-(dx * dx) / sigma)
        }
      }
      for (row in 0 until rows) {
        val y = y0 + row
        val expYRowBase = row * k
        for (col in 0 until cols) {
          val x = x0 + col
          val heatBase = (y * w + x) * k
          val expXColBase = col * k
          val instBase = (y * w + x) * k
          for (kk in 0 until k) {
            val s = kptHeat.get(heatBase + kk) * expY[expYRowBase + kk] * expX[expXColBase + kk]
            if (s > instMax[instBase + kk]) instMax[instBase + kk] = s
            val bi = nBase + kk
            if (s > bestVal[bi]) {
              bestVal[bi] = s
              bestY[bi] = y
              bestX[bi] = x
            }
          }
        }
      }
    }

    // ---- 5. sub-cell offset + score, and 6. instance score --------------
    for (i in 0 until n) {
      var sum = 0f
      var count = 0
      val nBase = i * k
      for (kk in 0 until k) {
        val bi = nBase + kk
        // TF ArgMax returns the LOWEST flat index among equal maxima,
        // and every out-of-box cell is exactly 0 -- so a non-positive
        // in-box maximum (including "no candidate at all", box empty)
        // means the global argmax is flat index 0.
        val found = bestVal[bi] > 0f
        val by = if (found) bestY[bi] else 0
        val bx = if (found) bestX[bi] else 0
        val cell = by * w + bx
        val offBase = cell * (k * 2)
        val koY = kptOffset.get(offBase + kk * 2)
        val koX = kptOffset.get(offBase + kk * 2 + 1)
        val kpY = (by.toFloat() + koY) / h
        val kpX = (bx.toFloat() + koX) / w
        // THE INSTANCE-MAX QUIRK: gather from instMax, which was built
        // over every instance's box -- never from this instance's own
        // bestVal -- so a neighbouring instance's seed can win here.
        val kpScore = instMax[cell * k + kk]
        val o = i * OUT_STRIDE + kk * 3
        output[o] = kpY
        output[o + 1] = kpX
        output[o + 2] = kpScore
        if (kpScore > KP_SCORE_THRESHOLD) {
          sum += kpScore
          count++
        }
      }
      val o = i * OUT_STRIDE + k * 3
      output[o] = (boxYmin[i] / h).coerceIn(0f, 1f)
      output[o + 1] = (boxXmin[i] / w).coerceIn(0f, 1f)
      output[o + 2] = (boxYmax[i] / h).coerceIn(0f, 1f)
      output[o + 3] = (boxXmax[i] / w).coerceIn(0f, 1f)
      val nValid = max(count, 1).toFloat()
      output[o + 4] = topScore[i] * (sum / nValid)
    }
    return output
  }
}
