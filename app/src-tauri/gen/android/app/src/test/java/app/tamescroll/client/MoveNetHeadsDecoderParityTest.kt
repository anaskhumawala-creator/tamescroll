package app.tamescroll.client

import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/** `index.json` is written by `dump_heads_fixture.py` in one fixed,
 * flat shape (no nested arrays of objects), so a couple of regexes
 * read it without a JSON library -- `org.json` is present on the
 * compile classpath but Android's "mockable jar" makes every non-
 * trivial method of it throw at unit-test RUNTIME
 * (https://developer.android.com/r/studio-ui/build/not-mocked),
 * so this test avoids it entirely rather than pull in Robolectric or
 * a JSON dependency for one small fixture file. */
private object TinyJson {
  fun int(json: String, key: String): Int =
    Regex("\"$key\"\\s*:\\s*(-?\\d+)").find(json)?.groupValues?.get(1)?.toInt()
      ?: error("index.json: missing integer field '$key'")

  /** The flat `"key": [1, 2, 3]` array of a top-level field. */
  fun intArray(json: String, key: String): IntArray =
    (Regex("\"$key\"\\s*:\\s*\\[([^\\]]*)\\]").find(json)?.groupValues?.get(1)
      ?: error("index.json: missing array field '$key'"))
      .split(",").map { it.trim().toInt() }.toIntArray()

  /** The `"key": { ... }` object body of a top-level field (no nested
   * `{`/`}` inside it, which is true of every object this fixture
   * writes) -- the caller then re-uses [intArray] on the returned
   * substring for a nested field. */
  fun objectBody(json: String, key: String): String =
    Regex("\"$key\"\\s*:\\s*\\{([\\s\\S]*?)\\}").find(json)?.groupValues?.get(1)
      ?: error("index.json: missing object field '$key'")
}

/**
 * Parity gate for [MoveNetHeadsDecoder] against a fixture banked by
 * `spikes/native/dump_heads_fixture.py`: the raw six heads from
 * `movenet-heads.tflite`, and the full fused `movenet-multipose.tflite`
 * graph's `[6,56]` answer on the SAME frames, for 12 frames off the
 * corpus (HEADS-REPORT.md section 3).
 *
 * A plain JVM test on purpose: [MoveNetHeadsDecoder] takes no
 * `Interpreter` at all, so this needs no Android runtime, no
 * instrumentation, no device.
 *
 * Tolerances follow HEADS-REPORT.md section 3's own python-vs-python
 * numbers (0 exact on coordinates/boxes, ~2e-7 on scores) with slack
 * for language/library differences (kotlin.math.exp rounds through
 * Double; numpy's exp is float32-native) that never touched the
 * python arm: coordinates and boxes are asserted to 1e-4, scores and
 * the instance score to 1e-4 as well, since a keypoint's score is the
 * one place `exp()` output reaches the tensor directly.
 */
class MoveNetHeadsDecoderParityTest {
  private val headOrder = listOf("center", "kpt_heat", "kpt_regress", "kpt_offset", "box_scale", "box_offset")

  private fun findFixtureDir(): File {
    System.getenv("TS_HEADS_FIXTURE_DIR")?.let {
      val f = File(it)
      if (f.isDirectory) return f
    }
    val userDir: String = System.getProperty("user.dir") ?: "."
    var dir: File? = File(userDir).absoluteFile
    repeat(12) {
      val candidate = File(dir, "spikes/native/out/heads-fixture")
      if (candidate.isDirectory && File(candidate, "index.json").isFile) return candidate
      dir = dir?.parentFile
    }
    fail(
      "cannot find spikes/native/out/heads-fixture from user.dir=$userDir" +
        " -- run `venv/Scripts/python spikes/native/dump_heads_fixture.py` first, " +
        "or set TS_HEADS_FIXTURE_DIR"
    )
    error("unreachable")
  }

  private fun readFloats(file: File, count: Int): FloatBuffer {
    val bytes = file.readBytes()
    assertTrue("${file.name}: expected $count floats (${count * 4}B), got ${bytes.size}B", bytes.size == count * 4)
    return ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
  }

  @Test
  fun matchesFullModelWithinTolerance() {
    val dir = findFixtureDir()
    val json = File(dir, "index.json").readText()
    val numFrames = TinyJson.int(json, "numFrames")
    assertTrue("fixture has 0 frames", numFrames > 0)

    val headShapesBody = TinyJson.objectBody(json, "headShapes")
    val hShape = TinyJson.intArray(headShapesBody, "center") // [1, H, W, 1]
    val h = hShape[1]
    val w = hShape[2]
    val k = TinyJson.int(json, "numKeypoints")
    val n = TinyJson.int(json, "maxInstances")
    assertTrue("expected 17 keypoints, got $k", k == MoveNetHeadsDecoder.NUM_KEYPOINTS)
    assertTrue("expected 6 instances, got $n", n == MoveNetHeadsDecoder.MAX_INSTANCES)

    val counts = mapOf(
      "center" to h * w * 1,
      "kpt_heat" to h * w * 17,
      "kpt_regress" to h * w * 34,
      "kpt_offset" to h * w * 34,
      "box_scale" to h * w * 2,
      "box_offset" to h * w * 2,
    )

    val decoder = MoveNetHeadsDecoder(h, w)

    // worst-case abs diff per output column class, across every frame
    var worstY = 0f
    var worstX = 0f
    var worstScore = 0f
    var worstBox = 0f
    var worstInst = 0f
    var frames = 0

    for (i in 0 until numFrames) {
      val stem = "frame%03d".format(i)
      val heads = headOrder.map { name -> readFloats(File(dir, "${stem}_$name.f32"), counts.getValue(name)) }
      val expected = readFloats(File(dir, "${stem}_expected.f32"), n * 56)

      val got = decoder.decode(heads[0], heads[1], heads[2], heads[3], heads[4], heads[5])
      assertTrue("decoder output size", got.size == n * 56)

      for (inst in 0 until n) {
        val base = inst * 56
        for (kk in 0 until 17) {
          val o = base + kk * 3
          worstY = maxOf(worstY, Math.abs(got[o] - expected.get(o)))
          worstX = maxOf(worstX, Math.abs(got[o + 1] - expected.get(o + 1)))
          worstScore = maxOf(worstScore, Math.abs(got[o + 2] - expected.get(o + 2)))
        }
        for (c in 0 until 4) {
          worstBox = maxOf(worstBox, Math.abs(got[base + 51 + c] - expected.get(base + 51 + c)))
        }
        worstInst = maxOf(worstInst, Math.abs(got[base + 55] - expected.get(base + 55)))
      }
      frames++
    }

    println(
      "MoveNetHeadsDecoder parity over $frames fixture frames: " +
        "kp_y=%.3e kp_x=%.3e kp_score=%.3e box=%.3e inst_score=%.3e".format(
          worstY, worstX, worstScore, worstBox, worstInst
        )
    )

    val coordTol = 1e-4f
    val scoreTol = 1e-4f
    assertTrue("kp_y worst=$worstY exceeds $coordTol", worstY < coordTol)
    assertTrue("kp_x worst=$worstX exceeds $coordTol", worstX < coordTol)
    assertTrue("kp_score worst=$worstScore exceeds $scoreTol", worstScore < scoreTol)
    assertTrue("box worst=$worstBox exceeds $coordTol", worstBox < coordTol)
    assertTrue("inst_score worst=$worstInst exceeds $scoreTol", worstInst < scoreTol)
  }
}
