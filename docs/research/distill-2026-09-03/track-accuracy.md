# Track: accuracy — what it would take to be MEASURABLY better than the teachers

Research run, 2026-09-03. Read-only: no source touched, no device driven,
nothing committed. Companion track in this directory: `track-prior-art.md`.

**The owner's bar, verbatim:** *"make this like the best model out there
for blurring haram content ... accuracy etc everything needs to be super
dialed in."*

**The one-line answer.** A student distilled from MoveNet + BlazeFace +
FaceRes cannot beat them, and beating them is worth less than it sounds:
this repo's own oracle experiment says a **perfect** gender model removes
**13.7% of scored error in man mode and 24.1% in woman mode**, and a
perfect face/non-face gate on top takes that to 19.4% / 28.2%
(`docs/research/custom-model-2026-09-02.md` §3). The other **72-86% is
the decision layer**. There is exactly one crack in that ceiling and it
is measured: **5.6% of person-instances are seen by neither model**
(`docs/engine-findings.md` §11), which the oracle experiment is
structurally blind to and which **nobody has ever priced in seconds**.
§6.2 makes that measurement the gate on the entire model question.

A student *can* legitimately beat its teachers, but only through a
target carrying information no teacher can express at inference time.
§2b names the four such sources and says which two this project owns.

---

## 1. THE ERROR TAXONOMY AS MEASURED

Every row is a number this repo produced, with where. Nothing inferred
from literature.

### 1.1 The three scored errors today

`app/gaze/bench/corpus-score.mjs` replays the **shipped** decision layer
over banked frames and scores in **seconds**, because the unit the owner
experiences is "how long was she sharp", not per-read accuracy.

| | definition | man mode | woman mode |
|---|---|---|---|
| EXPOSURE | a person he asked to cover is sharp | **7.5s** | 7.0s |
| FALSE COVER | the wrong gender covered | **197.5s** | 280.5s |
| PHANTOM | a patch with no person under it | **286.5s** | 392.0s |
| **total scored error** | | **491.5s** | 679.5s |

Corpus: 10 videos, 18 windows, 2,160 frames, 3,465 banked reads at
**640x360 — his measured decode, itag 134**, 3,465 face crops at 112x112
on disk, 107 labelled clusters covering 93.7% of reads
(`Z:/tamescroll-corpus/bank/label/labels.json`: notperson 32, man 30,
woman 22, mixed 15, bodypart 4, child 4).

**EXPOSURE is a lower bound by construction.** The scorer's own header:
*"labels cover faces the DETECTOR FOUND. A person BlazeFace never
detected is invisible here."* Hold that until §1.3 M-1.

### 1.2 The oracle: the ceiling on any model

Perfect read substituted for every human-labelled crop, re-scored
through the unmodified decision layer (`custom-model-2026-09-02.md` §3):

| arm | EXPOSURE | FALSE COVER | PHANTOM | total |
|---|---|---|---|---|
| **man** shipped | 7.5s | 197.5s | 286.5s | 491.5s |
| perfect gender | 3.0s | 143.0s | 278.0s | 424.0s (**−13.7%**) |
| + perfect face/non-face | 3.0s | 141.0s | 252.0s | 396.0s (−19.4%) |
| **woman** shipped | 7.0s | 280.5s | 392.0s | 679.5s |
| perfect gender | **9.5s** | 188.0s | 318.5s | 516.0s (**−24.1%**) |
| + perfect face/non-face | 9.5s | 186.5s | 292.0s | 488.0s (−28.2%) |

Three constraints on any model project fall straight out:

- **Phantom barely moves: 286.5 → 278.0s (3%).** A perfect non-face gate
  on top reaches 252s. So **~88% of phantom is unclaimed patches** —
  stale tracks, coasting, oversized synthetic bodies. No model.
- **143s / 188s of false cover SURVIVES perfection.** Every second of it
  is geometry: a solid patch minted for A covering B. That is **accepted
  owner policy** ("Blur patches are SOLID"), so most of it is not a
  defect at all.
- **In woman mode a perfect model makes EXPOSURE WORSE** (7.0 → 9.5s),
  because correcting reads lets more tracks clear. A swap scored on one
  error is a regression waiting to ship.

### 1.3 MODEL errors — a better model fixes these

| # | class | number | where |
|---|---|---|---|
| **M-1** | **Person-instances seen by NEITHER model** | **119 of 2,131 = 5.6%** (6.2% under the stricter containment test) | `bench/detector-recall.mjs`, coco-ssd ≥0.5, height ≥0.15 frame, 18 windows — findings §11 |
| M-1a | ...and they are not small | missed persons run **p50 0.38 of frame height, p95 0.99** — large, foreground | §11b |
| M-1b | ...and the threshold is not the lever | a rejected MoveNet slot sat on **82 of 119 (68.9%)** at score p05 0.011 / p50 0.110 / p95 0.264. `PERSON_MIN_SCORE` 0.30 recovers 2 of 119; 0.10 recovers 44 (37%) and admits every noise slot | §11b |
| M-1c | ...and the runs are long enough to see | 55 contiguous miss runs: **p50 1 frame**, **p95 4, max 14** — at corpus 0.5s spacing that is **7 seconds of a large foreground person with nothing over her**. 7 runs (12.7%) last 3+ frames | §11c |
| M-1d | ...and a third are women | nearest-labelled-face attribution: mixed 39, **woman 37**, other 26, man 14 | §11c |
| **M-2** | **Pose-only persons** (MoveNet finds them, the face model does not) | **306 of 2,131 = 14.4%** — one person in seven | §11a |
| **M-3** | **Face-detector recall by size** (BlazeFace vs MoveNet frontal heads, n=1,720) | 0-24px **68.0%** · 24-40px **92.1%** · 40-64px **91.9%** · 64-96px **99.8%** · 96px+ **100.0%** · all **92.9%** | `bench/face-recall.mjs`, findings §24 |
| M-3a | ...in HIS band (faces reach faceres at px p50 38-62) | **92-94%** — ~6-8% of frontal heads unfound | §24 |
| M-3b | ...but the trend argues it is mostly NOT BlazeFace | agreement rises **92.9 → 93.7 → 95.3 → 98.0%** as MoveNet's keypoint bar rises 0.20 → 0.50. Steep in the bar, flat in px above 24px ⇒ most disagreements are MoveNet unsure, not a face BlazeFace walked past | §24 |
| **M-4** | **Per-subject female recall** | **7 of 22 woman clusters below 50% accurate — 96 of 975 woman reads (10%)**. Worst: 0% (n=8, 46px), 16% (n=38, 52px), 30%, **42% at mean 98px with healthy nm 9.9**. Man recall **99-100% at every size** | `custom-model-2026-09-02.md` §2c |
| M-4a | ...and it is NOT resolution | within-identity paired test, 18 clusters with ≥8 members either side of 64px: **mean accuracy delta (big − small) = −1.6 points**, zero for 9 of 18, largest moves in *both* directions (+25, −21, −22). What *does* move with size: `nm` +0.97, certainty +0.091, correctness nothing | §2b |
| **M-5** | **Graphics read as certain faces** | a gender read on a NON-face crop reads CERTAIN (score ≥0.25) **38-53% of the time, and it is FLAT in size** — a 160px car bonnet reads certainly-male about as often as a 32px one (34 crops × 9 sizes) | `bench/small-face.js`, detection-engine.md |
| M-5a | ...on his phone | **89 of 300 reads (30%) are null reads**, each minting a patch, in a 90s live read-only sample on 1078 | CLAUDE.md loop 38 |
| M-5b | ...and the gate that works is a band hack, not a model | `isNullRead` catches **77-83 of 85 non-faces (91-98%) at every size 32-160px** for **1-2 of 28 real faces refused (4-8%)**. It works because a null read *is* the age head returning its ~36.9 prior: non-face crops read age **p05/p50/p95 = 35/38/41**, dead centre of the [34,42] window | `small-face-nonface-2026-09-01.txt` |
| M-5c | ...and the mint floor rides the descriptor, not the sigmoid | `NULL_MINT_NM_FLOOR` 5: **0 of 125 real faces refused, 388 of 403 in-band non-faces refused (96.3%)**. Floor 6 refuses 5 of 125 real faces, four of them one woman. Faces p05 8.34-10.99 by size; non-faces p95 4.56-5.49 | `bench/nm-floor.mjs` |
| **M-6** | **The child gate's model is wrong at the boundary** | `GENDER_CHILD_MASS` 0.25 orders this project's two reference faces **BACKWARDS**: a 21-year-old reads childP **0.49-0.94**, a known 12-year-old reads **0.146-0.194** | `gender-verdict.mjs:371-383`, critic phase-m M7 |
| M-6a | ...so the owner's own reported subject is not protected by it | the daughter in NWoT1ZVd1Lo measures **childP 0.146-0.194** against a 0.25 gate — `isAdultRead` returns TRUE for her | R25, detection-engine.md |
| M-6b | ...though it works on the footage it was calibrated on | R18 classroom: 8-year-old boy childP **0.15-0.72, median 0.42** (16 directed reads); adult teacher **0.09-0.18, max 0.18** (23 reads). The mass gate catches 10 of 10 child clears where the mean-based gate caught 2 | detection-engine.md |
| M-6c | ...and it currently costs adult men | the false-cover classifier excludes reads with childP ≥ 0.25 — **3-4 rows per run, "ages 21-23"**. Adult men the owner still sees covered | critic phase-m M7 |
| **M-7** | **Back-turned / no-face subjects** | MoveNet emits all 17 keypoints *always*, at low confidence rather than absence, so a subject facing away has a full skeleton at **0.15-0.29** and nothing above `PERSON_KEYPOINT_MIN` 0.3 — failing four gates at once. Weak tier (`PERSON_WEAK_KP15` 9, `_MAXKP` 0.25, `_ANCHOR` 0.20) recovers **0.00 extra admits/pass on 33 low-density runs, 0.17-0.37 on R15/R17, 2.3-2.7 on the two dense runs** | gauntlet R18 |
| **M-8** | **NSFW / suggestive on VIDEO: never run, never measured** | nsfwjs is thumbnails only. detection-engine.md §2: *"Known gap: videos get no NSFW sampling yet."* `grep -c nsfw docs/engine-findings.md` = **0** — the compulsory tier has no video arm and no instrument | detection-engine.md |
| **M-9** | **The whole per-person pipeline is YouTube-only** | three copies of `closest('#movie_player')` gate it. Reddit / X / Instagram / Facebook get `wholeFrameFlagged` — **ONE boolean per frame**, whole-video CSS blur, 500ms sampling, four clean samples to unblur. On Reddit the gates can never match (video is a direct child of `shreddit-player`'s shadow root; `video.parentElement` is null) | findings §16, §16c |
| M-9a | ...and that path squashed 16:9 into a square until 1089 | faceres descriptor magnitude higher undistorted on **17 of 18 faces, sign test p = 1.45e-4**; four faces cross `NULL_MINT_NM_FLOOR`; **2 of 13 solid-signal faces flip gender label** (one raw 0.601 → 0.377) | findings §16a |

**M-10 — the cautionary row, and it is the most expensive lesson here.**
For six loops "MoveNet admits nobody on his phone" was believed to be a
model or footage property. It was the **tfjs WebGL runtime on Adreno
610**: four independent runtimes read maxKp 0.768 / 0.822 on the same
dumped frames where the device worker read **0.187 / 0.033** (findings
§25). Every conclusion priced on that regime — findings 36/21/21a/23,
`CUT_PERSON_LOOK`, `PERSON_LETTERBOX`, and
`frameHasNoHumanShape`'s 127-refusals-per-250s — was measuring a broken
runtime, not a model. **Measure the runtime before blaming the model.**

### 1.4 PIPELINE errors — a model cannot fix these

| # | class | number | where |
|---|---|---|---|
| **P-1** | **Cadence is the biggest single lever, by an order of magnitude** | verdict interval 1.5s → 0.5s moves man exposure **24.5s → 5.5s** (19s). Every threshold swept in August moves **1-3s** | `bench/cadence-ab.mjs`, findings §2 / §13a |
| P-1a | ...and the mechanism is arithmetic, not detection | clearing a man needs `CLEAR_STREAK_N` = 2 verdicts, so at 1.5s **the floor is 3 seconds of blur on every track birth, whatever the model says** | findings §2 |
| **P-2** | **False cover is a TIMING failure** | 216.5s man attributed: ABSORBED 56.5s (26%), **MISREAD 149.0s (69%)**, STALE 11.0s (5%). Of the misread, **77% (115.0s) is male, carries descriptor signal, is adult, and clears the bar at score p50 0.71 — and is covered anyway.** The correct verdict exists and arrives too late | findings §3 |
| **P-3** | **The coast window buys phantom and costs no GPU** | `PTRACK_MIN_COAST_PASSES` 2 → 1.33 at pinned verdict count: phantom **−149.5s man / −185.0s woman (−26%)**, false cover −18.5s / −7.5s, for **+4.5s / +4.0s exposure** across 18 windows | findings §15 |
| **P-4** | **Assignment: contended births are the largest birth class** | 147 births; fresh **26.5%** (smallest), contended **44.2% man / 51.0% woman** (largest). Hungarian vs greedy, his regime: man 22.5/136.5/547.5 vs 23.0/139.0/561.0 — better on all three | `bench/births.mjs`, findings §17 |
| **P-5** | **The cut gate is the biggest phantom dial there is** | `CUT_DELTA` 35 → 90 moves man phantom **976.5 → 470.0s**. 60 → 75 is +5.5s exposure for −86.5s phantom. 75 is refused: his own footage reaches motion p95 **54.9** | findings §10h / §10p |
| **P-6** | **A cut is 100ms wide and the timeline treats it as a point** | `gateTick` runs at 100ms, so the true cut frame lies anywhere in the 100ms ending at the sample; **145-165 presented frames per run** fall in that window (74-134 carrying a patch), resolved against the OLD shot's snapshot | critic phase-m M4 |
| **P-7** | **A single exception froze every patch for the rest of the page** | `boxesAt` returned null after the timeline shrank the overlay set; the throw landed inside `loop()` before the next rAF, so the loop never re-armed. **90.7% of v1096c's frames drew a stale target.** A frozen patch is both owner complaints at once | CLAUDE.md loop 49, `stale_target.py` |
| **P-8** | **Hindsight clear read the wrong snapshot** | rule 3'' confirmed a pending clear against the *next* snapshot, usually a position pass carrying no verdict — so a pending clear was confirmed almost never: **~2s of cover after every cut** on the man who reads certain | commit 0e3305e |
| **P-9** | **The residual 16 of 82 false-cover rows, traced one by one** | pendingClearLadder 3, neighbourMeasured 4 (the solid-patch rule), neighbourCoasting 2, neighbourSynthetic 1, bornBlurredAtCut 1, demotedAtCut 2, **clearedButTimelineBlurred 2 UNEXPLAINED** | `trace_cover.py`, CLAUDE.md loop 50-51 |
| **P-10** | **Entry latency is delivered by the delay line, not by a model** | with `DELAY_MS` 1500 the blur is on the person the frame they appear: entry lag **p50 34ms** media, p95 401ms, 5 of 15 non-positive. Price: ~4 points of dropped frames | CLAUDE.md loop 46 (B5), `probe_drops_ab.py` |
| **P-11** | **Presented-frame exposure, the honest residual** | healthy runs leave **5-9% of blurred-entry frames uncovered** (v1096f: **299 of 4,405 = 6.79%**), which includes hindsight rules 3'/3''/6 firing by design. A bound, not a decomposition | `events_reclass.py`, critic phase-m note |

### 1.5 The honest split

**On faces the detector found, the repo's own oracle is decisive:
72-86% of scored error is pipeline.** A perfect classifier *plus* a
perfect face/non-face gate is worth **95.5 seconds of 491.5s in man
mode**, and most of the false-cover residual it cannot reach is accepted
policy rather than a defect.

**Off that set, the model share is unmeasured and could be large.** M-1
says 5.6% of person-instances are seen by neither model; M-1c says the
worst run is 7 seconds; M-1d says a third of them are women. Nothing in
this repo converts that into seconds of exposure, because the scorer
cannot see a person it has no read for.

Stated so it can be refuted: **if the detector-recall class prices below
~20 seconds of man-mode exposure on the corpus, the model question is
closed and every remaining accuracy day belongs to the decision layer.**
That measurement is §6.2 and it is one day of work.

---

## 2. STRONGER OFFLINE TEACHERS

Scope: desktop-only, any size, run once to auto-label frames. The bar is
that their **outputs may lawfully train weights we SHIP**. Code licence
and weights licence are separate questions and are separated below;
where a licence restricts *use* rather than *redistribution*, "we never
ship the teacher" does not cure it.

This repo already surveyed **on-device** candidates
(`models-2026-09-02.md`, `person-detect-2026-09-02.md`,
`gender-lowres-2026-09-02.md`) and already banked a licence ledger
(findings §5). §2a below is the **offline teacher** layer, which is a
different question — nothing here has to run in a WebView.

### 2a. The teacher table

#### Person + pose (teaches body EXTENT, so the solid box is the right size)

| model | teaches | code | **weights** | size | accuracy |
|---|---|---|---|---|---|
| **RTMPose / RTMO** | 2D keypoints + body box | Apache-2.0 ([LICENSE](https://github.com/open-mmlab/mmpose/blob/main/LICENSE)) | **Apache-2.0, maintainer-confirmed**: *"All MMPose projects are licensed with permission for commercial use"* ([issue #2393](https://github.com/open-mmlab/mmpose/issues/2393)) | RTMPose-m 13.6M / -x 51M | RTMPose-m **75.8 AP** COCO val ([paper](https://arxiv.org/pdf/2303.07399)); RTMO-l 74.8 val ([paper](https://arxiv.org/pdf/2312.07526)) |
| **ViTPose / ViTPose++** | keypoints, accuracy ceiling | Apache-2.0 ([LICENSE](https://github.com/ViTAE-Transformer/ViTPose/blob/main/LICENSE)) | Apache-2.0 claimed — **TRAP, see §2c #4** | ViTPose-H 632M | **79.1 AP** COCO val, 81.1 ensembled test-dev |
| **YOLOX** | person boxes | Apache-2.0 ([LICENSE](https://github.com/Megvii-BaseDetection/YOLOX/blob/main/LICENSE)) | presumed by blanket repo licence; **no maintainer confirmation** — the question sits open at [issue #1865](https://github.com/Megvii-BaseDetection/YOLOX/issues/1865) | -x 99.1M / -Nano 0.91M | 51.5 AP / 25.8 AP |
| **DWPose** | whole-body keypoints (distilled) | Apache-2.0 ([LICENSE](https://github.com/IDEA-Research/DWPose/blob/onnx/LICENSE)) | inherits Apache-2.0; **UBody co-training dataset terms UNKNOWN** | dw-ll_ucoco_384 | whole-body **AP 0.665** @384×288 ([paper](https://arxiv.org/pdf/2307.15880)) |
| **Sapiens** (Meta) | high-res pose | **CC-BY-NC-4.0** ([LICENSE](https://github.com/facebookresearch/sapiens/blob/main/LICENSE)) | **CC-BY-NC-4.0, no code/weights split** | 0.3B-2B | 61.1 AP COCO kp | **DISQUALIFIED.** `sapiens2` uses a custom Meta licence that nominally allows commercial use but **explicitly bans "biometric processing"** ([LICENSE.md](https://github.com/facebookresearch/sapiens2/blob/main/LICENSE.md)) — which is precisely our application, the same clause class that killed the Qualcomm QNN delegate |
| **RTMDet** | person/box | Apache-2.0 (mmdetection) | Apache-2.0 | -x 94.9M | 52.8 AP COCO |
| **RT-DETR** (lyuwenyu) | person/box | Apache-2.0 ([LICENSE](https://github.com/lyuwenyu/RT-DETR/blob/main/LICENSE)) | Apache-2.0 | R50 42M | 53.1 AP val |
| **DEIM / D-FINE** | person/box, current SOTA real-time | Apache-2.0 ([D-FINE](https://github.com/Peterande/D-FINE/blob/master/LICENSE), [DEIM](https://github.com/ShihuaHuang95/DEIM)) | Apache-2.0 **except** Objects365-pretrained checkpoints, which carry Objects365's own dataset terms | varies | SOTA COCO real-time |
| MoveNet MultiPose *(shipped)* | baseline | Apache-2.0 | Apache-2.0 | 4.94MB (our requant) | **no official COCO AP** — Google benchmarks on an internal "Active" set |
| coco-ssd *(already banked)* | independent person boxes | Apache-2.0 | Apache-2.0 | — | already used as the §11 recall instrument, boxes on disk at `bank/ssd` |

#### Person segmentation (teaches EXTENT for a SOLID box — never a silhouette mask)

The patch stays a solid rectangle; a mask teacher supplies the **right
rectangle**. This is the single most under-exploited teacher class for
this product: P-9's `neighbourMeasured`/`neighbourSynthetic` rows and the
143s of oracle-surviving false cover are both extent errors.

| model | code | **weights** | size | accuracy |
|---|---|---|---|---|
| **SAM / SAM 2** (Meta) | Apache-2.0 ([SAM](https://github.com/facebookresearch/segment-anything/blob/main/LICENSE), [SAM2](https://github.com/facebookresearch/sam2/blob/main/LICENSE)) | **Apache-2.0, checkpoints included** | SAM2-Hiera-L 224M | SA-23 mIoU 60.0 (1-click) / 81.8 (5-click); SA-V J&F ~78 ([paper](https://arxiv.org/pdf/2408.00714)) — **and SAM 2 is video-native, which is what a temporal teacher needs.** TRAP: SAM 3 moved to a custom non-Apache licence |
| **BiRefNet** | MIT ([LICENSE](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE)) | MIT | 221M | SOTA S-measure DIS5K/HRSOD/COD |
| **Mask2Former** | MIT ([LICENSE](https://github.com/facebookresearch/Mask2Former/blob/main/LICENSE)) | MIT; Swin backbone also MIT | Swin-L | PQ 57.8 COCO panoptic, mIoU 57.7 ADE20K |
| **OneFormer** | MIT ([LICENSE](https://github.com/SHI-Labs/OneFormer/blob/main/LICENSE)) | MIT **from SHI-Labs GitHub only** — the NVIDIA NGC mirror of the same weights is labelled non-commercial | Swin-L | ~Mask2Former range |
| MediaPipe Selfie Segmentation | Apache-2.0 | Apache-2.0 | 250KB-2.5MB | **no official mIoU published** |
| DeepLabv3+ | Apache-2.0 | Apache-2.0 | 161-233MB | 82.1% mIoU VOC12 — but a *human-parsing* checkpoint means fine-tuning on CIHP/LIP, whose dataset terms lean non-commercial |
| RMBG-1.4 / 2.0 (BRIA) | source-available | **CC-BY-NC-4.0 / custom BRIA non-commercial** ([card](https://huggingface.co/briaai/RMBG-2.0)) | ~44MB | — | **DISQUALIFIED** |

#### Face detection (30-70px faces in a 640x360 frame is the whole problem)

| model | code | **weights** | size | WIDER easy/med/**hard** |
|---|---|---|---|---|
| **YuNet** (OpenCV Zoo) | **MIT** (per-model LICENSE in `face_detection_yunet/`) | **MIT** | ~232KB *measured* (the git-lfs pointer reports a fake 131 bytes through the API) | 0.834 / 0.824 / **0.708** ([README](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md)). *Discrepancy: findings §5 records **0.7503** for this model — different released version; read the current README before quoting either.* Designed for 10-300px faces |
| **SCRFD** (InsightFace) | MIT | **NON-COMMERCIAL RESEARCH ONLY** ([README](https://github.com/deepinsight/insightface)) | 2.5G 0.67M / 10G 3.86M / 34G 9.80M | 79.99 / 83.05 / **85.29** hard | **DISQUALIFIED — and the clause restricts USE, not just redistribution, so "offline teacher only" does not cure it** |
| RetinaFace | official code MIT | official weights same InsightFace NC restriction. [biubug6](https://github.com/biubug6/Pytorch_Retinaface) reimpl: code MIT, **weights licence UNKNOWN** (no statement in README or LICENSE) | R50 | 96.9 / 96.1 / **91.8** | |
| **BlazeFace** *(shipped)* | Apache-2.0 ([model card](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf)) | Apache-2.0 | 224KB short-range / **1.0MB full-range (UNTRIED)** | **no official WIDER number** — benchmarked on Google's proprietary set; card warns against "detecting people further than 2 meters", which is our exact M-3 weakness |

#### Gender / age

| model | code | **weights** | dataset shadow | accuracy |
|---|---|---|---|---|
| **CLIP** (OpenAI) — zero-shot gender prompt | **MIT** ([LICENSE](https://github.com/openai/CLIP/blob/main/LICENSE)) | **MIT** | private WIT, never released; no restriction found | **>96% gender accuracy across ALL FairFace race groups** (Middle Eastern 98.4%, White 96.5% lowest), published in the CLIP paper's own fairness section. **The only teacher in this table that is MIT end-to-end AND publishes a gender number on a bias-balanced set** |
| **MiVOLO v1** | Apache-2.0 ([license](https://github.com/WildChlamydia/MiVOLO/blob/main/license)) | Apache-2.0 | **trained on IMDB-WIKI, which is "academic research purpose only"** — provenance shadow, disputed practice | **MAE 5.10y**, best specialised non-VLM model in an independent bench ([arXiv 2602.07815](https://arxiv.org/html/2602.07815v2)) |
| MiVOLO **v2** | Apache-2.0 | **backbone is DINOv3, under a separate Meta licence not cleared here** | as above | — | **NOT CLEARED — use v1** |
| **SigLIP2** (Google) | Apache-2.0 | Apache-2.0 ([card](https://huggingface.co/google/siglip2-so400m-patch14-224)) | training corpus **UNKNOWN** | **no gender/child zero-shot number found — UNKNOWN** |
| OpenCLIP (LAION) | LICENSE file reads as MIT but GitHub metadata says **NOASSERTION** | **per-checkpoint** — contentious enough to have its own [issue #503](https://github.com/mlfoundations/open_clip/issues/503) | LAION is link-metadata only | UNKNOWN |
| FairFace (joojs) | **no LICENSE file — 404** | **UNKNOWN.** "CC BY 4.0" is on the *dataset* card, not the checkpoints | dataset CC BY 4.0 | — | **We may lawfully TRAIN ON FairFace and may not safely SHIP their weights.** Keep the two questions apart (findings §5 makes the same split) |
| InsightFace `genderage` | MIT | **NON-COMMERCIAL** | — | — | **DISQUALIFIED** |
| DeepFace (serengil) | MIT | "inherit from the original source" — VGG-Face provenance, **UNKNOWN** | VGG-Face / IMDB-WIKI | age MAE ±4.65, gender 97.44% (**author-reported, own split, not independently verified**) |
| FaceRes / HSE *(shipped)* | MIT via `vladmandic/human` | upstream `av-savchenko/HSE_FaceRec_tf` licence **UNVERIFIED** | UNKNOWN | our baseline |

#### Child detection specifically — the literature is a warning, not a solution

This is the most important paragraph in §2 and it argues *against* a
model fix.

- **Specialised (non-LLM) age models show a 39-100% "false adult" rate
  on actual minors** at the 18 line, across 22 architectures over 8
  datasets ([arXiv 2602.07815](https://arxiv.org/html/2602.07815v2)).
- **To reach a 1% false-adult rate the threshold has to move from 18 to
  32 years** ([arXiv 2506.10689](https://arxiv.org/html/2506.10689v1)).
  A plain age estimator **cannot** hit a 1%-miss rate on minors while
  drawing the line at 18. You buy the miss rate with policy, not
  accuracy.
- **Four trivial cosmetic manipulations shifted predicted age by +7.7
  years on average** across 329 subjects aged 10-21, with attack
  conversion up to 83% for specialised models
  ([arXiv 2602.19539](https://arxiv.org/html/2602.19539)).
- No benchmark isolating the **16-22 band** with per-year error rates
  was found — **UNKNOWN**. Most papers bucket at 12/15/18/21.

**Consequence for us.** M-6 says our own child gate orders its two
reference faces backwards and does not protect the owner's own reported
child. The literature says no available model fixes that at 18. The
correct move is therefore a **policy** one — never clear a read whose
apparent age is under a margin well above 18 — and then measure what
that costs in adult false cover, in seconds. §4 sets it at 25.

#### NSFW / suggestive on video frames (M-8: the class with no instrument)

| model | code | **weights** | notes |
|---|---|---|---|
| **nsfwjs / GantMan `nsfw_model`** *(shipped, thumbnails only)* | **MIT** ([LICENSE.md](https://github.com/GantMan/nsfw_model/blob/master/LICENSE.md), fetched directly) | MIT | training set UNKNOWN (private). Clean |
| **Falconsai/nsfw_image_detection** | Apache-2.0 | Apache-2.0 | fine-tuned from `google/vit-base-patch16-224-in21k` (Apache-2.0) on a proprietary 80,000-image set. **Clean chain — the strongest permissive teacher in this row** |
| **LAION CLIP-based NSFW detector** | MIT | MIT | a linear probe on CLIP embeddings; needs the MIT CLIP encoder underneath. Clean |
| **NudeNet** | **AGPL-3.0** on GitHub (GitHub API `spdx_id: agpl-3.0`) | AGPL-3.0 — code and weights ship together | **The PyPI package metadata says "MIT". PyPI is WRONG.** Anyone checking PyPI alone would ship an AGPL-derived teacher believing it clean. Given the project's hard rule and the App Store consequence, **do not use it at all**, not even offline |

#### Cloud APIs as teachers — contractually blocked, with quotes

- **Google Cloud** (Service Specific Terms, covers Vision AI / SafeSearch):
  *"Customer will not use output from an AI/ML Service (including
  Generated Output) to ... create or improve models similar to a Google
  Model"*, and *"will not ... use an AI/ML Service or Generated Output to
  develop a similar or competing product or service."*
  [cloud.google.com/terms/service-terms](https://cloud.google.com/terms/service-terms)
- **AWS** (Service Terms §50.3, Rekognition explicitly listed):
  *"You will not, and will not allow any third-party to, use the AI
  Services to, directly or indirectly, develop or improve a similar or
  competing product or service."*
  [aws.amazon.com/service-terms](https://aws.amazon.com/service-terms/)
- **Microsoft Azure**: the clearly-quotable clause is generative-specific
  — *"Customer may not use ... Output Content for the express purpose of
  creating synthetic training data to develop or train AI models ... that
  have substantially similar functionality to a Microsoft AI service"*
  ([learn.microsoft.com/legal/ai-code-of-conduct](https://learn.microsoft.com/en-us/legal/ai-code-of-conduct)).
  The exact parallel clause for **non-generative** Computer Vision /
  Content Moderator is **UNKNOWN** — a restriction almost certainly
  exists but no verbatim text was found.

**All three clouds are off the table as teachers**, which also happens to
agree with VISION.md's "nothing leaves the phone" for the shipped path.

### 2b. THE ACTUAL QUESTION: how a student can beat its teachers

The default answer is that it cannot. Stanton et al., *Does Knowledge
Distillation Really Work?* (NeurIPS 2021,
[arXiv 2106.05945](https://arxiv.org/abs/2106.05945)) is the standard
citation: *"there often remains a surprisingly large discrepancy between
the predictive distributions of the teacher and the student, even when
the student has the capacity to perfectly match the teacher"* — and it
separates **fidelity** (student matches teacher outputs) from
**generalization** (student is right about unseen ground truth). A
student can reproduce a teacher's errors with high fidelity and look
successful on every distillation metric. That is exactly M-4: a woman
every model reads as a man transfers intact.

A student beats its teachers **only** when the training target carries
information the teachers cannot express at inference time. There are
four such sources, and this project owns two of them outright.

| # | source | what it gives | value HERE |
|---|---|---|---|
| **T-1** | **Temporal privilege.** The teacher runs offline over the whole shot, with FUTURE frames. Label the **track**, not the frame: the ensemble's confidence-weighted vote over every frame between two cuts. The student learns "who is this, from this one frame", supervised by an answer computed from fifty. | Turns per-frame noise into a per-identity answer. This is standard privileged-information / omniscient-teacher distillation. | **HIGHEST.** P-2 says 69% of false cover is a *correct read arriving late*; a student that is right on the FIRST frame of a shot removes work the cadence cannot. And it is the one construction that provably exceeds the per-frame teachers |
| **T-2** | **Resolution privilege.** Teachers run on the 1080p source; the student runs on the 640x360 decode. The label comes from pixels the student will never see. | Detection labels for faces that are 13-16px in BlazeFace's model space but 40-50px in the teacher's. | **HIGH for DETECTION (M-1, M-3), LOW for GENDER.** M-4a measured within-identity accuracy delta at **−1.6 points** across the 64px boundary: resolution degrades `nm` and confidence, not the decision. Do not sell T-2 as a gender fix |
| **T-3** | **Ensemble disagreement as a calibration target.** Train the student to predict the *agreement rate* among teachers, not just their mode. | A real, learned abstain — replacing `isNullRead`'s [0.53,0.72] band and the `nm ≥ 5` floor, which are hand-drawn hacks around the age head's training prior (M-5b, M-5c) | **MEDIUM-HIGH.** Those two gates carry M-5's entire 30%-of-reads null-read problem today and are the most fragile constants in the system |
| **T-4** | **Human labels on mined hard negatives.** 107 cluster labels already exist; §3 mines more. Neither teacher has them. | The **only** source that can fix per-subject female recall (M-4), because every model in §2a agrees with faceres about those women or is untested on them | **HIGH and IRREPLACEABLE.** It is also the only thing that makes the §4 benchmark non-circular |

**The trap this framing exists to name.** If the student trains on
teacher labels alone, its ceiling is the ensemble and the ensemble's
systematic blind spots transfer with perfect fidelity. Therefore:

1. The benchmark **must** be human-labelled and held out (§4).
2. The training set **must** include T-4 human labels on the known-bad
   population, not just teacher agreement.
3. Per Stanton et al., the audit that catches a blind spot is a human
   check of frames where **all teachers AGREED** — where no distillation
   loss can see anything wrong.

### 2c. Licence traps, named

1. **InsightFace splits code (MIT) from weights (non-commercial
   research).** SCRFD, RetinaFace-official and `genderage` all inherit
   it. The clause restricts **use**, so an offline-teacher-only defence
   does not obviously survive it. Blocked without a paid licence or
   counsel. (findings §5 reached the same conclusion independently.)
2. **NudeNet is AGPL-3.0 on GitHub while PyPI says MIT.** Trust the
   repo, never the package index.
3. **Sapiens 2's custom Meta licence forbids "biometric processing"** —
   the same clause class that put the Qualcomm QNN delegate out of reach
   on 2026-09-03. Read the licence PDF, not a summary.
4. **ViTPose's Apache-2.0 checkpoints are initialised from Meta's MAE
   ImageNet weights, which are CC-BY-NC-4.0**
   ([mae LICENSE](https://github.com/facebookresearch/mae/blob/main/LICENSE)).
   Whether a third party can relicense a fine-tune of an NC checkpoint
   permissively is unsettled. Prefer RTMPose, whose maintainer confirmed
   the weights in writing.
5. **OneFormer is MIT from SHI-Labs and non-commercial from the NVIDIA
   NGC mirror.** Same weights, different wrapper. Pull from GitHub and
   keep a copy of the LICENSE file as evidence.
6. **WIDER FACE is non-commercial** and casts a shadow over YuNet,
   SCRFD, RetinaFace and every YOLO-face variant. BlazeFace sidesteps it
   by training on Google's own data — which is also why its card
   publishes no WIDER number.
7. **IMDB-WIKI is academic-only**, and both MiVOLO v1 and DeepFace's
   age/gender heads run through it. Apache-2.0 code and weights with a
   non-commercial dataset upstream is not "Apache all the way down".
8. **FairFace: dataset CC BY 4.0, checkpoints have no licence at all.**
   Train on it; do not ship its weights.
9. **YOLOX weights have no maintainer confirmation** ([issue
   #1865](https://github.com/Megvii-BaseDetection/YOLOX/issues/1865),
   open) where RTMPose does. Low risk for an offline teacher, but do not
   record it as confirmed.
10. **D-FINE / DEIM checkpoints pretrained on Objects365** carry
    Objects365's dataset terms on top of the Apache grant.

**The clean set, for the record:** CLIP (MIT/MIT), SAM 2 (Apache/Apache),
RTMPose + RTMO (Apache/Apache, confirmed), RTMDet, RT-DETR, YOLOX,
BiRefNet (MIT), Mask2Former (MIT), OneFormer-from-GitHub (MIT),
Falconsai NSFW (Apache), LAION CLIP-NSFW (MIT), YuNet (MIT/MIT), and
our own 3,465 in-domain labelled crops — **which we may train on and may
not redistribute** (they are frames from copyrighted YouTube videos).

---

## 3. HARD-NEGATIVE MINING FROM WHAT WE ALREADY BANK

### 3a. What exists on disk right now

| asset | volume | carries |
|---|---|---|
| `spikes/gauntlet/events-*.json` | **16 files, 3,629 device reads, 103,676 presented frames, 20-43 cuts each** | per read: `vt` media time, `b` face box, `pb` person box, `g/s/v` gender/score/raw, `ab` null-read flag, `px`, `fc` face confidence, `nm`, `a` age, `pc` childP. Per frame: `pm` presented media time, `p` visible patches, `tgt` merged target, `te`, `tf` |
| **...but** | **all 16 are the SAME clip** — `NWoT1ZVd1Lo`, seek 55.0 (14 × 180s + 2 × 90s) | so the device rings are **16 replicates of one 3-minute clip**, not a diverse pool. State this everywhere |
| `Z:/tamescroll-corpus/bank/reads/*.json` + `.desc` | 18 windows, **3,465 reads**, 1024-d faceres descriptors | the diverse pool |
| `bank/crops/` | **3,465 crops at 112x112 on disk**, 18 window dirs | ready for any teacher, no re-decode |
| `bank/ssd/`, `bank/persons/`, `bank/body/` | 18 `.f32` files | **coco-ssd person boxes already banked per frame** — this is where the 119 M-1 misses live |
| `bank/label/labels.json` | **107 cluster labels** of 184 clusters | 93.7% of reads |
| `Z:/tamescroll-corpus/video/*.mp4` | **10 videos, 378MB, 640x360** | so **any `vt` in any ring is re-fetchable exactly**: `ffmpeg -ss <vt> -i <vid>.mp4 -frames:v 1` through `corpus-lib.grabRaw`, the same decoder the bank used |

Total footprint 847MB. **Nothing in the mining plan below needs a
download or a device run.**

### 3b. Which frames become training signal, and with what label

Ranked by value per human minute.

| set | source | how to extract | label the owner gives | est. rows |
|---|---|---|---|---|
| **H-1. Detector misses — the highest-value set in the file** | `bank/ssd` person-instances with **no read** at that spot (the 119 of 2,131 in findings §11) | already computed by `bench/detector-recall.mjs`; dump `(window, frame t, ssd box)` and re-fetch each frame from disk | *"Is there a person in this box? Man / woman / child / not a person"* — one contact sheet, yes/no plus gender | **119** + a matched 119 random person-instances that WERE seen, as controls |
| **H-2. The 7 bad woman clusters** | `custom-model-2026-09-02.md` §2c | already labelled, already cropped, **zero new labelling** | none needed | **96 reads** — the permanent adversarial subset for every gender arm |
| **H-3. False-cover events** | `cover_source.py` / `trace_cover.py` output over the 16 event files | each row already carries `m` (media time), the read's face box, the covering track's entry and its clamp inputs | *"Is the covered person the same person as the patch's subject, or a neighbour?"* — the P-9 classes | 16-23 rows/run, heavily duplicated across the 16 replicates → **~30-60 distinct** |
| **H-4. Exposure events** | `events_reclass.py` `exposure.rows` — births with uncovered frames (v1096f: 12 of 25 births, **231 uncovered frames**) | `(m0, birth box, framesInWindow)` | *"Was there someone here who should have been covered, at this frame?"* | **~12/run**, ~25 distinct |
| **H-5. Phantom events** | blurred tracks with `missMs > 0` and their coast time | patch box at `pm` | *"Is there a person under this patch?"* — 88% of phantom is unclaimed, so this is the largest class | **hundreds of frames, a handful of distinct tracks** |
| **H-6. Teacher-disagreement set** | run the §2a ensemble over all 3,465 banked crops; take crops where teachers disagree with each other or with faceres | pure compute, no re-decode | gender + child | **UNKNOWN until the ensemble runs — that IS §6.4** |
| **H-7. Teacher-AGREED audit sample** | random sample of crops where **all** teachers agree | pure compute | gender + child | **~200**, and per Stanton et al. this is the sample that detects a systematic teacher bias no distillation loss can see |

**Two sampling rules, both from the literature.**

- Do **not** mine only near-boundary hard negatives. *Beyond Hard
  Negatives: The Importance of Score Distribution in Knowledge
  Distillation* (SIGIR 2026,
  [arXiv 2604.04734](https://arxiv.org/html/2604.04734)) shows that
  hard-negative-only mining under-covers the teacher's score
  distribution. **Stratify H-6 across the whole score range.**
- Do **not** build the eval set from random frames. Random frames
  under-sample exactly the tail where blind spots live — which is why
  H-1 through H-5 exist and why H-7 is separate from them.

### 3c. Owner labelling hours — the honest estimate

The tooling largely exists. `app/gaze/bench/corpus-label.mjs` turns
~1,800 crops into ~40 questions by clustering on the **1024-d identity
descriptor** — identity is independent of the gender decision being
scored, so the clustering is **not circular** — and renders each cluster
as a 12-crop grid with a `mixed` escape hatch. 107 clusters are already
answered.

| task | tool | owner time |
|---|---|---|
| finish the remaining **77 unlabelled clusters** | exists | **~20 min** |
| corpus expansion to ~30 videos (~300 clusters) | exists, needs a scan run | **1.5-2 h** |
| **H-1**: 238 person-presence questions on contact sheets | **NEW: one HTML contact-sheet page**, ~half a day to build | **20-30 min** |
| **H-3/H-4/H-5**: ~150 distinct events, 2 questions each | same page, fed from the ring dumps | **45-60 min** |
| **held-out eval set** (§4): 5 NEW videos, ~10 windows, ~1,000 reads → ~60 clusters + person sheets | existing + new page | **~55 min** |
| **H-7**: 200-crop teacher-agreed audit | existing cluster page | **~15 min** |

**Total: 4-5 hours of the owner's time, spread across sessions, for a
complete non-circular training and evaluation corpus.** That is the
whole human cost of the entire model programme. It should be stated to
him in those words, because it is small and because the alternative —
inheriting teacher blind spots — is not detectable without it.

**One working-agreement conflict to flag before building the contact
sheet.** CLAUDE.md: *"Never render test content on the owner's screen ...
he said it once: 'don't open this trash on my PC'."* A page of 112x112
face crops is not a feed and is almost certainly fine. **H-1's
person-presence sheets show FULL FRAMES**, which is closer to the line.
Either get his explicit OK for that page specifically, or render it on
the emulator / his phone. Do not decide this silently.

---

## 4. WHAT "BEST" MEANS, WRITTEN AS NUMBERS

### 4a. Nobody in this category publishes a number

Sweep of every comparable tool (marketing pages, READMEs, store listings
only — no source read from any AGPL project):

| tool | model it names | accuracy / latency claim | licence |
|---|---|---|---|
| **HaramBlur** | "Human library" + nsfwjs | ***"Decent speed and accuracy (continuously improved)"*** — [README](https://github.com/alganzory/HaramBlur/blob/main/README.MD). Store listing: 80,000 users, 4.9 stars, "real-time". **No number.** | AGPL-3.0 |
| Gaze Guard | "MobileNet V2 provided by NSFWJS" | *"Balanced trade-off between speed and accuracy"*. **No number.** | MIT |
| SafeGaze | not published | **"95% accuracy rate"** and "under 5 seconds" — quoted by a third-party tool directory, unsourced marketing copy, **no methodology, no test set**, and the extension was *removed from the Chrome Web Store on 2025-02-01 for a policy violation* | — |
| Porda AI | "custom-trained machine learning model" | no number; own docs advise users to keep the threshold *"at 40% or lower"* and admit *"video detection may not be perfect for every frame"* | — |
| Muslim AI Browser | none named | "Superfast", "Lightning-fast", "instantly, on-device". **No number.** | — |

**That absence IS the finding.** Every tool in this category names its
models and none publishes a measured accuracy, precision/recall, FPS or
per-frame latency against a disclosed test set. So *"best model out there
for blurring haram content"* is currently an **unfalsifiable claim by
everyone making it**, and the first project to publish a methodology with
numbers wins the argument by default. `custom-model-2026-09-02.md` §8
already proposes exactly that — publishing the evaluation methodology and
the negative results — and this sweep is the strongest argument yet for
doing it.

### 4b. There is no standard metric to borrow, so name ours

- **Tracking metrics do not fit.** `MOTA = 1 − (FN+FP+IDSW)/gtDet` is
  *"heavily biased towards measuring detection at the expense of
  ignoring association"*; `IDF1` is the mirror-image bias.
  `HOTA_α = sqrt(DetA_α · AssA_α)` was built to fix both (Luiten et al.,
  IJCV 2020, [arXiv 2009.07736](https://arxiv.org/abs/2009.07736);
  reference implementation [TrackEval](https://github.com/JonathonLuiten/TrackEval)).
  None of the three charges anything for *how long a person was visible
  and uncovered*, which is our entire product.
- **The redaction literature is closer but has no standard name.**
  Nearest analogues: PrivHAR-Bench's *Face Detection Failure Rate*
  ([arXiv 2604.00761](https://arxiv.org/html/2604.00761v1)); *Re@1*
  re-identification rate; the `deface`-style convention where **a false
  negative is a visible face that was not anonymized in that frame**;
  and *Covered Percent* from *Detecting Invisible People*
  ([arXiv 2012.08419](https://arxiv.org/pdf/2012.08419)), which also
  notes MOTA *"is not an appropriate metric"* for occlusion-heavy
  tracking. **No published "exposure time" metric exists by that name.**
- **So we name it ourselves, consistent with practice** — every paper in
  that literature defines its own leakage metric. Our
  `corpus-score.mjs` triple already is that metric, and it is better
  suited than anything published: it is in **seconds**, it scores
  **both directions**, and it runs through the **shipped** decision
  layer.

### 4c. The targets

His regime: man mode, 640x360, non-fullscreen, ~0.8-2.0s verdict gap,
`DELAY_MS` 1500.

| class | metric | today | **target** | why that number |
|---|---|---|---|---|
| **CHILD** | clears of a human-labelled minor | **unmeasured.** `GENDER_CHILD_MASS` orders the reference pair backwards (M-6); the owner's own reported child sits *below* the gate at childP 0.146-0.194 | **0 clears on n ≥ 300 minor reads across ≥ 20 identities** | zero tolerance. n=300 with 0 events bounds the rate at ≤1% (95%, rule of three). Anything less is not a measurement |
| **CHILD, boundary** | false-adult rate at 18 | literature: **39-100%** for specialised models; reaching 1% needs the threshold at **32, not 18** | **do not chase a model fix. Never clear a read whose apparent age is under ~25**, and price the adult cost in seconds of false cover | the literature says the boundary is unreachable by accuracy. Buy it with policy and *measure the policy's cost* — the thing M-6c shows is currently unpriced |
| **EXPOSURE, presented** | blurred-entry frames with no patch over the subject | v1096f **299 of 4,405 = 6.79%** (healthy range 5-9%) | **≤ 1.0%**, and **0 uncovered runs > 300ms** | 300ms ≈ 9-12 presented frames — the shortest window the owner has ever reported seeing |
| **EXPOSURE, entry** | media-time lag, subject appears → patch over her | **p50 34ms**, p95 401ms | **p95 ≤ 100ms** (3 presented frames) | p50 is already there. The p95 tail is cut keying (P-6) and birth-at-cut, not the classifier |
| **EXPOSURE, undetected** | person-instances seen by neither model | **5.6%** (119/2,131); worst run 14 frames ≈ **7s** | **≤ 2%**, and **0 runs > 2s** | the only class where a better model is the answer |
| **FALSE COVER** | certain same-gender reads covered | device **16 of 82 = 19.5%** (excl. child-gated + cross-cut); corpus **197.5s** man | **≤ 8 of 82 (10%)**; corpus **≤ 160s** | the oracle floor is **143s**. 160s is oracle + 12%. Going below 143s requires changing the SOLID-patch policy, which is his call, not ours |
| **PHANTOM** | patch-seconds with no person | corpus **286.5s** man; oracle + perfect detector floor **252s** | **≤ 200s** | unreachable by any model. It needs the coast dial (−149.5s, already measured) plus the geometry layer |
| **DETECTION** | frontal-head recall, 24-64px | **92-94%** | **≥ 98%** | 64px+ is already 99.8-100%. The whole gap is small faces |
| **NSFW on video** | anything at all | **never run** | **a first measurement** on held-out clips with human labels | you cannot set a target for a class with no instrument |

### 4d. The benchmark protocol, and why each rule is there

Every rule below traces to a failure this repo actually had.

1. **Held-out clips are videos no teacher run used for training ever
   saw.** Human-labelled by the owner. Never teacher labels.
2. **Score in SECONDS through the unmodified shipped decision layer.**
   `corpus-score.mjs`, byte-identical between arms; only the reads
   change. A per-read score cannot see the tracker, and the tracker is
   where every exposure this month lived.
3. **Report all three errors, both gender modes, always.** §1.2: a
   perfect model makes woman-mode exposure *worse*.
4. **Split by CLUSTER, never by read.** 3,465 reads are 107 clusters and
   10 videos. A read-level split trains and tests on the same face.
5. **Slice by px** at minimum `<40 / 40-64 / ≥64`. Three sweeps read
   flat because they ran over a population dominated by faces larger
   than the device sees.
6. **Report per-class recall, not accuracy.** Man recall is 99-100% at
   every size, so overall accuracy mostly measures how many men were in
   the slice.
7. **Score against the ORACLE arm, not against zero.** "Model B beats A
   by 12s" means nothing until set against the 68s that perfection is
   worth.
8. **Any exposure metric MUST join to the PRESENTED picture
   (`frames[].p`), never to verdict-arrival timing.** Critic phase-m M1:
   the exposure classifier read only snapshot arrival times, and printed
   *identical* numbers on the run whose renderer was **dead for 90.7% of
   the wall clock** as on the healthy ones. A timing-only metric is
   structurally incapable of reporting a frozen patch, a mispositioned
   patch, a subject never tracked, or a hindsight rule presenting a
   covered woman as cleared.
9. **An instrument that re-derives a shipped rule is a check that cannot
   fail.** Phase-G built three in one session. Import the rule from the
   module, out of the **emitted bundle**, and call it from both sides.
10. **Report student-vs-teacher AGREEMENT and student-vs-human ACCURACY
    separately on the held-out set. A gap between them IS the
    blind-spot signal** (Stanton et al. — fidelity ≠ generalization).
    Additionally audit a human sample of frames where **all teachers
    agreed**, since that is where a systematic teacher bias hides from
    every distillation loss.
11. **The adversarial subset is mandatory and fixed**: the 7 woman
    clusters below 50% (H-2), the 119 detector misses (H-1), the known
    child cases, and the graphics/title-card population. A model that
    improves the average and regresses these has not improved.
12. **Red-before-green on every new check.** This repo has twice shipped
    a test that could not fail — a `#[test]` attribute missing from a
    Rust function with ten live assertions, and three JS tests that
    passed against the pre-fix source.
13. **A corpus win is not a win until a device A/B on the read rings
    agrees.** The corpus cannot see live-MSE compression artefacts,
    WebGL float behaviour on Adreno 610 (M-10), or detector recall.

**No commercially-licensed video dataset with per-frame person + gender +
age labels exists.** Closest: P-Age (4,500 Pexels videos, **age only**,
annotation terms unstated, [arXiv 2311.02432](https://arxiv.org/abs/2311.02432));
MIAP (perceived gender + age range, annotations CC BY 4.0, but
**images not video**, [arXiv 2105.02317](https://arxiv.org/abs/2105.02317));
Casual Conversations v2 (26,467 videos with self-reported age/gender,
**non-commercial academic only**). So the eval set has to be ours, which
is the same conclusion §3c reaches from the other direction.

---

## 5. THE HONEST CEILING — what a better model cannot fix

At a ~0.8-2.0s verdict cadence with a 1.5s delay line, these owner
complaints are **out of reach of any classifier**, with the number that
says so:

| his words | why a model cannot fix it | the number |
|---|---|---|
| *"Linus still gets covered"* | **69% of false cover is a CORRECT read arriving late.** 115.0s of 216.5s is male, has descriptor signal, is adult, and clears the bar at **score p50 0.71** — covered anyway | findings §3 |
| *"random blur marks here and there"* | **~88% of phantom is unclaimed patches** — stale tracks, coasting, oversized synthetic bodies. A perfect model moves phantom 286.5 → 278.0s (3%) | §1.2 |
| *"the blur stays up longer"* | `CLEAR_STREAK_N` = 2 verdicts, so at a 1.5s cadence there is a **3-second floor of blur on every track birth**, whatever the model says | findings §2 |
| *"the opposite gender visible for a second"* | bounded by the delay line and by cut keying — the cut is **100ms wide and treated as a point**, so **145-165 presented frames per run** are resolved against the previous shot | phase-m M4 |
| *"covered in one frame and sharp in the next"* | that was the ghost gate keying on frame `maxKp`, where refused faces topped out at **0.098** and kept faces started at **0.101** — a gate, on a quantity that carries no information about the face; and underneath it, a broken WebGL runtime (M-10) | detection-engine.md, findings §25 |

**What fixes them is the CLOCK, and the clock is bought with
performance, not accuracy.** Findings §2 / §13a: verdict interval
1.5s → 0.5s is worth **19 seconds** of man-mode exposure. A perfect
classifier is worth **4.5 seconds** of exposure and **68 seconds** of
total error. The cadence lever is the same order as the entire model
prize and it costs no licence, no dataset and no training pipeline.

The performance levers that buy the cadence are **not repeated here** —
see `docs/research/wild-performance-2026-09-03.md`, specifically its
rows **#2** (refuse AV1, 0 or 5-10 points), **#3** (60Hz cap on his 90Hz
phone, 3-8), **#4** (GPU texture ring, 2-4), **#5** (blur into the
presented frame, 1-3) and **#10** (NPU, which would cut the 3.5
inference points to ~0.5 on his phone). Its **#16** — block-matching
motion on the 16x16 luma grid we already compute at 10Hz, to move
coasting patches by measured displacement instead of a decayed velocity
— is the one row on that list that is an *accuracy* item, and it is the
prerequisite for #17.

**The single most useful sentence in this document: the accuracy
roadmap and the performance roadmap are the same roadmap.** Every point
of dropped frames recovered buys verdict cadence, and verdict cadence is
worth more than a perfect classifier.

---

## 6. RANKED PLAN — accuracy per engineering day

Ranked across **all** classes, not just the model track, because the
brief asks for the best ratio and the model track does not win it.

### 6.0 The zeroth item is not a build: push the coast dial

`PTRACK_MIN_COAST_PASSES` 2 → 1.33. **−26% phantom (149.5s man /
185.0s woman) plus −18.5s / −7.5s false cover, for +4.5s / +4.0s
exposure**, at pinned verdict count — **not one extra inference**. It is
built, clamped, OTA-deliverable with no install, and measured twice.

It is an **EXPOSURE trade, so it is the owner's ruling**, and it has been
waiting on him since 2026-09-02. *Zero engineering days.* Highest ratio
in this file by an unbounded margin.

**Measurement that proves it:** push `rules/tuning.json`, then re-read
his rings for phantom and exposure counters over a 180s window on the
same clip.

### 6.1 Key the cut at the previous gate sample — hours

P-6: `gateTick` runs at 100ms and `cutMediaTime()` keys the cut at the
**sample**, up to 100ms after the frame that carried it, so 3-4
presented frames of the NEW shot are resolved against the OLD shot's
snapshot — carrying the old shot's `cleared` states onto whoever entered
on the cut. The round's own offline classifier already compensates with
a `c − 0.15` floor; `boxesAt` does not.

**Fix:** key the cut at the previous gate sample's frame time, or
subtract `GATE_INTERVAL_MS`, so `cutBetween` errs toward the new shot.

**Measurement:** sweep `frames[].pm` against `cuts[].vt` in the banked
event files for `c−0.100 < pm ≤ c` — 145-165 frames per run today, must
go to ~0 — then re-run `events_reclass.py` for `bornBlurredAtCut` and
`demotedAtCut` (1 and 2 in v1096f).

### 6.2 Price the detector-recall class in SECONDS — 1 day. **GATE ON EVERYTHING BELOW.**

The one error class this product has never measured, and the only crack
in the oracle ceiling. Everything needed is already banked: `bank/ssd`
carries coco-ssd person boxes per frame, `bench/detector-recall.mjs`
already computes the 119 misses, `corpus-score.mjs` already scores in
seconds.

**Build:** extend the scorer to charge EXPOSURE for a banked
person-instance with **no read** whose label says cover, using H-1's
human labels for the gender of those 119.

**Measurement:** man-mode exposure moves 7.5s → X.

- **X < 20s** → the model question is closed for good. Every remaining
  accuracy day belongs to the decision layer. This is the likeliest
  outcome and it is worth a day to know it.
- **X > 60s** → a detector project is justified on measurement for the
  first time in this project's history, and §6.5's T-2 resolution
  privilege is the mechanism.

### 6.3 The free swaps, scored through the unchanged protocol — 1 day each

No training, no dataset licence, no maintenance obligation.

| swap | why | licence |
|---|---|---|
| **BlazeFace full-range** (1.0MB) | the **untried** variant of the model we already ship; the short-range card explicitly warns against "detecting people further than 2 meters", which is M-3 exactly | Apache-2.0 / Apache-2.0 |
| **YuNet** | the only permissive detector with a **disclosed WIDER-hard score** (0.708-0.7503; BlazeFace publishes none) and explicit design for 10-300px faces | MIT / **MIT** |
| **face-api.js `age_gender_model`** | 420KB against faceres' 6.98MB, and it might pay for itself in bundle size alone | MIT code, **public-domain** recognition weights by Davis King's explicit grant |

**Measurement:** §4d protocol in full — re-run over the 3,465 banked
PPM crops, replay `corpus-score.mjs` unchanged, all three errors, both
modes, sliced by px, against the oracle arm, with H-2's 7 bad woman
clusters reported separately.

### 6.4 Measure the TEACHER ENSEMBLE's own error before building any student — 2 days, desktop only

**The cheapest kill-shot in the plan.** Run CLIP (MIT/MIT, >96% gender
across all FairFace race groups), MiVOLO v1 (Apache/Apache, MAE 5.10y)
and SigLIP2 (Apache/Apache) over the 3,465 crops already on disk. Score
against the 107 human cluster labels, sliced by px.

**Measurement, and it decides the programme:**

- Ensemble balanced accuracy vs faceres, overall and per px band.
- **Ensemble accuracy on the 7 woman clusters below 50% (H-2).** If the
  ensemble does not beat faceres *there*, **no student distilled from it
  can**, and the model project ends on two days of desktop compute.
- Agreement rate between the three teachers, which sizes H-6 and H-7 and
  tells you whether an ensemble carries any signal beyond one member.

### 6.5 The temporal teacher — ~1 week, and ONLY if 6.2 and 6.4 both survive

The only construction in which a student legitimately exceeds its
teachers (§2b, T-1). **Label the TRACK, not the frame:** the ensemble's
confidence-weighted vote over every frame between two cuts, computed
offline at 1080p with future frames available (SAM 2 is video-native and
Apache/Apache; RTMPose supplies extent). Train the student to predict
that answer from **one** 640x360 frame. Add T-3 (predict the ensemble's
agreement, giving a learned abstain that replaces `isNullRead`'s band
and the `nm` floor) and T-4 (human labels on the mined hard negatives,
the only thing that can move M-4).

**Measurement, in this order and no other:**

1. Per-read accuracy on held-out **clusters** vs faceres, sliced by px,
   with per-class recall.
2. Replayed through `corpus-score.mjs` unchanged, against the **oracle**
   arm — the prize is capped at 68s in man mode and the student must be
   scored against that, not against zero.
3. **Agreement-vs-accuracy gap** on the teacher-agreed audit sample
   (H-7). A student that agrees with its teachers and is wrong about the
   humans has inherited the blind spot.
4. A device A/B on the read rings before it is called a win.

### 6.6 The honest framing of that list

Items 6.0 through 6.4 are **roughly four engineering days plus one owner
ruling**, and two of them can end the entire model programme on
measurement. Item 6.5 is a week plus a **permanent maintenance
obligation** — a training pipeline, a data-provenance record, a
reproducibility burden and a re-training duty every time the input
distribution moves — for a solo beginner developer whose fallback, if it
is not maintained, is worse than the status quo.

And all six are competing with the cadence work in
`wild-performance-2026-09-03.md`, which this repo's own numbers price
higher than a perfect classifier (§5).

---

## What this run did not do

No device run, no build, no commit, no source touched. Every repo number
is quoted from an existing measurement with its file named; every
external claim carries a URL. Nothing here is new evidence — the two new
things are the **error taxonomy split** (§1.5) and the **four sources of
teacher-beating privilege** (§2b), both of which are arguments over
existing numbers, not measurements.

**The first thing the next session should do is §6.2**, because it is
one day and it is the only measurement in this file that can close a
question rather than open one.

**Unverified, flagged rather than guessed:** DINOv3's exact terms;
`av-savchenko/HSE_FaceRec_tf`'s upstream licence (which governs the
gender model we ship today); VGGFace2's current text; SigLIP2's training
corpus and any zero-shot gender number; OpenCLIP per-checkpoint
licences; Microsoft's non-generative output-training clause; DWPose's
UBody terms; YuNet's WIDER-hard number (0.708 vs this repo's banked
0.7503 — version drift, read the current README).
