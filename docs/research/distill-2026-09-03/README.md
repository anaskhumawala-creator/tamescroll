# One model, "best out there", in a day -- the research run, 2026-09-03

Six tracks, all read-only, none run on a device. Raw: `track-recipe.md`
(distillation recipe + 24h cut + cloud table), `track-data.md` (what is
banked), `track-prior-art.md` (clean-licence candidates), `track-deploy.md`
(integration + the bench that gates shipping), `track-accuracy.md` (what
"better than the teachers" would take), `track-flow.md` (GPU optical flow
between verdicts). The owner's asks, verbatim: "distill all stuff we're
using in the most optimized form", "the best model out there for blurring
haram content ... everything needs to be super dialed in", "we need to be
able to do this in a day".

## The verdict in five sentences

1. **A student distilled from our three teachers is a LATENCY project, not
   an accuracy one.** It cannot beat its teachers, and a PERFECT gender
   model would remove only 13.7% (man mode) / 24.1% (woman mode) of scored
   error (`custom-model-2026-09-02.md` s3). 72-86% of the error is the
   decision layer and the cadence.
2. **65% of the latency prize needs no training.** MoveNet's 160ms is ~36ms
   of compute plus two delegate boundaries and a CPU decode tail (112 of 237
   nodes on the GPU). Split at the six conv heads, decode in Kotlin:
   verdict 255 -> ~135ms. Same day, zero licence surface. (recipe s1,
   GPU-REPORT.md; spike in flight under `spikes/native/HEADS-REPORT.md`.)
3. **The student, if built:** two nets (MobileNetV3-Large at 320x192 with
   CenterNet-style dense heads incl. 17 keypoints, decode outside the graph;
   a MobileNetV3-Small on the 112px face crop for gender/age/descriptor).
   Predicted 255 -> ~50ms fp16 GPU. ~5h per training run on the 3060 Ti,
   3-4 runs; $1.19-1.99 per run on a rented A100 in one hour; Kaggle's free
   P100 is the best free arm. Training data needs 150-400 downloaded videos
   (ToS class of idea #20) -- **his ruling**. Integration + bench + rollout
   = 20.5 engineering days on top (deploy s6).
4. **"Best out there" is currently unclaimed by anyone with a number.**
   HaramBlur says "decent"; the one published figure (SafeGaze 95%) is
   unsourced marketing for an extension removed from the store. The first
   project with a methodology + numbers wins by default. Ours already has
   the instrument; what it lacks is a human-labelled, non-circular eval set
   (~4-5 owner hours through `corpus-label.mjs`).
5. **The 24-hour cut is a speed proof, not a shippable model.** The
   uncompressible step is the accuracy gate, not the training.

## What ships from this, in order (cost / gain / who decides)

| # | change | days | gain | gate |
|---|---|---|---|---|
| 0 | `PTRACK_MIN_COAST_PASSES` 2 -> 1.33 over OTA | 0 | -26% phantom, +4.5s man exposure per 18 windows | **his ruling, open since 2026-09-02** |
| 1 | MoveNet heads split + Kotlin decode | 1 | verdict 255 -> ~135ms | parity on 100 frames vs the full model (spike running) |
| 2 | GPU delegate kernel cache (`setSerializationParams`) | 0.5 | ~8s -> <1s init on the second launch | measured on the Redmi (agent running) |
| 3 | one frame per verdict, crops in Kotlin | 3-5 | 1+N uploads -> 1, crop work off the JS thread, enables 320x192 | crop-geometry parity table (design in flight) |
| 4 | key the cut at the previous gate sample | hours | 145-165 presented frames/run resolved against the right shot | probe_events replay |
| 5 | price detector recall in seconds (119 of 2,131 person-instances seen by NEITHER model, p50 0.38 of frame height, a third women) | 1 | decides whether any model work is worth it | `bank/ssd` is banked; corpus-score must gain a missed-detection class first (deploy s3) |
| 6 | free swaps: BlazeFace full-range, YuNet (MIT), SFace (Apache) descriptor | 1-2 each | small-face recall, cleaner descriptor | the loop-34 parity table per head |
| 7 | teacher-ensemble kill-shot: does RTMPose + CLIP + YuNet beat faceres on the 7 bad woman clusters? | 2 | if no, the student programme ends | desktop only |
| 8 | the student | 20.5 + training | ~2.8 of 13.2 points of drops; cadence 805 -> ~425ms gap | bench B0-B8 / C1-C9 (deploy s3), `NATIVE_STUDENT` 0/1 |
| 9 | flow-corrected lerp between two known verdicts | 1-1.5 | -1.0-1.5s exposure per 180s run | `PRESENTER_GL` must first beat control (12.57 vs 12.05 today) |
| -- | dense optical flow tracking | 8-9 | phantom ZERO change (it moves a coast, does not end one) | refused (flow s6) |

## Rulings only he can make

- Coast dial (row 0). The single best ratio in the whole file.
- Bulk-downloading YouTube for training frames (row 8's dataset).
- Child gate by POLICY: "never clear under apparent age ~25" -- the
  literature says a 1% false-adult rate on minors needs the threshold at 32
  (arXiv 2506.10689); our `GENDER_CHILD_MASS` 0.25 orders our two reference
  faces backwards. It costs adult men their clear; measure in seconds first.
- Publishing trained weights loses the EU AI Act Art. 3(40) "ancillary"
  carve-out that protects in-app use (recipe s7).
- The person-presence labelling sheets show full frames on his monitor;
  otherwise they run on the emulator.

## Licence traps found this run (do not re-discover)

NudeNet AGPL-3.0 on GitHub while PyPI says MIT. Sapiens forbids biometric
processing (the QNN clause class). InsightFace = MIT code, non-commercial
WEIGHTS, and the restriction is on use, so "offline teacher only" does not
cure it (kills SCRFD, genderage). YOLO-NAS weights non-commercial.
ViTPose's Apache checkpoints initialise from CC-BY-NC MAE; use RTMPose.
PWC-Net CC BY-NC-SA, LiteFlowNet research-only. Clean: CLIP (MIT), SAM 2,
RTMPose/RTMO, YuNet (MIT), SFace (Apache), NanoDet-Plus / PicoDet (Apache),
timm MobileNetV3 weights (Apache; torchvision's are licence-unstated),
BiRefNet, Falconsai NSFW, RAFT (BSD-3), NeuFlow (Apache), FastFlowNet (MIT).
All three cloud vision APIs contractually forbid training a competitor.

## Three facts that bound everything above

- Corpus = 2,160 frames (18 windows x 120 at 2fps), an EVAL set; the 10
  mp4s are 4.23h with 18 minutes labelled, and the offline harness runs
  tfjs on CPU at ~5s/frame -- on the GPU the rest is an hour or two.
- The corpus scorer only scores faces the teacher FOUND (`corpus-score.mjs`
  :21-24): a student that misses a face LOWERS exposure. Fix before it
  gates anything.
- `nm` (faceres' pre-L2 descriptor magnitude, the null-mint gate) has no
  student equivalent; the 107 labels are keyed on faceres descriptor
  clusters and must be frozen per crop before any descriptor changes.
