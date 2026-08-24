# Object tracking for in-player face blur (research)

Context: BlazeFace detections at ~7Hz on playing video, 1-3 faces typical,
low-end Android (Helio G88) + desktop Windows WebView. Want tracking so
CSS blur patches glide between detections instead of twitching. MPL-2.0
app, App-Store-safe — **no GPL/AGPL code or derivative reference impl**.

## 1. Standard lightweight MOT algorithms

| Algo | Mechanism | Cost @1-5 objects | JS <200 lines feasible |
|---|---|---|---|
| **SORT** | Per-track Kalman filter (constant-velocity, 7-state: x,y,s,r,vx,vy,vs) predicts each frame; new detections matched to predictions by IoU cost matrix solved via Hungarian algorithm; unmatched tracks aged out after N misses. | Trivial — matrices are 4x4/7x7, Hungarian on a 1-5x1-5 matrix is near-instant (SORT runs 260Hz in Python on far larger counts). | Yes. Hungarian on a tiny matrix is ~30 lines; Kalman predict/update for a constant-velocity box model is ~40-60 lines. Whole thing fits in <200 lines. |
| **DeepSORT** | SORT + a CNN re-identification embedding per detection, matched via cosine distance (cascade matching prioritizing recently-seen tracks) before falling back to IoU. | Extra cost is the embedding network forward pass per detected box — real added GPU/CPU work, not just math. | Adds an inference model → not worth it here; re-ID exists to survive long occlusions/re-entries across many objects, which 1-3 in-frame faces don't need. |
| **ByteTrack** | SORT-style Kalman+IoU+Hungarian, but associates in two passes: high-score detections first, then a second pass tries to recover low-score/occluded detections against still-unmatched tracks instead of discarding them. | Same order of cost as SORT — bookkeeping only. | Yes, same order of effort as SORT; the two-pass logic is straightforward to add on top of a SORT core. |
| **OC-SORT** | Observation-centric variant: replaces raw Kalman virtual trajectory with re-projection from last-known real observation to reduce drift during occlusion/non-linear motion; adds an observation-centric momentum term for association. | Same order of cost as SORT. | Doable but the "observation-centric re-update" logic is the fiddly part; more complexity than the problem needs. |
| **NvDCF (NVIDIA DeepStream)** | Correlation-filter visual tracker (learns a discriminative appearance filter per target, tracked via FFT correlation) combined with Kalman + Hungarian, used in NVIDIA's edge (Jetson) surveillance stack. | Meaningfully heavier — per-track correlation filter update/search is real per-pixel work, designed for GPU-accelerated Jetson pipelines. | No — proprietary to DeepStream, GPU-correlation-filter heavy, wrong tool for a WebView on a Helio G88. |

For 1-3 faces at 7Hz, **SORT's core (Kalman + IoU + Hungarian) is the right weight class**: everything else on this list either adds a neural re-ID pass (DeepSORT), adds a correlation filter (NvDCF), or adds occlusion-robustness machinery (ByteTrack's second-pass recovery, OC-SORT's re-projection) that matters for crowded/long-occlusion surveillance scenes, not a phone-camera-style 1-3-face video player. ByteTrack's two-pass idea is worth stealing cheaply (see recommendation) since it costs almost nothing extra.

Sources:
- SORT overview: https://blog.roboflow.com/sort-explained-real-time-object-tracking-in-python/
- SORT repo (mechanism, "GPL License... contact Alex for permissive license"): https://github.com/abewley/sort
- ByteTrack repo: https://github.com/FoundationVision/ByteTrack
- OC-SORT repo: https://github.com/noahcao/OC_SORT
- Forasoft production tracker comparison (DeepSORT/ByteTrack/OC-SORT 2026): https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/multi-object-tracking-deepsort-bytetrack-ocsort
- NvDCF is documented only inside NVIDIA DeepStream docs (proprietary Jetson tracker, no public standalone repo) — not independently verifiable as a portable JS target.

## 2. Licenses

- **abewley/sort (reference SORT impl): GPL-3.0.** Confirmed by fetching its `LICENSE` file directly — first line "GNU GENERAL PUBLIC LICENSE". **Do not use, copy, or closely port this file** — GPL is as fatal to App Store distribution as AGPL under this repo's rules. https://github.com/abewley/sort/blob/master/LICENSE
- **ByteTrack (ifzhang/ByteTrack, mirrored at FoundationVision/ByteTrack): MIT.** Confirmed by fetching `LICENSE` — first line "MIT License". https://github.com/FoundationVision/ByteTrack
- **OC-SORT (noahcao/OC_SORT): MIT.** Confirmed by fetching `LICENSE` — first line "MIT License". https://github.com/noahcao/OC_SORT
- **npm packages**: no maintained SORT/MOT-tracker npm package found. `kalmanjs` (npm) is a dependency-free 1D Kalman filter, MIT-style/permissive per its npm listing — usable as a building block, not a full tracker. `kalman-filter` (npm) is a more general multi-dimensional Kalman filter library that itself credits KalmanJS. Neither does Hungarian assignment or track lifecycle — that part has to be hand-written regardless. https://www.npmjs.com/package/kalmanjs / https://www.npmjs.com/package/kalman-filter
- **tracking.js**: unmaintained (last real activity years ago), does simple color/Viola-Jones-style detection, not MOT — not relevant here.
- **opencv.js**: ships `cv.TrackerKCF`/`MOSSE`-style single-object trackers via the Apache-2.0-licensed OpenCV, but pulling the whole opencv.js WASM blob (multi-MB) into a Helio-G88 WebView just for a single-object correlation tracker is disproportionate next to a ~150-line hand-rolled Kalman+IoU tracker we already need to write for multi-face bookkeeping.

**Net: write our own SORT-style tracker from scratch** (Kalman predict/update + IoU cost + Hungarian, standard published algorithm/math, no code lineage from the GPL reference impl) using ByteTrack's two-pass low-score recovery idea for reference only (MIT, and the idea itself — "don't drop a track just because this frame's detection was a hair below threshold" — is generic enough not to need copying code to use).

## 3. Kalman vs EMA at 5-7Hz with camera cuts

Literature treats a constant-velocity Kalman filter as essentially "EMA with a principled, self-tuning gain" — the Kalman gain plays the same role as EMA's alpha, but it's derived from explicit process/measurement noise estimates rather than a hand-picked constant, and it naturally converges to a fixed value once uncertainty stabilizes (IEEE: "On the Performance Similarity Between EMA and Discrete Linear Kalman Filter"). At very low frame rates specifically, one benchmark (nuScenes, autonomous-driving MOT) found **a plain constant-velocity model performs slightly *better* than a tuned Kalman filter at 2Hz**, while Kalman only pulls ahead at higher rates like 10Hz — i.e. the extra machinery buys less the sparser your detections are.

For face boxes at 7Hz with hard camera cuts (video edits, not smooth camera pans), the practical answer both approaches need is the same: **an explicit cut/occlusion detector that resets state**, because neither EMA nor a Kalman filter alone will do anything sane when the "object" is actually replaced by a different scene under the same track ID. Standard practice (also how SORT/ByteTrack behave) is: if IoU between a track's predicted box and the nearest new detection falls below a threshold (or no detection matches at all for a few consecutive frames), don't smooth through it — drop/reset the track and start a fresh one immediately, so the blur snaps to the new position rather than gliding across a cut.

Given that reset logic has to exist either way, a **constant-velocity Kalman filter is the better fit here**, not because it beats EMA on raw smoothness at 7Hz (the literature says it's a wash to slightly worse), but because it also gives velocity for free — useful to keep a face patch tracking smoothly through the ~140ms gap between detections when the face is moving (e.g. someone walking in frame), which EMA (position-only, always lags behind non-static motion) can't do without extra hand-tuned velocity terms bolted on. At 1-3 tracked faces the extra CPU cost over EMA is unmeasurable.

Sources:
- https://ieeexplore.ieee.org/document/9318810/ (EMA vs Kalman similarity)
- https://arxiv.org/pdf/2111.09621 (SimpleTrack: constant-velocity beats Kalman at 2Hz on nuScenes, loses at 10Hz)
- https://cs.brown.edu/people/jlaviola/pubs/kfvsexp_final_laviola.pdf (double-exp smoothing ~135x faster than Kalman/EKF with similar prediction quality, for a different — high-rate motion tracking — use case)

## 4. Purpose-built face tracking in browser/mobile contexts

- **MediaPipe Face Landmarker**: Apache-2.0 (both code and models). Its "stream mode" smoothing is a **One Euro Filter** per landmark — an adaptive low-pass filter (EMA-like, but the smoothing factor adapts to the signal's velocity: still face → heavy smoothing/no jitter, fast movement → filter opens up and tracks with near-zero lag). This is a well-documented, small, dependency-free algorithm (a handful of lines per axis) and is the closest "off-the-shelf, purpose-built" answer to smoothing noisy per-frame landmark/box signals at low latency. It is not a multi-object tracker (no identity/assignment across a variable number of faces) — MediaPipe handles that separately via its own per-face detector continuity, not Hungarian matching.
  - https://developers.google.com/mediapipe/solutions/vision/face_landmarker
  - https://mohamedalirashad.github.io/FreeFaceMoCap/2021-12-25-filters-for-stability/ (One Euro Filter mechanism)
- **vladmandic/human (MIT, already in use for our gender/NSFW models)**: ships a `human.next()` API described as producing a "smoothened time-based interpolation from last known Result" for draw-loop use between detection cycles. The wiki does not document the exact algorithm (linear interpolation vs EMA) and the source (`src/result.ts`/`src/util/interpolate.ts`) was not read here per the license-safety scope of this task (Human is MIT so reading it is fine, but wasn't necessary to answer the question) — treat this as **an existing MIT-licensed prior-art pattern worth copying conceptually** (time-based interpolation between two known results) rather than a documented algorithm to cite exactly. Given we already depend on Human's models, this is the most natural "matches our stack" reference point.
  - https://github.com/vladmandic/human
  - https://github.com/vladmandic/human/wiki/Result

## 5. HaramBlur (AGPL, behavior reference only)

Per public README/store listing (BandaySajid/HaramBlur and alganzory/HaramBlur, GitHub; Chrome Web Store listing) — no source read: "**Frame-by-frame video detection** analyzes and blurs inappropriate content while videos are playing." No README, extension description, or issue mentions temporal tracking, smoothing, Kalman filtering, or interpolation between frames — the public description is consistent with **per-frame detection only**, with whatever visual continuity exists coming from detection rate/CSS transition, not an explicit tracker. Could not find any GitHub issue discussing jitter/tracking as a feature request or limitation in the search results returned. Since it does face detection via the Human library (their stated stack) it would have access to `human.next()`-style interpolation, but nothing in the public docs confirms whether they use it.

Source: https://github.com/alganzory/HaramBlur/blob/main/README.MD (README/description text only, no source files opened)

## Recommendation

Implement a **from-scratch SORT-style tracker**, hand-written (no ported code — abewley/sort is GPL and unusable):

- **State**: per-track 4-state constant-velocity Kalman filter over box center + size `[cx, cy, s, vx, vy, vs]` (drop aspect-ratio-rate; faces don't need it) — predict every render frame (~60fps for CSS overlay positioning), correct on each ~7Hz detection.
- **Association**: IoU cost matrix between predicted boxes and new detections; with 1-3 objects a full Hungarian solve is overkill on cost, but implement it anyway (trivial at this size, ~30 lines, avoids greedy-matching edge cases when two faces cross).
- **Track lifecycle, ByteTrack-flavored**: don't hard-drop a track on a single missed/low-confidence detection — allow 1-2 consecutive misses (covers the ~140ms detector gap) using pure Kalman prediction before killing the track. This is the one piece worth borrowing conceptually from ByteTrack (MIT, idea only, no code copy needed — it's a two-line threshold change).
- **Cut/occlusion reset**: if best-match IoU falls below a threshold (e.g. 0.1) for a track, or a *new* detection doesn't match any existing track, treat as a hard cut — spawn/replace immediately rather than smoothing across it, so blur snaps instead of gliding across a scene change. This matters more here than the EMA-vs-Kalman choice.
- Expect well under 200 lines total (predict/update math ~60-80 lines, IoU+Hungarian ~40-50 lines, track manager ~40-60 lines) and negligible CPU cost at 1-3 objects — this will not be the bottleneck on a Helio G88 next to the existing BlazeFace/gender/NSFW inference cost already shipped.
- Optional refinement, not required for v1: run a **One Euro Filter** on top of the Kalman-predicted box for the actual CSS-rendered position, to kill any residual high-frequency micro-jitter on an otherwise-static face without adding the lag a plain EMA would. Cheap (few lines/axis), MIT-clean (algorithm is public/dependency-free, not tied to any single repo's license).
