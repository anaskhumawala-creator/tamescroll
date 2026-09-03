# Prior-art scan: one-model replacement for MoveNet+BlazeFace+HSE-FaceRes

Scope: single-model or distillation candidates to replace tamescroll's 3-model
verdict (MoveNet MultiPose Lightning + BlazeFace + HSE-FaceRes). Hard rule:
no AGPL/GPL, no non-commercial-only weights (app ships inside an MPL-2.0
binary, App Store + Play Store). Licence claims cite the file/card I read,
not blog posts, except where noted [snippet-only, unverified].

---

## 1. Existing single/multi-task models (detect + pose/person + attributes in one pass)

| Model | Licence (source) | Input | Params | Mobile latency (published) |
|---|---|---|---|---|
| **MediaPipe BlazePose (Pose)** | Apache-2.0 (mediapipe repo; tfjs-models pose-detection Apache-2.0) — https://github.com/google-ai-edge/mediapipe, https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/blazepose_mediapipe/README.md | 256x256 (full), detector-then-landmark two-stage | not published per-variant in the README I read | designed for 30fps on Pixel-class phone (Google Research blog, no ms figure given) |
| **MediaPipe Holistic** | Apache-2.0 (same repo) | multi-stage (pose+face+hands) | not published | heavier than Pose alone — 3 sub-models chained, not a single pass; poor fit for "one model" |
| **MoveNet Lightning/Thunder (single-person)** | Apache-2.0, same family we already ship (MultiPose) | 192x192 (Lightning) | not published as param count on tfhub card | already in-tree; single-person variant has no multi-person box, doesn't remove BlazeFace/FaceRes need |
| **YuNet** | MIT — https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md (dir-level LICENSE) | 320x320 default, configurable | **75k params** | not published in ms; ncnn/int8 variants target edge CPUs, "millisecond-level" per paper title only |
| **SCRFD** (InsightFace) | **Code MIT** (insightface repo root); **pretrained weights: non-commercial research only, contact for commercial licence** — https://github.com/deepinsight/insightface/blob/master/detection/scrfd/LICENSE and repo README | 320-640 configurable | 0.5G-34G GFLOPs family (SCRFD-500MF smallest) | reported in paper as real-time on ARM, no phone ms in the pages I read | 
| **RetinaFace (biubug6 PyTorch reimpl, MobileNet0.25 backbone)** | MIT — https://github.com/biubug6/Pytorch_Retinaface/blob/master/LICENSE.MIT | 640 (train), configurable | **1.7MB model** (MobileNet0.25 backbone) | no ms figure in README; 80.99% WiderFace-hard AP | 
| **RetinaFace (original insightface release)** | Same insightface-root MIT for code; original paper weights inherit the non-commercial caveat above — verify per checkpoint before use | — | — | — |
| **YOLOX (incl. YOLOX-Nano)** | Apache-2.0, **code AND pretrained weights** — https://github.com/Megvii-BaseDetection/YOLOX/blob/main/LICENSE | 416/640 | Nano/Tiny smallest variants (param counts on repo table, not fetched here) | YOLOX-L: 68.9 FPS on V100 (not mobile); Nano/Tiny are the mobile-targeted variants |
| **NanoDet-Plus** | Apache-2.0 — https://github.com/RangiLyu/nanodet/blob/main/LICENSE | 320x320 typical | 980KB (int8) / 1.8MB (fp16) | **97 FPS on cellphone** (repo README, device unspecified beyond "cellphone"; ARM bench quoted on Kirin 980 via ncnn) |
| **PP-YOLOE / PP-PicoDet (PaddleDetection)** | Apache-2.0 — PaddleDetection repo licence | PicoDet mobile-sized | PicoDet-family sub-3M | benched on Snapdragon 865 per repo docs [snippet-only, no ms quoted] |
| **RT-DETR / RT-DETRv2** | Apache-2.0 — https://github.com/lyuwenyu/RT-DETR/blob/main/LICENSE | 640, transformer decoder | tens of M (not phone-class as shipped) | GPU-oriented (real-time = GPU real-time, not mobile CPU); wrong shape for this app |
| **YOLO-NAS (SuperGradients)** | **Framework code Apache-2.0; official Deci pretrained weights are a separate NON-COMMERCIAL licence — production/commercial use, modification and reverse-engineering all prohibited** — https://github.com/Deci-AI/super-gradients (YOLONAS.md) + multiple maintainer issue threads (#894, #1174, #1993) | — | — | **EXCLUDED as shipped**; only usable if retrained from scratch under Apache code, which is a training-data + compute project, not a swap |
| **CenterNet ("Objects as Points")** | MIT, some borrowed sub-components carry their own licences per NOTICE — https://github.com/xingyizhou/CenterNet | varies by backbone | — | anchor-free single-stage; a center-point head can in principle carry face-box + person-box + an attribute regression head, but no published mobile-phone ms and no ready attribute head — would need training |
| **MTCNN** | Original Caffe release has no clear permissive licence attached to weights; the widely-used **ipazc/mtcnn Python package is MIT** but is a third-party reimplementation, not the paper's official release — verify per fork | 12/24/48px cascade | tiny (P/R/O-net, <100k combined) | cascade design (3 sequential nets) — same "not one model" problem as our current 3-model chain, just smaller |
| **FaceX-Zoo (JDAI/Tencent)** | Apache-2.0 — https://github.com/JDAI-CV/FaceX-Zoo | toolbox, many backbones | varies | toolbox not a single fixed model; would need to pick one attribute head out of it |
| **MiVOLO / MiVOLO v2 (age+gender transformer)** | **Repo LICENSE file fetched directly = Apache-2.0** (raw githubusercontent.com/WildChlamydia/MiVOLO/main/LICENSE, confirmed Apache header text). HF model cards for both mivolo_v2 and the original also list apache-2.0. Face+body multi-input transformer. | face crop + optional body crop | transformer-based, not phone-class as published (targets server/desktop CV, no published mobile quantized variant) | no phone ms published; this is a strong **teacher**, not a **student** — too big to ship as our runtime model without your own distillation/quantization pass |

### Notes on ones NOT usable
- **YOLOv5/v8/v11 (Ultralytics)** — AGPL-3.0, hard-excluded per your rule (not searched further, already known).
- **HaramBlur** — AGPL, never read, not searched.
- **InsightFace pretrained face-detection/recognition checkpoints generally** — code root is MIT, but the project's own README and multiple checkpoint pages gate the actual weights behind "non-commercial research only, contact for commercial licence." This applies to SCRFD's shipped weights and to many ArcFace/RetinaFace checkpoints hosted in that repo. **Treat every insightface-hosted `.onnx`/`.pth` as non-commercial until you find a checkpoint-specific licence file saying otherwise** — the MIT root licence covers the *code*, not automatically the *weights*.
- **YOLO-NAS weights** — excluded as shipped (see table). Apache-2.0 only covers the SuperGradients training code.

---

## 2. Distillation prior art for "multi-teacher → one mobile student, detection + attributes"

| Work | Shape | Reported numbers |
|---|---|---|
| Chen et al., **"Learning Efficient Object Detection Models with Knowledge Distillation"** (NeurIPS 2017) — https://proceedings.neurips.cc/paper_files/paper/2017/hash/e1e32e235eee1f970470a3a6658dfdd5-Abstract.html | Single teacher → compact student detector; weighted cross-entropy for class imbalance + teacher-bounded regression loss + adaptation layers for intermediate features | Abstract claims "consistent improvement in accuracy-speed trade-offs"; I could not pull exact mAP deltas from the pages fetched (paywalled full-text not fetched) — cite as methodology precedent, not a number. |
| **FitNets: Hints for Thin Deep Nets** (Romero et al., 2015) — https://arxiv.org/abs/1412.6550 | Intermediate-layer "hint" regression from teacher to a thinner/deeper student, not just output-logit distillation. This is the standard reference for feature-map (not just softmax) distillation used by nearly every later detector-distillation paper. | CIFAR-10: a student with **~10.4x fewer parameters outperformed** its larger teacher; smallest FitNet variant (250K params) had ~1% accuracy degradation, larger FitNet variants beat the teacher outright. (Classification benchmark, not detection — cited because every detector-KD paper below builds on this hint-loss idea.) |
| **Cao et al., "Learning Lightweight Object Detectors via Multi-Teacher Progressive Distillation"** (ICML 2023) — https://arxiv.org/abs/2308.09105 | Sequence of teachers of increasing capacity, each stage narrowing the capacity gap before the next; explicitly multi-teacher, explicitly for lightweight/mobile-shaped students; first reported successful Transformer-teacher → CNN-student distillation for detection. | ResNet-50 RetinaNet **36.5% -> 42.0% AP** on COCO; Mask R-CNN **38.2% -> 42.5% AP**. This is the closest published match to "several teacher models -> one small student" for exactly this class of problem. |
| Survey: **"Knowledge Distillation in Object Detection: A Survey from CNN to Transformer"** — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12788226/ | Taxonomy of logit-, feature-, and relation-based detector distillation, useful as a map of techniques rather than a single number | n/a — use as a reading index if a distillation project is actually undertaken |
| DINO / self-distillation (Caron et al., "Emerging Properties in Self-Supervised ViTs") — https://huggingface.co/papers/2104.14294 | Teacher = EMA of student, no labels; produces embeddings good enough for k-NN classification and dense correspondence without a classification head. Smallest published variant **ViT-S/16, 21M params, 384-dim embedding**. Not a face-specific method and no face-verification numbers found in the pages fetched. | Relevant to §3's descriptor need (cosine similarity across a video) as a *training method* for a small descriptor network, not as a ready-made face model — would need retraining/fine-tuning on faces, which is a real project, not a drop-in swap. |

**Verdict on §2:** the multi-teacher-progressive-distillation shape (Cao et al. 2023) is the right template for "MoveNet + BlazeFace + FaceRes teachers -> one student," but every number above is a training project measured in weeks, not a licence swap. No paper found that ships a pretrained detection+age+gender+descriptor multi-task student ready to embed — this repo would be originating the student weights itself, which also means the licence problem (AGPL/non-commercial) mostly disappears for the *weights* (you'd own them) but the *teacher* used to train against still has to clear licence if any of its code or weights are embedded/redistributed in the process.

---

## 3. Small identity descriptors (Apache/MIT, cosine-matchable, NOT a recognition-database task)

| Model | Licence | Size/params | Fit |
|---|---|---|---|
| **SFace (OpenCV Zoo)** | Apache-2.0 — https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE (dir-level, OpenCV Zoo root also Apache-2.0) | ONNX, ships in opencv_zoo; ready-made cosine/L1 distance demo built in (`--dis_type 0` = cosine) | Best-fit direct swap for HSE-FaceRes' descriptor half: Apache-2.0, purpose-built for exactly "cosine distance between two crops," no database/identification claim needed. |
| **MobileFaceNet (multiple reimplementations)** | Licence **varies by fork** — e.g. foamliu/MobileFaceNet has its own LICENSE file (check per-fork before use); sirius-ai/MobileFaceNet_TFLite_Android referenced as MIT by at least one downstream MIT-licensed app. InsightFace's own MobileFaceNet backbone is under the insightface root MIT for *code*; the *trained weights* commonly distributed alongside it inherit the same non-commercial caveat as §1's SCRFD note unless a specific commercial-clear checkpoint is named. | ~1M params (paper), designed for real-time mobile verification | Usable as a **teacher or architecture reference** (the MobileFaceNet paper's own network design is well documented and small enough to retrain in-house under a clean licence); do not embed a downloaded MobileFaceNet `.tflite`/`.pth` from an unverified fork without checking that specific file's licence. |
| **FaceNet-mobile reimplementations (e.g. davidsandberg/facenet)** | davidsandberg/facenet repo carries its own LICENSE.md (MIT per search snippet [unverified against raw file]) | Inception-ResNet-based, not mobile-sized by default | Weaker fit — original FaceNet backbone is not phone-class; only the "small-embedding-network" idea transfers, not a ready weight file. |

**Verdict on §3:** SFace is the cleanest Apache-2.0, ready-to-embed descriptor model for the "cosine match ~0.6 across a video" job HSE-FaceRes' 1024-d output currently does. It ships as ONNX in opencv_zoo (would need conversion to tflite/tfjs, same conversion work already done in-house for MoveNet/BlazeFace).

---

## 4. Age/child gating — Apache/MIT model with a published child-probability accuracy on 12-18 y/o

**No Apache/MIT model or head was found with a published, dedicated accuracy figure specifically for the 12-18 age band and a "child probability" output.** What exists instead, all general age/gender literature, none of it a ready-made child-mass head:

- FairFace: overall gender accuracy **95.7%**; age accuracy **~86%** on FACES benchmark; errors concentrate at **adjacent age-bin boundaries** (its own 10-19 bin sits directly against 20-29 and 3-9 — i.e., a 12-18 y/o is structurally the highest-confusion band in this dataset's own bucketing). https://www.emergentmind.com/topics/fairface-dataset [aggregated secondary source, not the paper PDF itself].
- UTKFace: overall gender accuracy **90.4%**; class distribution is heavily adult-skewed (**34.04% "young adult," only 4.98% "teenager"**) — a model trained on UTKFace without rebalancing will underrepresent exactly the band tamescroll needs (docs/detection-engine.md's own finding — a known 12-year-old read childP 0.146-0.194 against a 0.25 gate — is consistent with this: the training distribution barely samples that age).
- MiVOLO (Apache-2.0, §1) reports SOTA age+gender numbers on IMDB-Clean/UTKFace/FairFace/its own LAGENDA dataset, and its LAGENDA dataset claims to be "well-balanced" across ages — this is the single most promising Apache-2.0 lead for a *better-calibrated* age head, but no isolated 12-18 accuracy number was surfaced in the pages fetched here, and its published model is transformer-scale (not phone-class) — would need distillation before shipping.
- General finding across bias literature (arxiv 2510.17873, 2009.11491, 2005.07302 — titles only, not fetched in full): gender-classification accuracy **drops sharply for faces under ~15-18**, and the drop is asymmetric (worse for young male faces in at least one cited study), which matches this repo's own measured childP-band failure exactly.

**Verdict on §4:** nothing found is a drop-in fix. MiVOLO's LAGENDA dataset + Apache-2.0 code is the best lead if you were to train your own compact child-mass head (retrain small, distill MiVOLO's balanced-data advantage into a tiny head) — this is a training project, not a licence-clear download.

---

## 5. Verdict table

| Candidate | Role | Why |
|---|---|---|
| MediaPipe BlazePose | excluded (size/shape) | Apache-2.0 fine, but multi-stage itself (detector+landmark), no attribute head, no accuracy win over MoveNet we already ship |
| YuNet | usable as extra TEACHER (face-only) | MIT, 75k params, trivial to run offline for face-box ground truth during distillation; too small/simple to also carry person+gender+age+descriptor as one head without redesign |
| SCRFD (code) | excluded as weights, usable as ARCHITECTURE reference only | MIT code but the practical pretrained checkpoints are non-commercial-gated; safe only if retrained from scratch |
| RetinaFace (biubug6, MobileNet0.25) | usable as extra TEACHER (face-only) | MIT, tiny (1.7MB), good WiderFace-hard number, clean licence on this specific fork's weights |
| YOLOX-Nano/Tiny | usable as STUDENT backbone candidate | Apache-2.0 for code AND weights, mobile-oriented variants exist, anchor-free single-stage — plausible base to retrain as a person+face multi-head detector |
| NanoDet-Plus | usable as STUDENT backbone candidate (strongest single lead) | Apache-2.0, sub-2MB, 97fps-on-a-cellphone claim, anchor-free FCOS-style head is easy to extend with extra output channels (age/gender/descriptor) without architecture surgery |
| PP-PicoDet | usable as STUDENT backbone candidate | Apache-2.0, purpose-built mobile, Snapdragon-benched by its own team; same extendable-head argument as NanoDet |
| RT-DETR / RT-DETRv2 | excluded (size/shape) | Apache-2.0 fine on licence, but GPU-real-time not phone-CPU-real-time; wrong weight class |
| YOLO-NAS | excluded (licence) | official weights are non-commercial; code-only Apache-2.0 is not enough without a from-scratch retrain |
| CenterNet | usable as extra TEACHER / architecture reference | MIT, anchor-free center-point design is a natural place to attach an attribute regression head, but no mobile-phone latency published and would need training either way |
| MTCNN (ipazc fork) | excluded (still multi-model cascade) | MIT but 3 sequential nets — doesn't solve "one model," and original paper weights' licence is unclear |
| FaceX-Zoo | usable as extra TEACHER (toolbox of backbones) | Apache-2.0, good for generating training labels/embeddings during a distillation run, not a single fixed model to ship |
| MiVOLO / MiVOLO v2 | usable as extra TEACHER (age+gender) | Apache-2.0 confirmed on the repo's own LICENSE file; strong published age/gender accuracy and a claimed balanced dataset (LAGENDA), but transformer-scale — too big to ship as the student itself |
| SFace | usable as STUDENT component (descriptor head) or drop-in identity-descriptor replacement | Apache-2.0, ready cosine-distance ONNX, purpose-matches the "cosine ~0.6 across a video" job exactly; smallest, cleanest single swap available in this whole scan |
| MobileFaceNet | usable as extra TEACHER / architecture reference | Paper design is small and well-documented, but licence varies per hosted checkpoint — verify per file, do not embed blind |
| FitNets-style feature distillation | METHOD, not a model | Apache/MIT-agnostic (it's a training technique) — this is the mechanism you'd use to compress MoveNet+BlazeFace+FaceRes's combined knowledge into one NanoDet/PicoDet-shaped student |
| Cao et al. multi-teacher progressive distillation | METHOD, not a model | Closest published methodology to "3 teachers -> 1 mobile student, detection-shaped"; treat as the recipe, budget it as a multi-week training project |

## Bottom line for the owner

No existing single pretrained model, cleanly licensed, does person-box + face-box + gender + age + descriptor in one mobile-sized pass. The two real paths:

1. **Fastest, smallest risk:** keep 3 models but shrink them — swap HSE-FaceRes' descriptor half for **SFace** (Apache-2.0, purpose-built, likely much smaller than faceres' 1024-d head) and/or swap BlazeFace for **YuNet** (MIT, 75k params) — neither is "one model" but both are real size/licence wins with near-zero project risk.
2. **The one-model ask, for real:** pick **NanoDet-Plus or PP-PicoDet** (Apache-2.0, sub-2MB, mobile-native, anchor-free head that's straightforward to extend with extra output channels) as the student architecture, and run a **multi-teacher progressive distillation** (Cao et al. 2023 shape) using the *existing* MoveNet + BlazeFace + HSE-FaceRes (and optionally MiVOLO for a better-calibrated age/gender teacher) as teachers. This is a multi-week training-data-and-compute project, not a swap, and every teacher's licence still governs whether its *code* can be embedded in the training pipeline — the *student weights that come out the other end are yours to license*, which is what actually gets to "one model, one clean licence."

## Sources consulted (URLs)
- https://github.com/google-ai-edge/mediapipe
- https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/blazepose_mediapipe/README.md
- https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md
- https://github.com/deepinsight/insightface/blob/master/detection/scrfd/LICENSE
- https://github.com/deepinsight/insightface (root README, licence claims)
- https://github.com/biubug6/Pytorch_Retinaface/blob/master/LICENSE.MIT
- https://github.com/Megvii-BaseDetection/YOLOX/blob/main/LICENSE
- https://github.com/RangiLyu/nanodet/blob/main/LICENSE
- https://github.com/PaddlePaddle/PaddleDetection (licence)
- https://github.com/lyuwenyu/RT-DETR/blob/main/LICENSE
- https://github.com/Deci-AI/super-gradients/blob/master/YOLONAS.md (+ issues #894, #1174, #1993)
- https://github.com/xingyizhou/CenterNet
- https://github.com/ipazc/mtcnn
- https://github.com/JDAI-CV/FaceX-Zoo
- https://raw.githubusercontent.com/WildChlamydia/MiVOLO/main/LICENSE (fetched raw, confirmed Apache-2.0 text)
- https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE
- https://github.com/foamliu/MobileFaceNet/blob/master/LICENSE
- https://github.com/davidsandberg/facenet/blob/master/LICENSE.md
- https://proceedings.neurips.cc/paper_files/paper/2017/hash/e1e32e235eee1f970470a3a6658dfdd5-Abstract.html
- https://arxiv.org/abs/1412.6550 (FitNets)
- https://arxiv.org/abs/2308.09105 (Cao et al., multi-teacher progressive distillation)
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12788226/ (KD-in-detection survey)
- https://huggingface.co/papers/2104.14294 (DINO)
- https://www.emergentmind.com/topics/fairface-dataset [secondary/aggregated, not the FairFace paper PDF itself]
- arxiv 2510.17873, 2009.11491, 2005.07302 (bias-in-gender-classification titles, abstracts only — not fetched in full)
