# One distilled student for the three video models — recipe, 2026-09-03

Owner ask: replace MoveNet MultiPose + BlazeFace + HSE-FaceRes with ONE
distilled student. Trained on his own RTX 3060 Ti, run length
unconstrained (re-scoped mid-run; the 1-hour and cloud arms survive as
two rows of §3's table). Teacher labelling precomputed separately.

**M** = measured in this repo on a device. **S** = a published source
says so, URL given. **G** = my estimate with the arithmetic shown.
No device was run for this document.

---

## 0. Read this before the recipe — three facts that change the shape

**(a) This is a LATENCY project. It cannot be an accuracy project, and
that is already measured.** `docs/research/custom-model-2026-09-02.md`
§3 replayed the shipped decision layer with a *perfect* gender oracle
substituted for every labelled crop: total scored error falls **13.7%
in man mode, 24.1% in woman mode** (M). The other 76-86% is geometry,
association and coasting. A distilled student is, by construction,
**worse than its teachers** — so its accuracy ceiling is *below* an
arm that is itself worth 14-24%. That doc's verdict on this exact
option was "**NO-GO for accuracy, GO-IF for latency only**". Nothing
below reverses it. Everything below is the latency case.

**(b) Most of the latency prize needs no training at all.** Measured on
the Redmi (Adreno 610, TFLite GPU delegate, `spikes/native/GPU-REPORT.md`), M:

| model | p50 | delegated | note |
|---|---|---|---|
| MoveNet MultiPose 256 | **160ms** | **112 of 237 nodes, 2 partitions** | TopK/GatherNd/Range/Select decode tail runs on CPU |
| BlazeFace 256 | 19ms | 100%, 1 partition | |
| faceres 224 | 38ms × 2 crops = 76ms | 100%, 1 partition | |
| **one verdict** | **255ms** | | MoveNet = **63%** |

Fit a cost model to the two fully-delegated rows:
`t_ms ≈ 18 + 32 × GMACs` (blazeface ~0.05 GMACs → 20ms, measured 19;
faceres ~0.6 GMACs → 37ms, measured 38). Apply it to MoveNet
(~0.55 GMACs): its *compute* should be **~36ms**. It costs 160.
**~120ms of MoveNet is two delegate boundaries and a CPU decode tail,
not arithmetic** — which GPU-REPORT.md already concluded on its own
("splitting the model at the heatmaps and decoding in Kotlin or the
page is the next MoveNet win"). Cutting the graph after the heatmaps
and porting the decode is **days of work, zero training, zero new
weights, zero licence question, and it takes the pass 255 → ~135ms**.

That is ~65% of the student's entire prize. **Do it first.** If it is
not done first, the student's A/B is measured against a baseline that
was leaving 120ms on the table, and the number will be wrong.

**(c) The corpus is 2,160 frames.** Counted today from
`Z:/tamescroll-corpus/bank/reads/*.json`: 18 windows × 120 frames,
sampled at **2 fps over 60s each, 640×360** (M). 3,465 face crops come
out of those 2,160 frames. That is an *evaluation* set. It is two
orders of magnitude short of a training set, and building the training
set is the largest single line item in §7 — and the one with the
licence problem in §6.

The 10 source mp4s beside it are **15,238 s = 4.23 hours** of 640×360
video (measured today, `ffprobe`), which is ~76k frames at 5 fps but only
**ten videos** of it. Enough to prove speed (§8), nowhere near enough to
prove accuracy.

---

## 1. Architecture

### 1.1 The constraint nobody can design around: a face is 38-62px

His player decodes **640×360** (M, CLAUDE.md loop 38) and faces reach
the pipeline at **38-62 native px** (p50 64.1 across the whole corpus;
26.8% sit inside 38-62; 49.9% are under 64px — M,
custom-model-2026-09-02 §1).

Today that is survivable *because the pipeline zooms*: MoveNet finds a
person box, `personCropRegion` crops it to 256px long side, and
BlazeFace sees the face at roughly **50-100px of model input**. The
2026-08-24 redesign says so explicitly in the threshold registry:
*"person crops make small faces big, so no rescue floor / recheck
needed"*.

**A single-shot student on the full frame throws that away.** Arithmetic:

| student input | scale from 640 wide | face at model input | face footprint at stride 8 / stride 4 |
|---|---|---|---|
| 256×256 (squashed, as MoveNet is fed today) | 0.40× | **15-25px** | 2-3px / 4-6px |
| 320×192 (16:9, no squash) | 0.50× | **19-31px** | 2-4px / 5-8px |
| 448×256 (16:9) | 0.70× | 27-43px | 3-5px / 7-11px |

A 15-25px face at stride 8 is 2-3 feature cells. That is at or under
BlazeFace's operating floor and it is exactly the regime this repo has
never had a recall number for (custom-model §4c: *"detector recall is
the one error class in this product that has never been measured"*).

**Two free corrections fall out of that table and both should be taken:**

1. **Never square-squash.** 320×192 costs 61,440 px against 256×256's
   65,536 — *the same compute* — and buys 25% more horizontal
   resolution with no 1.78:1 distortion. This repo has been bitten by
   the squash twice already (16a on the faceres crop, 16b on MoveNet,
   where letterboxing moved persons admitted 219 → 269 over 241 frames,
   M). We are training the model, so we choose its input shape: make it
   16:9.
2. **Put the face head at stride 4, not stride 8.**

### 1.2 Recommended: TWO networks, not one

| | S1 — dense | S2 — attribute |
|---|---|---|
| replaces | MoveNet + BlazeFace | faceres |
| input | **320×192 RGB, uint8, 16:9** | **112×112 face crop** (aspect-preserving, `crop-geometry.squareBox`, 1.4× enlarge — unchanged) |
| backbone | **MobileNetV3-Large 1.0**, truncated after stride-16 block | **MobileNetV3-Small 1.0** |
| neck | 64-ch FPN, strides 4 / 8 / 16 | none |
| heads | person centre heatmap [48×80×1]; person size [.,2]; person offset [.,2]; **17 keypoint heatmaps [48×80×17] + offsets [.,34]**; face centre heatmap **at stride 4** [96×160×1] + size [.,2] + offset [.,2] | gender sigmoid [1]; age softmax [100]; descriptor [128], **un-normalised** |
| GMACs | **~0.38** (G: 0.22 backbone at this area + 0.16 neck/heads) | **~0.015** |
| decode | **outside the graph** — no TopK, GatherNd, Range, Select, NMS | n/a |

**Why two and not one.** A single backbone that does dense detection on
the frame *and* per-face attributes needs ROI-align on a feature map. At
320×192 input, a 40px face is 5×8 cells at stride 4 — ROI-aligned to 7×7
that is an *upsample of a feature map that never saw the face at
resolution*. Gender at 38-62px is already the weakest thing this
pipeline does (per-cluster female recall 0%, 16%, 30%, 42% on 7 of 22
woman clusters — M, custom-model §2c); feeding it a 5×8 ROI instead of a
112×112 crop of native pixels is a change in the exposure direction. S2
is 0.015 GMACs — **it is cheaper than the fixed per-inference overhead
on this GPU** (§5), so merging it saves essentially nothing and costs
the thing that matters. Keep the crop.

Everything else *does* merge: person boxes, keypoints and face boxes all
come off one backbone in one pass, which is where 179ms of the 255 lives.

**Why CenterNet-style dense heads and not anchors.** The output must be
plain conv tensors so the graph is 100% GPU-delegatable — that is fact
(b) above, and it is worth more than any architecture nicety. Anchor
decode, NMS and TopK go to Kotlin (`NativeInfer.kt`) and to
`person-gate.mjs`, which already owns exactly this decode for MoveNet's
[1,6,56] and BlazeFace's anchor grid. CenterNet: <https://arxiv.org/abs/1904.07850>.

**Why keypoints at all — do not drop them.** `person-gate.mjs` does not
consume MoveNet's box. It builds the patch from the **keypoint union**:
all 17 keypoints extend the patch (`UNION_KEYPOINT_MAX 17`), evidence is
counted over 0-12 (`EVIDENCE_KEYPOINT_MAX 13`), and the top edge is
pinned `HEAD_ANCHOR_UP 1.6` head-widths above the head keypoints. A
box-only student silently deletes the geometry layer. All 17, with
per-keypoint scores.

### 1.3 Pretrained weights — licence, exact

Hard rule: MIT / Apache-2.0 / BSD only, never GPL/AGPL/non-commercial.

| candidate | licence of the **weights** | verdict |
|---|---|---|
| `timm/mobilenetv3_small_100.lamb_in1k` | **Apache-2.0** (HF model card) <https://huggingface.co/timm/mobilenetv3_small_100.lamb_in1k> | **USE** |
| `timm/mobilenetv3_large_100.ra_in1k` (repo Apache-2.0; confirm card) | Apache-2.0 | **USE** — check the card, timm licences per-checkpoint |
| `timm/mobilenetv4_conv_small.e2400_r224_in1k` | **Apache-2.0** <https://huggingface.co/timm/mobilenetv4_conv_small.e2400_r224_in1k> | usable alternative |
| `timm/tf_efficientnet_lite0.in1k` | **Apache-2.0** <https://huggingface.co/timm/tf_efficientnet_lite0.in1k> | usable; 0.407 GMACs @224 is ~2× MobileNetV3-Large for +0.9 top-1 — not worth it here |
| torchvision `mobilenet_v3_*` IMAGENET1K | **code BSD-3; weights licence UNSTATED.** torchvision's README says pretrained models "may have their own licenses… derived from the dataset used"; only SWAG weights are flagged CC-BY-NC <https://github.com/pytorch/vision> | **AVOID** — ambiguous by omission, and this app publishes its weights |
| MediaPipe / BlazeFace | Apache-2.0 <https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE> | teacher only |
| MoveNet MultiPose | Apache-2.0 per this repo's NOTICE; the Kaggle model card was **not re-verified this session** — re-check before relying on it | teacher only |
| MobileFaceNet architecture | fine; its published **weights are trained on MS-Celeb-1M, WITHDRAWN 2019** (custom-model §5) | architecture yes, weights **never** |

MobileNetV3: 219 MAdds / 75.2% top-1 (Large), 66 MAdds / 67.4% (Small)
at 224 — <https://openaccess.thecvf.com/content_ICCV_2019/papers/Howard_Searching_for_MobileNetV3_ICCV_2019_paper.pdf>.

**Teacher outputs are not encumbered.** Apache-2.0 (MoveNet, BlazeFace)
and MIT (faceres) place no restriction on inference outputs. The licence
problem is the *frames*, §6.

---

## 2. Distillation losses, per head

Distil at the **output** level (the teachers' decoded results as soft
targets), not the feature/logit level. That decouples the student
entirely from MoveNet's [1,6,56] slot layout and BlazeFace's anchor
grid, which is the only reason a single-backbone student is possible.

| head | teacher signal | loss | weight (start) |
|---|---|---|---|
| person centre | MoveNet slot centres, Gaussian-splatted σ ∝ √(box area) | penalty-reduced focal (CornerNet α=2, β=4) | 1.0 |
| person size / offset | slot box w,h and sub-cell offset | L1 on positives only | 0.1 / 1.0 |
| **person score** | MoveNet's slot score, **as a continuous target** | MSE on logit | **1.0 — see below** |
| keypoints (location) | 17 (y,x), Gaussian heatmaps + offsets | MSE on heatmap, L1 on offset, **masked by teacher keypoint score ≥ 0.1** | 1.0 / 1.0 |
| **keypoint scores** | MoveNet's 17 per-keypoint scores, continuous | BCE against the soft score | **1.0 — see below** |
| face centre (stride 4) | BlazeFace post-NMS boxes, run **on the person crops as today** so small faces are labelled from the zoomed view | focal, as person | 1.0 |
| face size / offset | box w,h, offset | L1 on positives | 0.1 / 1.0 |
| gender | faceres **raw sigmoid v**, continuous | BCE on soft target + MSE on the logit | 2.0 |
| age | faceres 100-bin softmax | **KL divergence over the full distribution, T=1** | 1.0 |
| descriptor | see §2.2 | see §2.2 | 0.5 |

### 2.1 The three targets that are easy to get wrong

**Scores are gates, not confidences to be re-learned.** `person-gate.mjs`
thresholds MoveNet's numbers in nine places — `PERSON_MIN_SCORE 0.35`,
`PERSON_LOW_SCORE 0.12`, `PERSON_HOLD_SCORE 0.22`,
`PERSON_KEYPOINT_MIN 0.3`, `PERSON_KEYPOINT_EXIT 0.22`,
`PFF_FRAME_KP_FLOOR 0.1`, `PERSON_WEAK_MAXKP 0.25`, `PERSON_STRONG_KEYPOINTS 7`,
`PERSON_MIN_KEYPOINTS 5`. Every one of those constants was calibrated
against **MoveNet's score distribution**. A student trained to maximise
detection AP will produce a *differently calibrated* score and silently
invalidate all nine. Train the score heads to reproduce the teacher's
number, and report **calibration error (ECE / a reliability plot at the
nine thresholds)**, not AP.

**Gender must reproduce `v`, not the label.** `gender-verdict.mjs`
consumes the raw sigmoid at `GENDER_MIN_SCORE 0.25`,
`GENDER_CLEAR_SCORE 0.45`, `_FEMALE 0.35`, `GENDER_INSTANT_CLEAR 0.8`,
`_FEMALE 0.7`, and the null band `NULL_V_LO 0.53` / `NULL_V_HI 0.72`.
A student that gets the argmax right and the value wrong breaks the null
band, which is the gate holding back "random blur marks here and there".
Soft-target BCE, and the acceptance metric is **|v_student − v_teacher|
p50/p95 and the flip rate at each of those six bars** — the same shape as
the loop-34 faceres requant test that killed uint8 (8 of 100 verdicts
flipped).

**Age is consumed as an integral, so distil the whole distribution.**
`childP` is the mass under 18 (`GENDER_CHILD_MASS 0.25`) and the null
band tests the *mean* being inside [34, 42]. detection-engine.md's own
finding: *"a mean over a bimodal posterior lands where no mass is"*.
Cross-entropy on the argmax bin would destroy exactly the property that
made the child gate work (10 of 10 reads on an 8-year-old caught vs 2 of
10 for the mean gate, M). **KL on all 100 bins.**

### 2.2 The descriptor head — the honest answer

**128-d is not the problem.** MobileFaceNet gets 99.55% LFW from a 128-d
embedding at <1M params — <https://arxiv.org/abs/1804.07573>.
Dimensionality is not what limits us.

**The teacher is the problem.** faceres' 1024-d descriptor, measured in
this repo on 128 same-person and 65 same-frame different-person pairs:
same-person median 0.90 but **5th percentile 0.28**, while **different
people score ≥0.6 in 32% of pairs and ≥0.9 in 17%** (M,
detection-engine.md registry). identity-memory.mjs says it in one line:
*"the descriptor's separability is genuinely poor… the safety here does
NOT rest on the match being right."* A distilled student inherits that
and adds its own loss. **Distilling this head buys a worse copy of a
signal that already has no operating point.**

Three options, in order of what I would actually do:

1. **Ship the head, distil it, expect nothing.** Loss:
   `1 − cos(P·s₁₂₈, t₁₀₂₄)` with a learned frozen-after-warmup linear
   projection P (1024→128) fitted by PCA on the teacher bank, **plus an
   explicit MSE on the pre-L2 magnitude**. The magnitude is not
   cosmetic: `nm` = descriptor magnitude before normalisation is a
   **shipped gate**, `NULL_MINT_NM_FLOOR 5`, calibrated on ground truth
   (0 of 125 real faces refused at 5, 5 of 125 at 6 — M). A student that
   L2-normalises in-graph, or that is trained on cosine alone, destroys
   `nm` and silently disables the null-mint birth refusal. **Emit the
   descriptor un-normalised and make its magnitude a training target.**
   Realistic: cosine agreement with the teacher **0.95-0.98** (G, by
   analogy with this repo's own f16 faceres measurement of 0.9973 for a
   *numerically identical* graph — a distilled 128-d student will be
   materially worse), and same-person/different-person separation **no
   better than the teacher's, i.e. still no operating point**.
2. **Train it instead of distilling it** — the only head that could
   *beat* its teacher. Supervision exists: 107 identity clusters, 2,385
   labelled reads. Sub-center ArcFace on cluster labels, split by
   cluster. But 107 identities is a very small ID set, and track-ID
   supervision is not a rescue (identity-memory.mjs: *"the median run of
   a single id is ONE FRAME"*).
3. **Drop the head for v1.** It costs bytes and training time for a
   signal whose own module says it is carried by guards rather than by
   accuracy. Re-add it once §7's device A/B has landed.

**Recommendation: (1) for v1** — because dropping it changes the shipped
behaviour of `identity-memory.mjs` and `NULL_MINT_NM_FLOOR` at the same
time as everything else, and that makes the A/B unreadable.

---

## 3. Compute budget

### 3.1 The throughput number, derived twice

RTX 3060 Ti: 4,864 CUDA cores, 8GB GDDR6, 448 GB/s, **16.2 TFLOPS FP32**;
3rd-gen tensor cores quoted at 129.6 Tensor-TFLOPS **with sparsity**, so
**dense FP16-with-FP32-accumulate ≈ 32.4 TFLOPS** — that is what
`torch.amp` actually gets. (S: <https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3060-3060ti/>)

*Route 1 — FLOPs.* S1 forward ≈ 0.38 GMACs = 0.76 GFLOPs; train step
≈ 3× = **2.3 GFLOPs/image**. Depthwise-separable nets are
memory-bandwidth and kernel-launch bound and reach **5-15% of tensor
peak** → 1.6-4.9 TFLOPS effective → **700-2,100 img/s**.

*Route 2 — anchor to a measured card.* An RTX 3060 measured **8.12
it/s at batch 16 = 130 img/s** training ResNet-50 @224 **FP32**
(<https://arxiv.org/html/2508.18206v1>). 3060 Ti ≈ 1.25× → 163; AMP ≈ 2×
→ ~330 img/s at 24.6 GFLOPs/img = **8.1 TFLOPS effective for a dense
conv net**. S1 is 10.7× cheaper per image but will not get 10.7× the
throughput; at the 5-15% utilisation band that is **700-1,400 img/s**.

**Take 1,000 img/s central, 700 worst case (G).** S2 at 0.015 GMACs @112
is overhead-dominated: **~6,000 crops/s (G)**.

**The real risk is the dataloader, not the GPU.** 200k frames at
320×192 raw uint8 is 184 KB each — 37 GB, and 184 MB/s sustained at
1,000 img/s. Store **JPEG q90 at 320×192 (~12 KB, 2.4 GB total)** and
decode with 6-8 workers (~2,500 decodes/s/core), or use NVIDIA DALI.
Z: is the only drive with room (CLAUDE.md: C: is nearly full); **if Z:
is spinning rust this becomes the bottleneck and the whole estimate is
wrong** — measure `img/s` with a synthetic loader on step 1 of day 3.

### 3.2 Dataset size and epochs to reach parity

| | frames / crops | epochs to converge (G) | image-steps | wall clock at 1,000 / 6,000 per s |
|---|---|---|---|---|
| S1, backbone frozen (warmup) | 200k | 5 | 1.0M | 0.3h (2,500/s frozen) |
| S1, full fine-tune | 200k | 60 | 12.0M | **3.3h** |
| S2 attribute head | 600k crops | 60 | 36.0M | **1.7h** |
| **one complete run** | | | | **≈ 5h** |

60 epochs on 200k frames from an ImageNet-pretrained backbone is past
convergence for pseudo-label distillation; 30-40 will likely do. Budget
**3-4 runs** to settle loss weights, the focal/L1 balance and the stride-4
face head → **15-20 GPU-hours ≈ 3 nights**.

**200k frames is the number to hit**, from ~150-400 videos of matched
content sampled at 1-2 fps. The 2,160-frame corpus (§0c) is the
**held-out evaluation set and nothing else** — it must never enter
training, or §7's re-score is meaningless.

### 3.3 The three budgets side by side

| arm | throughput (G) | image-steps in the budget | S1 person+kp | S1 face@stride4 | S2 gender+child | S2 descriptor | $ |
|---|---|---|---|---|---|---|---|
| **Local 3060 Ti, unconstrained (~5h/run × 4 runs, 3 nights)** | 1,000 img/s | 12M + 36M per run | **parity attempt — the plan** | **yes** | **yes** | yes, teacher-limited | **$0** (~7 kWh ≈ $1 of power) |
| **Local 3060 Ti, 1 hour** | 2,500 img/s frozen backbone, heads only | 9M | heads-only, **~70-85% of full-finetune quality (G)** | marginal — the small-face head is what needs backbone gradients | **yes, comfortably** (S2 is cheap) | no | $0 |
| **Rented A100 80GB, 1 hour** | ~3,000 img/s (G: ~3× the 3060 Ti — 2,039 GB/s, larger batch; depthwise nets do not scale with tensor peak) | 10.8M | **full S1 run fits in the hour** | yes | run S2 after, +0.6h | yes | **$1.19-1.99** RunPod, **$1.99** Lambda 1×A100 SXM |

Prices: RunPod A100 80GB PCIe $1.19 Community / $1.39 Secure, H100 $1.99/$2.89,
RTX 4090 $0.34/$0.74 — <https://www.runpod.io/pricing>. Lambda 1×A100 80GB SXM
$1.99/hr, 1×H100 $4.29/hr — <https://lambda.ai/service/gpu-cloud>.
Vast.ai A100 ~$0.68-1.09, 4090 ~$0.12-0.59, marketplace, no SLA.
Colab Pro $9.99/mo/100 compute units, A100 40GB burn rate disputed
(third-party sources disagree 2×; Google does not publish it) — Pro+
allows up to 24h continuous. Kaggle free: **P100 or 2×T4, 30 GPU-h/week,
12h max session** (<https://www.kaggle.com/product-feedback/173129>) —
a P100 is ~0.6× the 3060 Ti for this workload, so Kaggle is a viable
*free* overnight arm if the data is uploaded as a Dataset.

**Five lines on the cloud, since he asked.**
1. Upload is **6.2 GB** (2.4 GB frame JPEGs + 2.5 GB face-crop JPEGs +
   1.26 GB fp16 teacher tensors) = **41 minutes at 20 Mbps**, one-time,
   amortised over every run.
2. Better: upload the **640×360 source frames (8 GB, 53 min)** and run
   the teacher in the cloud too — the three teacher models are 34 MB and
   labelling 200k frames is ~30 GPU-minutes.
3. The A100 hour saves 2.3 hours of a 3060 Ti night that costs nothing
   and is already idle — **the cloud buys iteration speed, not
   capability**, and only once you are tuning.
4. Kaggle's free P100 does the same job in ~8h inside its 12h session
   cap, for $0, if the 6.2 GB fits a Kaggle Dataset (it does; limit is
   generous) — this is the best free arm.
5. Nothing about the cloud changes VISION's "nothing leaves the phone" —
   that rule is about *user* data at runtime; training frames are his own
   download. The §6.5 licence problem is unchanged by where the GPU is.

---

## 4. Framework and export

```
PyTorch 2.4+  ──torch.export──►  litert-torch (ex ai-edge-torch)  ──►  .tflite  ──►  Android
     │                                    │
     │                                    └── ai-edge-quantizer: int8 per-channel PTQ
     └──torch.onnx──► onnx2tf (MIT) ──► SavedModel ──► tensorflowjs_converter ──► tfjs (WebGL fallback)
```

**Android path — `litert-torch`.** `google-ai-edge/ai-edge-torch` has
been **renamed to `google-ai-edge/litert-torch`**; the old PyPI package
is deprecated. Converter status is **Beta**; the project describes
"broad CPU coverage, with **initial** GPU and NPU support"
(<https://github.com/google-ai-edge/litert-torch>,
<https://ai.google.dev/edge/litert/models/convert_pytorch>). **UNVERIFIED
that its output is clean under the GPU delegate for a custom multi-task
conv head** — this is the single largest toolchain risk and it must be
smoke-tested on day 1 with a random-weight model, not discovered on day 6.

**Fallback — `onnx2tf` (MIT, PINTO0309).** Purpose-built to kill
onnx-tensorflow's transpose explosion; `flatbuffer_direct` backend skips
the intermediate TF graph. Known landmines that matter to us: **SiLU/Swish
causes "catastrophic errors" under int8** (MobileNetV3 uses hard-swish,
not SiLU — fine — but do not casually swap in a SiLU backbone), and
non-zero constant padding can collapse the quantization range.
<https://github.com/PINTO0309/onnx2tf>

**int8 — per-channel is not optional, and this repo has the scar.**
Loop 34: a **per-tensor** uint8 requant of faceres produced **17/100
decision flips at `GENDER_MIN_SCORE`, 8/100 at `GENDER_IMAGE_MIN_SCORE`,
2 sign flips, descriptor cosine min 0.596 against `MEM_SIM 0.60`** (M).
The canonical measurement is the same: MobileNetV1 @224 top-1 **0.709 →
0.001** under asymmetric per-layer weight quantization, **→ 0.704** with
per-channel; MobileNetV2 **0.719 → 0.001 → 0.698**
(<https://arxiv.org/abs/1806.08342>; numbers tool-extracted from the
ar5iv render, cross-checked twice, not hand-verified against the PDF).
Cause: BN folding produces extreme per-kernel dynamic range in depthwise
layers.

TFLite's default PTQ **is** per-axis for Conv2D/DepthwiseConv2D
(<https://ai.google.dev/edge/litert/conversion/tensorflow/quantization/quantization_spec>);
`converter._experimental_disable_per_channel = True` is what forces the
broken mode. Representative dataset **100-500 samples**, drawn from the
corpus, stratified by face px (<40 / 40-64 / ≥64) — not 500 consecutive
frames of one video.

**Ship mixed precision across the two files**, which is free because they
are two files: **S1 int8 per-channel** (dense localisation tolerates
noise — this is exactly why the hybrid uint8/f16 MoveNet requant worked),
**S2 fp16** (a small-margin classifier with six thresholds on its raw
sigmoid does not). Revisit int8 for S2 only after the flip-rate test in
§2.1 passes.

**QAT:** if int8 PTQ on S1 misses, use **pt2e** (PyTorch 2 Export
quantization) — it is the API litert-torch consumes, so it survives the
export. Legacy eager-mode `torch.quantization` fake-quant through
ONNX→onnx2tf is **UNVERIFIED and probably does not round-trip**; do not
try it.

**tfjs fallback:** stay on the SavedModel → `tensorflowjs_converter`
path this repo already debugged. **Re-apply the `remap` monkeypatch** —
`spikes/native/REPORT.md` records grappler's `remap` re-fusing ops into
`_FusedMatMul`/`Flex_FusedConv2D` *after* `CompatMode.TFLITE` un-fused
them, and `flex_check.py` exists to catch it. That trap is orientation-
independent and will fire on a new model too.

---

## 5. Expected speedup on the phone

Using the fitted model `t_ms ≈ 18 + 32 × GMACs` (Adreno 610, GPU
delegate, fully delegated) from §0b:

| arm | MoveNet/S1 | BlazeFace | faceres/S2 | pass | vs today |
|---|---|---|---|---|---|
| **today (M)** | 160 | 19 | 76 (2×38) | **255ms** | 1.0× |
| **MoveNet heatmap split, no training** | ~40-60 | 19 | 76 | **~135-155ms** | **1.7-1.9×** |
| **student fp16 GPU** | S1 0.38 GMACs → **30** | — | S2 batch-2 → **~20** | **~50ms** | **5.1×** |
| **student int8 NNAPI, his Redmi 13 (SM4450)** | ~12-18 | — | ~10-14 | **~22-32ms** | **8-11×** |

Reasoning for the int8/NNAPI row, and its caveat: int8 on a Hexagon DSP
is typically 2-4× a mobile GPU's fp16 for conv nets (S, generic), and the
fixed dispatch overhead is lower. **But `NativeInfer.loadModel` is
already an arbiter** — NNAPI must beat the GPU/CPU candidate by 10% on
the clock *and* agree on output 0 within 10%, else it is closed
(CLAUDE.md, 1098). So this row is measured-or-refused by construction,
and the Redmi 9 (Helio G88, no APU) can only prove the arm fails safe.

**What that is worth in dropped frames — the honest number.** From
`drops-v1097-*.json` (M): the whole inference line is **~3.5 points of
the 13.24%**. Cutting inference 5× removes ~2.8 points →
**13.2% → ~10.4%**. The student does **not** buy 13 points; §0 of
`wild-performance-2026-09-03.md` puts the ring copy at ~4 and an
unattributed render/rAF residual at ~5.

**Where it actually pays is cadence.** Verdict p50 355ms and gap p50
805ms today (1094, M). Inference is 255 of that 355. Student:
~150ms verdict, gap p50 → ~400-450ms. **The blur lands on a person
roughly twice as often**, which is the axis every exposure and phantom
number in this repo is a function of — and it does it without spending
the `VERDICT_DUTY` dial. That is the real case for this project.

---

## 6. Risks, ranked

**6.1 The gender and child heads are the exposure heads. A 2% regression
is a woman sharp.** Man recall is 99-100% at every size; every error is a
woman read as a man (M, custom-model §2c). The student starts *behind*
faceres and there is no headroom: 7 of 22 woman clusters are already
below 50%. **Mitigation:** the acceptance gate is not accuracy — it is
(i) `|v_student − v_teacher|` p50/p95, (ii) flip rate at all six gender
bars, (iii) `corpus-score.mjs` replayed unchanged with only the reads
swapped, **all three errors, both gender modes, sliced <40 / 40-64 /
≥64 px, split by cluster** (custom-model §7). **A student that cuts
false cover by buying exposure is a regression and must be rejected.**

**6.2 Small faces — the head that has never had a number.** §1.1: the
student's face head sees faces at 19-31px where BlazeFace sees 50-100.
Detector recall at px<64 has never been measured **in this product**
(custom-model §4c). We are therefore about to change the detector without
a baseline for the thing most likely to move. **Mitigation: measure
BlazeFace recall first** (custom-model §9 item 1: ~200 hand-annotated
frames, one afternoon, $0). Without it, §7's A/B cannot tell a student
regression from a pre-existing hole.

**6.3 Score mis-calibration silently invalidates nine constants.** §2.1.
Cheap to prevent, invisible if missed — it looks like "the tracker got
worse" three weeks later.

**6.4 int8.** §4. Prevented by per-channel + the flip-rate gate + shipping
S2 at fp16.

**6.5 Training data — and this one conflicts with the product's own
rules.** Three separate problems:
  - **Acquisition.** Building a 200k-frame set means bulk-downloading
    ~150-400 YouTube videos. `wild-performance-2026-09-03.md` item #20
    was **refused** with "**HIGH**: YouTube ToS (*no automated means*)…
    his call, not mine". Downloading 400 videos to train on is the same
    class or worse. **This is the owner's call and it should be made
    before day 1, not discovered on day 3.**
  - **Redistribution of frames: dead already.** custom-model §5:
    the corpus is *"frames from copyrighted YouTube videos… **Redistributable: no**"*.
  - **Redistribution of weights: the open-source goal takes the hit.**
    "Frames are not redistributed, only weights" is the usual argument
    and it is *probably* right — weights are not a copy of the training
    frames under most current readings — but it is **unsettled**, and it
    is not the binding constraint here. The binding constraint is
    custom-model §5's EU AI Act finding: a **standalone** published
    gender classifier loses the Article 3(40) "ancillary to another
    service" escape that protects the in-app use, and Annex III(1)(b)
    then reads it as high-risk biometric categorisation by a protected
    attribute. **VISION.md says free + open forever.** Publishing
    weights trained this way is a materially worse legal posture than
    shipping them inside the blur. Flagged, not resolved; needs counsel,
    not a research doc.
  - Unresolved and orthogonal: **Illinois BIPA** (custom-model §5),
    already the sharpest legal risk in the product, unchanged by this.

**6.6 Distribution shift.** Train on 640×360 ffmpeg decodes of mp4s;
deploy on a live MSE decode with different compression and motion
artefacts, through WebGL/TFLite fp on Adreno. custom-model §7.7 names
these three as the gaps the corpus cannot see. **A corpus win is not a
win until the device A/B lands** — standing rule, unchanged.

**6.7 Maintenance.** custom-model §6: *"a trained model is not a commit;
it is a permanent dependency with a training pipeline, a data provenance
record, a reproducibility burden and a re-training obligation."* Owner is
a solo beginner developer. The fallback if it is not maintained is worse
than today: a bespoke model nobody can retrain, with worse provenance
than the MIT/Apache one it replaced.

**6.8 Toolchain.** litert-torch GPU-delegate support is "initial" and its
op-coverage gaps are undocumented (§4). Smoke-test on day 1.

---

## 7. Execution plan

Assumes §6.5 is answered **yes** by the owner. If not, stop at day 1.

| day | hours | work | output |
|---|---|---|---|
| **0** | 3 | **Free win first (§0b):** cut MoveNet after the heatmaps, port TopK/GatherNd decode into `NativeInfer.kt`; device A/B | pass 255 → ~135ms **with no model trained**. If this alone is enough, stop. |
| **0** | 4 | **Measure BlazeFace recall** at px<64 (custom-model §9.1): 200 stratified frames, hand-annotated | the missing baseline for §6.2 |
| **1** | 2 | Toolchain smoke test: random-weight S1 → litert-torch → .tflite → `flex_check.py` → GPU delegate on the Redmi | go/no-go on §6.8 before any training |
| **1** | 6 | Acquire + decode ~30h of matched video at 1-2 fps, 640×360 | ~200k frames, ~8 GB |
| **2** | 3 | Teacher labelling: MoveNet + BlazeFace **on person crops** + faceres, batched on the 3060 Ti; bank fp16 tensors | ~30 GPU-min + I/O; 1.26 GB of targets |
| **2** | 3 | Build the training set: 320×192 JPEGs, 112 face crops, webdataset shards; **verify the 18 corpus windows are excluded** | 2.4 + 2.5 GB, held-out set clean |
| **3** | 2 | Dataloader throughput measurement (§3.1) — settle 700 vs 1,400 img/s before committing a night | the number every estimate below depends on |
| **3-5** | 3 nights × ~5h | **S1 + S2 training, 3-4 runs**, loss-weight sweep | student v1 |
| **6** | 4 | Eval: `corpus-score.mjs` replayed unchanged, three errors × two modes × three px slices × cluster-split; calibration at all nine person and six gender bars | the acceptance packet |
| **7** | 4 | Export: S1 int8 per-channel PTQ (100-500 stratified representative samples), S2 fp16; parity vs PyTorch; tfjs export with the `remap` patch | two .tflite + one tfjs graph |
| **8** | 5 | Integration: `NATIVE_STUDENT` dial in `tuning.mjs` shipping **0**; `NativeInfer.kt` model slot; `person-gate.mjs` decode path for the new heatmaps | inert build |
| **9** | 4 | Device A/B on the Redmi: `probe_drops_ab.py` control + one planted arm, `__TS_DIAG_NOW()` per-model backends; then a gauntlet round | the only number that counts |
| **10** | 3 | Opus critic on the whole diff, `docs/critic/`, ledger rows; an open EXPOSURE row blocks | release gate |

**Calendar: ~10 working days / 2 weeks**, of which ~20 hours is GPU and
the rest is data, export, integration and verification. The GPU was never
the constraint — custom-model §6 said so and it is still true.

---

## 8. THE 24-HOUR CUT

What one person with one 3060 Ti can have **running on the Redmi**
24h from now. Scope is a **speed proof, not an accuracy proof.**

| h | work |
|---|---|
| 0-3 | **MoveNet heatmap split + Kotlin decode.** No training. Device A/B. This alone is 255 → ~135ms. Bank it — it is the fallback if everything after fails. |
| 3-5 | Toolchain smoke: random-weight S1 (MobileNetV3-Large @320×192 + FPN + heads) → litert-torch → `flex_check.py` → GPU delegate on the Redmi, timed. **This is the go/no-go.** If the graph does not fully delegate, stop and ship hour 3. |
| 5-8 | Data from **the 10 videos already on disk** (`Z:/tamescroll-corpus/video`, 361 MB = **15,238 s = 4.23 hours**, measured today) — full length at 5 fps, not the 18 sampled windows. **76,000 frames.** No download, no ToS question, no new licence surface. |
| 8-10 | Teacher labelling of those 76k frames + ~190k face crops. ~25 GPU-min + I/O. Exclude the 18 corpus windows. |
| 10-18 | **One training run, overnight.** S1: frozen backbone 3 epochs, then full fine-tune 40 epochs on 76k = 3.0M steps ≈ **0.85h**; S2: 190k crops × 60 = 11.4M ≈ **0.5h**. ~1.4h of GPU, so the window holds 3-4 runs including restarts. |
| 18-20 | Export S1 int8 per-channel + S2 **fp16**, parity vs PyTorch, `flex_check.py`. |
| 20-23 | Integrate behind `NATIVE_STUDENT`, **default 0**; build; **timed device run on the Redmi** — per-model ms off `__TS_DIAG_NOW()`. |
| 23-24 | Write up. Ship the APK with the dial at 0. |

**Deferred, explicitly:** descriptor head (train it, do not distil — §2.2);
accuracy parity; `corpus-score.mjs` re-score; the 200k-frame domain set;
BlazeFace recall baseline; the critic round.

**Gate before `NATIVE_STUDENT` may ship 1** — all four, none optional:
(1) student pass ≤ 80ms on the Redmi, measured; (2) gender flip rate vs
faceres **0/500** at all six bars and `|Δv|` p95 ≤ 0.05; (3)
`corpus-score.mjs`, three errors, both modes, no error class worse than
shipped; (4) an Opus critic with no open EXPOSURE row.

**The step that cannot be compressed: the accuracy gate, not the
training.** 76k frames from 10 videos is 76k *autocorrelated* frames —
4.23 hours of ten people in ten rooms. It will produce a student that is
fast and is *overfitted to ten videos*: it will pass a speed test and it
has no chance of passing gate (2) or (3). Those gates need the 200k-frame
domain set (day 1-2 of §7, ~9 hours of download and decode that cannot be
parallelised past his uplink) and a cluster-split evaluation. **24 hours
buys a measured latency number and a dead dial. It cannot buy a shippable
model, and any plan that claims otherwise is proposing to ship an
untested gender classifier into the exposure path.**

---

## Provenance

Measured-in-repo figures: `spikes/native/GPU-REPORT.md` (Adreno 610
per-model p50), `spikes/native/REPORT.md` (conversion contracts, Flex
trap), `docs/detection-engine.md` (every threshold, `nm` ground truth,
descriptor separability), `docs/research/custom-model-2026-09-02.md`
(oracle ceiling, per-cluster female recall, dataset licences),
`docs/research/wild-performance-2026-09-03.md` §0 (drops decomposition),
CLAUDE.md loops 34/38/40 and 1094-1098. Corpus frame count (2,160) and
window geometry counted today from `Z:/tamescroll-corpus/bank/reads/*.json`.
**No repo source was modified and nothing was run on any device.**
