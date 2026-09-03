# Native spike 2: splitting MoveNet at the heads (2026-09-03)

GPU-REPORT.md: MoveNet MultiPose Lightning is **112 of 237 nodes on the
TFLite GPU delegate, in 2 partitions**. The CenterNet decode tail
(TopKV2 / GatherNd / ArgMax / Range / Select) has no GPU kernels, so it
runs on the CPU *between* two delegate boundaries and costs ~120ms of
the 160ms p50 pass on the Redmi.

This spike cuts the graph at the six conv heads and re-implements the
tail. **Result: bit-exact on coordinates and boxes over 159 corpus
frames, ulp-level on scores, and the exported graph is 101 ops of
conv / depthwise / add / resize / logistic with nothing the delegate has
to refuse.** No device was touched; every number below is desktop.

Files added under `spikes/native/`: `movenet_decode.py` (the decoder),
`movenet_decode_port.py` (the shape the Kotlin port will have),
`extract_frames.py`, `heads_parity.py`, `heads_census.py`,
`heads_port_parity.py`, `heads_f16_attrib.py`, `heads_time.py`,
`heads_info.py`, `graph_dump.py` / `graph_dump2.py`, plus a
`movenet-heads` entry in `convert.py`. Nothing in `app/` was changed.

## 1. The exported model

`MODELS_ONLY=movenet-heads venv/Scripts/python convert.py`

| | full `movenet-multipose` | new `movenet-heads` |
|---|---|---|
| f32 bytes | 19,016,912 | **18,957,844** |
| f16 bytes | 9,579,928 | **9,535,696** |
| ops (f32) | 237, 36 kinds | **101, 8 kinds** |
| Flex / custom | none | **none** (`flex_check.py` exit 0) |

Input is unchanged: `serving_default_input:0` `[1,256,256,3]` **int32**,
raw 0..255.

Outputs (all float32, stride 4, so 64x64 for a 256x256 input):

| signature | tensor | shape | head |
|---|---|---|---|
| `PartitionedCall:0` | `StatefulPartitionedCall/Sigmoid` | `[1,64,64,1]` | centre heatmap |
| `PartitionedCall:1` | `StatefulPartitionedCall/Sigmoid_1` | `[1,64,64,17]` | keypoint heatmap |
| `PartitionedCall:2` | `.../kpt_regress_0/conv2d_8/BiasAdd` | `[1,64,64,34]` | keypoint regression (dy,dx) |
| `PartitionedCall:3` | `.../kpt_offset_0/conv2d_9/BiasAdd` | `[1,64,64,34]` | keypoint sub-cell offset (dy,dx) |
| `PartitionedCall:4` | `.../box_scale_0/conv2d_5/BiasAdd` | `[1,64,64,2]` | box (h,w) in grid units |
| `PartitionedCall:5` | `.../box_offset_0/conv2d_6/BiasAdd` | `[1,64,64,2]` | box centre offset (dy,dx) |

**Op histograms** (`heads_info.py`):

```
movenet-heads.tflite      101 ops  CONV_2D 54, DEPTHWISE_CONV_2D 26, ADD 13,
                                   RESIZE_BILINEAR 3, LOGISTIC 2, CAST 1, MUL 1, SUB 1
movenet-heads-f16.tflite  257 ops  the same 101 + DEQUANTIZE 156
movenet-multipose.tflite  237 ops  ... RESHAPE 31, GATHER_ND 5, STRIDED_SLICE 7,
                                   TOPK_V2 1, ARG_MAX 1, SELECT 2, SPLIT 1, TILE 1,
                                   EXP 1, REDUCE_MAX 1, MAX_POOL_2D 1, ...
```

No TopK / GatherNd / Range / Select / ArgMax survives. The CAST+MUL+SUB
are the input normalisation, already GPU-delegatable.

**NAME GOTCHA, cost one run.** `CompatMode.TFLITE`'s `split_all_fused_ops`
rewrites every `_FusedConv2D` named `X` into `X/Conv2D` + `X/BiasAdd`, so
the head tensor in the loaded graph is `.../BiasAdd/BiasAdd:0`, not the
`.../BiasAdd:0` the tfjs json shows. `Sigmoid`/`Sigmoid_1` keep theirs.

**NOT MEASURED: the delegate partition count on the phone.** The claim
that 101 conv/depthwise/add/resize/logistic ops delegate in ONE partition
follows from the op list and from blazeface/faceres already being 1
partition each -- it is not a reading off the device. The gain (~120ms)
is GPU-REPORT's attribution, not a re-measurement.

## 2. The decoder, and where it came from

`movenet_decode.py`. Derived from the 324 graph nodes downstream of the
six heads (`graph_dump2.py` prints them with their constants), not from a
paper. Structure mirrors TensorFlow Models' CenterNet meta-arch
(Apache-2.0, `object_detection/meta_architectures/center_net_meta_arch.py`):
`top_k_feature_map_locations` for step 1, `prediction_tensors_to_boxes`
for step 2, and the MoveNet multi-instance path
(`prediction_tensors_to_multi_instance_kpts` /
`_process_keypoints_for_multi_instance`) for steps 3-5. Read for
structure; written from the graph.

1. **Centres.** `MaxPool 5x5 SAME` on the centre heatmap; a cell survives
   when `|centre - maxpool| < 1.013279e-06`; suppressed cells are zeroed
   (not masked); `TopK k=6` over the flattened `[H*W]`.
2. **Boxes.** gather `box_scale` (clamped at 0) and `box_offset` at each
   centre cell; `centre +- hw/2`; clip to `[0,H]`/`[0,W]`; `*4` then
   `/256` (= `/H`); clip to `[0,1]`.
3. **Keypoint seeds.** gather `kpt_regress` at the centre cell, add the
   integer cell -> `[6,17]` (y,x) in grid units.
4. **Candidate search.** `score(y,x,n,k) = heat(y,x,k) *
   exp(-d2/(0.300049*min(H,W))) * inBox(y,x,n)`, `argmax` over `(y,x)`
   per `(n,k)`. In-box is `>= min`, `< max`, against the **clipped
   grid-unit** box.
5. **Refine + score.** add `kpt_offset` at the chosen cell, normalise by
   `H`/`W`. Instance score = `centre_score * mean over keypoints above
   0.126953 of their score`, denominator `max(count, 1)`.

**Three places the graph contradicts the brief or the reference, and the
graph wins:**

- **The NMS window is 5x5, not 3x3.** `StatefulPartitionedCall/MaxPool`
  `ksize [1,5,5,1]`. Reference CenterNet defaults to 3.
- **A keypoint's reported score is the max over ALL SIX instances at its
  chosen cell**, not this instance's own value: `Max` reduces `mul_9`
  over the instance axis *before* `GatherNd_4`. It reads like an upstream
  bug; reproducing it is the point.
- **The score written into the output tensor is the UNthresholded one.**
  `ExpandDims_6` is fed from `Reshape_20`, not from `Select`. The 0.126953
  threshold only gates the instance-score mean and its denominator.

Two constants are f16 quantizations of round numbers, because the shipped
tfjs weights are quantized: `1.013279e-06` (1e-6), `0.300049` (0.3),
`0.126953` (0.127).

**Layout confirmed against the shipped consumer**, `person-gate.mjs`
`parsePersons` (`data[o+k*3 .. +2]`, `o+51..54`, `o+55`):
`[1,6,56]` = `17 x (y, x, score)` then `ymin,xmin,ymax,xmax` then score,
y/x normalised.

## 3. Parity

Bank: `extract_frames.py`, ffmpeg, one frame every 12s from each of the
ten `Z:\tamescroll-corpus\video\*.mp4`, scaled-to-fit and padded to
256x256 exactly as `crop-geometry.fitBox` does. **159 frames, 110 of
which contain at least one slot over `PERSON_MIN_SCORE` 0.35, 138
admitted slot-instances** (249 over 0.12, 213 over 0.2). Per video:
25 / 9 / 10 / 14 / 11 / 6 / 17 / 13 / 9 / 24.

Reference is `out/movenet-multipose.tflite` (f32, XNNPACK 4 threads) on
the identical input bytes.

`heads_parity.py` / `heads_port_parity.py`, 159 frames:

| arm | kp y | kp x | kp score | box | inst score | admitted-set mismatches |
|---|---|---|---|---|---|---|
| f32 heads + `movenet_decode.decode` | **0** | **0** | 2.09e-07 | **0** | 1.19e-07 | **0/159** |
| + box-restricted search | **0** | **0** | 2.09e-07 | **0** | 1.19e-07 | **0/159** |
| + box-restricted + separable exp | **0** | **0** | 2.38e-07 | **0** | 1.19e-07 | **0/159** |

Coordinates and boxes are **bit-identical**; the only movement is one ulp
on the two score fields. Target was `< 1e-3`. Admitted-set is compared at
all three gates the shipped `person-gate.mjs` uses -- `PERSON_LOW_SCORE`
0.12, the brief's 0.2, and `PERSON_MIN_SCORE` 0.35 -- and **0/159** at
every one; slot ORDER is identical too (top-k is score-sorted, and no
frame moved an instance score by more than 1.19e-07).

### f16 heads: NOT a parity arm, and the divergence is the weights

| arm (vs full f32) | kp y | kp x | kp score | box | inst score |
|---|---|---|---|---|---|
| f16 heads + decoder, all slots | 9.771e-01 | 1.011e+00 | 8.945e-01 | 9.773e-01 | 4.209e-02 |
| f16 heads + decoder, admitted (>0.2) | 3.299e-02 | 6.521e-02 | 3.996e-01 | 2.384e-02 | 4.209e-02 |
| **full f16 graph, same decoder both sides** | 9.771e-01 | 1.011e+00 | 8.945e-01 | 9.773e-01 | 4.207e-02 |

`heads_f16_attrib.py` runs the FULL f16 graph against the FULL f32 graph,
so the decoder is identical on both sides: it reproduces the same numbers
to four digits. **The f16 divergence is entirely the weights; the decoder
contributes nothing.** The whole-frame figures are empty slots whose
argmax flips across the frame in noise. This is consistent with the
shipped `MODEL_FP16 = setOf(2)` -- MoveNet already ships f32 -- so
`movenet-heads.tflite` (f32, 18.96MB) is the one to deploy and
`movenet-heads-f16.tflite` exists only as the measured refusal.

## 4. Timings (desktop, TFLite XNNPACK 4 threads, 159 frames)

| | ms/frame |
|---|---|
| full `movenet-multipose.tflite` | 19.4 |
| `movenet-heads.tflite` | 13.9 |
| **implied TFLite tail cost** | **5.5** |
| `movenet_decode.decode` (literal, numpy) | 6.18 p50 / 7.55 p95 |
| `movenet_decode_port.decode` (box-restricted + separable, numpy) | **0.76 p50 / 1.07 p95** |

Where the literal decoder's 6.2ms goes: maxpool+peak+topk 0.31ms, the
`[H,W,N,K]` distance+exp 2.49ms, heat multiply + argmax 1.11ms.
Stage 4 is `64*64*6*17 = 417,792` cells, `~4.2M` float ops of which
`0.42M` are `exp()`.

Two exact optimisations take that to 0.76ms and are what the port should
do (both proved above at 0/159 mismatches):

- **Box restriction.** The score is 0 outside the instance's box, so only
  the box needs scanning. Box area over the bank: **p50 0.051, mean
  0.082, p90 0.213** of the frame -- ~8% of the work. Exact because TF's
  `ArgMax` returns the lowest flat index among equal maxima and every
  out-of-box cell is exactly 0: an in-box max > 0 IS the global argmax,
  and an in-box max <= 0 means the global argmax is flat index 0.
- **Separable weight.** `exp(-(dy2+dx2)/s) = exp(-dy2/s) * exp(-dx2/s)`
  turns 418k `exp()` into `2*64*6*17 = 13k` plus a multiply. Costs one
  extra ulp on the keypoint score (2.09e-07 -> 2.38e-07) and flipped no
  argmax on 159 frames.

## 5. Kotlin port plan (plan only -- no code written)

### What arrives

`Interpreter.runForMultipleInputsOutputs` fills six direct
`ByteBuffer`s in native (little-endian) order, NHWC float32, in
`getOutputTensor(i)` order. `buildModel` already allocates them from
`interp.getOutputTensor(i).numBytes()`. Element counts and layouts:

| head | floats | index of (y, x, c) |
|---|---|---|
| centre | 4,096 | `y*64 + x` |
| kpt_heat | 69,632 | `(y*64 + x)*17 + k` |
| kpt_regress | 139,264 | `(y*64 + x)*34 + 2k` (+1 for dx) |
| kpt_offset | 139,264 | `(y*64 + x)*34 + 2k` (+1 for dx) |
| box_scale | 8,192 | `(y*64 + x)*2 + {0:h, 1:w}` |
| box_offset | 8,192 | `(y*64 + x)*2 + {0:dy, 1:dx}` |

Total 368,640 floats = 1.47MB across six buffers, against the 1,344
floats (5.4KB) that go back to the page. Read them through
`asFloatBuffer()` once into `FloatArray`s (or index the `FloatBuffer`
directly -- `get(i)` on a direct buffer is an intrinsic; measure before
copying 1.47MB per frame).

**Do not tie the head order to the shape.** Two heads are `[.,.,34]` and
two are `[.,.,2]`. Bind by `getOutputTensor(i).name()` (already captured
in `LoadedModel.outputNames`) or by asserting the signature order
`PartitionedCall:0..5` at load, and fail the model if it does not match.

### The loops

```
decode(heads) -> FloatArray(6*56)                       # H=W=64, K=17, N=6
  1  peakScore = FloatArray(4096)
     for y,x: m = max over the 5x5 SAME window of centre   # 102k compares
               peakScore[y*64+x] = if (|c-m| < 1.013279e-6) c else 0
     top-6 of peakScore, descending, ties on the LOWER index
       -> a 6-element insertion sort over 4096, no allocation
  2  per instance n: gather box_scale/box_offset at (cy,cx); +-hw/2;
     clip to [0,64]; store BOTH the grid-unit box (for the mask) and the
     /64 normalised box (for the output)
  3  per instance n, per keypoint k: seed = cell + kpt_regress    # 102 gathers
  4  instMax = FloatArray(4096*17) zeroed once per frame          # 70k floats
     per instance n:
       y0 = ceil(ymin); y1 = ceil(ymax); x0 = ceil(xmin); x1 = ceil(xmax)
       clamp to [0,64]; skip the instance entirely if empty (best = 0)
       expY[K][y1-y0], expX[K][x1-x0] = exp(-(d*d)/19.2)          # ~13k exp
       for y in y0..y1, x in x0..x1, k in 0..16:                  # ~34k*17
         s = heat[(y*64+x)*17+k] * expY[k][y-y0] * expX[k][x-x0]
         if (s > instMax[...]) instMax[...] = s
         if (s > bestVal[n][k]) { bestVal = s; bestIdx = y*64+x }
       best[n*17+k] = if (bestVal > 0) bestIdx else 0
  5  per (n,k): (by,bx) from best; kp_y = (by + kpt_offset[..2k])/64,
     kp_x = (bx + kpt_offset[..2k+1])/64, kp_score = instMax[(by*64+bx)*17+k]
  6  above = kp_score > 0.126953; inst = centreScore *
       (sum of above scores) / max(count,1)
  write 17*(y,x,score), then 4 box floats, then the score
```

`instMax` must be built over ALL instances before step 5 reads it (that
is the instance-max quirk), so step 4 is two passes or one pass that
defers step 5 -- one `FloatArray(69632)` allocated once with the model,
zeroed per frame (`java.util.Arrays.fill`, 70k floats, negligible).

Everything is `FloatArray` / `IntArray` allocated once at load and reused;
zero allocation per frame. Runs on `ts-infer`, inside the same
`try/catch` that already guards `run(model)`.

### Cost on the phone (ESTIMATE, unmeasured)

The chain: the TFLite tail costs **5.5ms on desktop** (19.4 - 13.9).
GPU-REPORT's Redmi XNNPACK MoveNet is 230.9ms against 19.4ms desktop for
the same graph = **11.9x**, which is the honest desktop->Redmi scale for
float work here. That puts the TFLite tail at ~65ms of Redmi CPU
(consistent with GPU-REPORT's ~120ms attribution, the rest being the two
delegate boundaries and the GPU clocking between them). The port-shaped
decoder is **7.2x cheaper than TFLite's tail on the same machine**
(0.76 vs 5.5ms), because of the box restriction and the separable exp.
65 / 7.2 = **~9ms**.

Cross-check by op count: ~34k in-box cells x 17 keypoints x ~4 flops =
2.3M flops, plus 13k `exp()` (~25 cycles each = 0.33M), plus 102k maxpool
compares -- call it ~3M cycles, ~1.5ms on a 2.0GHz A75 at 1 op/cycle
scalar. The two estimates bracket **2-10ms**, against ~120ms today.
**Neither is a measurement.** The whole gain rests on the delegate taking
the heads model in one partition, which is also unmeasured.

Second-order: a fixed-size box makes the loop bound data-dependent, so a
frame with six large boxes costs ~6x a frame with six small ones (p90
area 0.213 vs p50 0.051). Worst case is all six boxes at the full frame:
418k cells, ~10x the mean -- still bounded and still an order of
magnitude under the tail it replaces.

### Wiring into NativeInfer.kt

`app/src-tauri/gen/android/app/src/main/java/app/tamescroll/client/NativeInfer.kt`.
The page reads `personReply.outputs[0]` as a `Float32Array` of 6*56
(`native-client.mjs:437` -> `parsePersons`), so **if modelId 3 replies one
buffer of 1,344 floats, `native-client.mjs` and `native-frame.mjs` are
untouched.**

1. `MODEL_ASSET`: `3 to "movenet-heads"`. `MODEL_REPORT_NAME` stays
   `"movenet"` so the About report and `native.models.person.nativeBackend`
   do not rebase. `MODEL_FP16` still excludes 3 (section 3 above).
2. `LoadedModel` gains a nullable `decoder` holding the scratch arrays
   (`instMax`, `expY`, `expX`, `best`, `bestVal`, the 6x56 output) and the
   resolved head->output-index map, built in `buildModel` from
   `outputNames`. Null for models 1 and 2.
3. `LoadedModel` gains `replyBuffer: ByteBuffer?` -- one direct
   `allocateDirect(6*56*4)` in native order, allocated at load. On model 3
   `handleFrame` calls `decode` after `run(model)` and passes
   `arrayOf(replyBuffer)` to `reply(...)` instead of `model.outputBuffers`.
   `reply` already writes `[u32 byteLength] + data` per output and needs
   no change.
4. `postReady`'s `outputs` list for model 3 must publish ONE synthetic
   name (the page logs it; it does not parse it). Publishing the six real
   head names would tell the page it is getting six tensors.
5. `outputsAgree` (the NNAPI arbiter) compares `outputBuffers`, i.e. the
   six RAW heads -- which is what it should compare: the decoder is
   deterministic, so head agreement implies output agreement, and six
   heads is a far stricter test than one [1,6,56]. Its 2%-of-max-abs bar
   applies per head; the regression/offset heads are unbounded signed
   values, so watch that this does not become a hair trigger. No code
   change, but re-read the first NNAPI trial log on the Redmi.
6. `bestRunMs` / the trial path time `run(model)` only, so the decode is
   NOT in the arbiter's clock. Either accept that (the decode is the same
   on every delegate) or add it to both sides.
7. Asset: `assets/models/movenet-heads.tflite`. `assets/models/*.tflite`
   are gitignored; `spikes/native/convert.py` regenerates them. The GPU
   kernel-cache token is `"$assetBase-$VERSION_CODE-${bytes.remaining()}"`
   so the new file name and length invalidate the old cache
   automatically. **APK size is unchanged** (18.96MB vs 19.02MB) as long
   as the old `movenet-multipose.tflite` is REMOVED from assets, not left
   beside it.
8. Ship it behind a dial, the way every other arm in this batch ships:
   the page can already force a model to CPU via `NATIVE_CPU_MASK`, but
   there is no way to go back to the fused graph without a build. Either
   keep both assets and pick by a `NATIVE_MOVENET_SPLIT` flag through the
   existing CONFIG request (costs 19MB of APK), or accept a build-time
   swap. That is an owner call; the parity above says the answer is not
   forced by risk.

### What is NOT covered

- No device run. The 2 partitions -> 1 claim, the ~120ms gain, and the
  ~9ms decode are all unmeasured on the Redmi.
- The bank is 159 frames from ten corpus videos at 256x256 letterboxed.
  A 0/159 admitted-set match is a bound, not a proof; a tie in the
  centre-heatmap top-k or in the stage-4 argmax is where a divergence
  would live, and neither occurred here.
- `unpadPersons` and everything downstream of `parsePersons` is untouched
  and untested by this spike -- the tensor it consumes is byte-identical,
  which is the point.
