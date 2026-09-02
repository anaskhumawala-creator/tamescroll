# Track D — Algorithmic / out-of-the-box research for tamescroll gaze pipeline

Context: Android WebView, YouTube playback, on-device blur, 1.5s delay line, ~0.8s verdict cadence,
BlazeFace+MoveNet+gender classifier, IoU tracker w/ velocity coast, 16x16 luma cut gate @10Hz,
solid-rectangle patches only, no cloud, no GPL/AGPL, Helio G85, ~13% dropped frames.

---

## 1. Compressed-domain motion vectors

**Can we get motion vectors out of Android MediaCodec / WebCodecs / Chromium? — NO, confirmed.**

- Android `MediaCodec` public API (developer.android.com/reference/android/media/MediaCodec) exposes
  only decoded pixel buffers/Surface output and encoder bitstream — no motion-vector accessor exists in
  the public SDK. DOCUMENTED (absence): https://developer.android.com/reference/android/media/MediaCodec
  — the full public class reference has no `getMotionVector*` method; the only "getMotionVectorList"
  hits in general web search are AI-search-summary artifacts pointing at unrelated FFmpeg wrapper
  projects (e.g. AndroidH264CodecProject), not a real Android API. Treat "MediaCodec.getMotionVectorList"
  as **SPECULATIVE / not real** — could not find it in the AOSP source
  (https://android.googlesource.com/platform/frameworks/base/+/master/media/java/android/media/MediaCodec.java)
  or in the official reference. This is a case where the search engine's own summarizer hallucinated an
  API from unrelated GitHub project docs; do not build on it without independently confirming against
  AOSP source.
- WebCodecs (W3C spec, github.com/w3c/webcodecs) — MDN: "WebCodecs lets you access and process raw
  pixels of media frames" (DOCUMENTED, https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API).
  No motion-vector surface exists in the spec (`EncodedVideoChunk`, `VideoFrame`, `VideoDecoder`,
  `VideoEncoder` only expose encoded bytes and decoded pixel buffers). Searched w3c/webcodecs issues —
  no motion-vector exposure issue found. SPECULATIVE-by-absence: not exposed, not proposed.
- Confirmed indirectly: Chromium's own decoders (including hardware-accelerated MediaCodec wrapper on
  Android) discard MV data after motion compensation; nothing in Chromium's public video pipeline
  (used by both Chrome and Android WebView) surfaces it to JS or to embedding apps. No source found
  contradicting this — DOCUMENTED by absence across MDN, W3C repo, and AOSP source.

**Software decoders that DO expose motion vectors:**
- **ffmpeg**: `-flags2 +export_mvs` (or AVDictionary `"flags2","+export_mvs"`) attaches MV side-data to
  decoded `AVFrame`s, readable via `av_frame_get_side_data`. MEASURED-BY-SOURCE (doc, not benchmark):
  https://ffmpeg.org/doxygen/7.0/extract_mvs_8c-example.html — official example `doc/examples/extract_mvs.c`
  prints `framenum, source, blockw, blockh, srcx, srcy, dstx, dsty, flags, motion_x, motion_y, motion_scale`
  per block. Confirmed working, actively maintained.
- Wrapper tools: `mv-extractor` (LukasBommes/mv-extractor, GitHub) and `MV-Tractus`
  (jishnujayakumar/MV-Tractus) — Python wrappers around ffmpeg for H.264/MPEG-4 MV extraction. DOCUMENTED.
- **dav1d** (AV1, VideoLAN/Alliance for Open Media, BSD-2-Clause): internally computes MVs
  (`read_mv_residual`, `read_mv_component_diff` per DeepWiki source walkthrough,
  https://deepwiki.com/videolan/dav1d/2-core-decoding-pipeline) but the public libdav1d API does not
  export them; a research group (arxiv 2510.17434, "Leveraging AV1 motion vectors for Fast and Dense
  Feature Matching") had to **patch dav1d's internals** to expose MVs for feature matching — DOCUMENTED,
  https://arxiv.org/html/2510.17434v1 — confirms both that AV1 MVs are richer/denser than H.264 (finer
  block partitioning, more reference frames) and that stock dav1d does not surface them.

**Plausibility of a second software decode purely for MVs on a phone (144p stream):**
SPECULATIVE (no direct benchmark found for this exact scenario), but reasoning from available data:
YouTube serves an alternate low-res (144p/240p) DASH stream URL for essentially every video. Decoding a
second, separate 144p stream with a bundled ffmpeg (LGPL build, decoders-only, no GPL components — must
audit build config since ffmpeg is GPL by default unless configured `--enable-gpl` is OFF and only
LGPL-compatible codecs/filters are compiled in) purely to harvest MVs is a nontrivial engineering lift:
(a) requires shipping/building a custom ffmpeg for Android (NDK cross-compile, sizeable binary, ~5-15MB),
(b) requires a second network fetch of a duplicate stream (bandwidth/battery cost on top of the visible
playback stream — YouTube's own player already decodes the primary stream via MediaCodec, which cannot be
intercepted for MVs per above), (c) MVs from a 144p encode use a different macroblock grid than what's
displayed, so mapping them back to on-screen coordinates for tracking is an extra registration step, and
(d) H.264/VP9 MVs are frequently zero or unreliable on static/text content and noisy on scene cuts (the
exact frames where the app most needs a track) — this is a widely cited weakness in the compressed-domain
detection literature (see below). Given the licensing complexity (bundling ffmpeg's LGPL decoders is
allowed but must be built with `--disable-gpl --disable-nonfree` and every enabled codec individually
audited) and the duplicate-decode cost, this is a **high-effort, uncertain-payoff idea** — likely not
worth it versus the existing MoveNet/BlazeFace pipeline.

**Compressed-domain object detection papers (the concept, not the plumbing):**
- "Fast Object Detection in Compressed Video" (Wang & Lu, ICCV 2019 / arXiv:1811.11057) —
  MEASURED-BY-SOURCE: "Motion aided Memory Network (MMNet) ... runs a complete recognition network for
  I-frames and produces features for the following P-frames with a lightweight memory network... 3x
  faster than R-FCN and 10x faster than MANet at a minor accuracy loss" on ImageNet VID.
  https://openaccess.thecvf.com/content_ICCV_2019/html/Wang_Fast_Object_Detection_in_Compressed_Video_ICCV_2019_paper.html
  "The main advantage of motion vectors is that they are freely available and require no extra time or
  models to retrieve since they have already been encoded in the compressed video" — this advantage is
  **inapplicable here** because the app cannot reach the codec's own MVs (see above); it would have to
  pay for a second decode, negating the "free" premise the whole line of research depends on.
- "Compressed Video Action Recognition" (Wu et al., CVPR 2018) and "DMC-Net" (Shou et al., CVPR 2019) are
  the same family (MV + residual instead of optical flow for action recognition) — same free-MV premise,
  same inapplicability without codec-level access.

**Verdict for Track D.1: DEAD END for this app.** No public Android/WebView/Chromium API exposes codec
motion vectors; the only path is a second full software decode of a duplicate stream, which is high
effort, licensing-sensitive (ffmpeg bundling), and produces MVs on the wrong grid/resolution requiring
extra registration work — for a technique whose only justification in the literature is that MVs are
"free," which is false in this architecture.

---

## 2. Cheap dense/sparse motion between frames on a phone

**OpenCV DIS optical flow (Apache-2.0 license, confirmed — OpenCV is Apache-2.0 since 4.5):**
- MEASURED-BY-SOURCE (paper, desktop CPU, not mobile): Kroeger et al., "Fast Optical Flow using Dense
  Inverse Search," ECCV 2016 (arXiv:1603.03590). "DIS runs at 300 Hz up to 600 Hz on a single CPU core"
  at **1024×436** resolution across its three presets (Fast/Medium/Ultrafast tradeoffs), with accuracy
  "smaller or similar to top optical flow methods at comparable speed."
  https://ar5iv.labs.arxiv.org/html/1603.03590 . This is desktop x86 CPU (paper's benchmark machine),
  not phone ARM — but the resolution the app cares about (256×144, i.e. roughly 8x fewer pixels than
  1024×436) would scale roughly linearly-to-superlinearly favorably, so even at a conservative 5-10x
  mobile-CPU slowdown vs. the paper's desktop core, sub-256×144 DIS at "ultrafast" preset is plausibly
  well under 10ms per frame pair — SPECULATIVE extrapolation, not directly measured on ARM/Helio G85.
  OpenCV ships DIS as `cv::optflow::DISOpticalFlow` (`opencv_contrib`, Apache-2.0) — reference:
  https://docs.opencv.org/3.4/da/d06/classcv_1_1optflow_1_1DISOpticalFlow.html (page returned 403 to
  automated fetch but is publicly documented elsewhere; presets are `PRESET_ULTRAFAST`, `PRESET_FAST`,
  `PRESET_MEDIUM`).
- Getting OpenCV into an Android WebView JS pipeline is itself nontrivial: OpenCV is a native C++/Java
  Android library (NDK) or a large WASM build (opencv.js) for a web/JS context; bundling opencv.js
  (~8MB+ WASM) adds meaningfully to page load, and running it inside the WebView's JS engine rather than
  natively loses much of the native speed advantage the benchmark above assumes. A native-side (Kotlin/
  NDK) DIS implementation reading frames pulled from the WebView canvas would be architecturally a bigger
  lift than the existing all-JS/TFJS pipeline.

**Lucas-Kanade on a coarse grid / block matching (16x16 or 32x32 luma grids, i.e. MPEG-style ME):**
- This is exactly what the app's existing 16×16 luma scene-cut gate already partially resembles in cost
  class (a coarse per-block luma pass at 10Hz). A block-matching motion estimator (search window ±8-16px
  per 16x16 block, SAD/SSD cost) is the cheapest possible motion signal — this is literally what MPEG/
  H.264 encoders do in real time in software at HD resolutions on desktop CPUs, so at 256×144 on a phone
  CPU it should be well under a millisecond per frame for a small search window. No specific
  mobile-Helio-class benchmark found for this exact operation (SPECULATIVE on exact ms figure), but the
  operation count is trivially small (144×256/16/16 = 144 blocks × small search window × SAD cost) —
  this is almost certainly cheaper than the existing luma-delta cut gate is already paying for, since
  it's the same grid size just doing a local search instead of a single-pixel delta.
- **Use case for tracking**: propagating a bounding box's center by the median/mean block-match vector
  inside the box between verdicts, instead of (or in addition to) the current velocity-coast IoU tracker.
  This is well-trodden ("tracking by detection + optical flow", "SORT + optical flow" variants, "FlowTrack"
  CVPR 2018-era literature) — DOCUMENTED as a common enhancement pattern to SORT/DeepSORT-style trackers,
  though no single canonical citation with a clean mAP/speed table was retrieved in this pass; treat the
  general pattern as DOCUMENTED-by-widespread-prior-art rather than one specific paper.

**Tiny learned trackers, licenses:**
- **ByteTrack** (FoundationVision/ifzhang, ECCV 2022, arXiv:2110.06864) — **MIT License**, confirmed by
  direct fetch of the LICENSE file: https://github.com/ifzhang/ByteTrack/blob/main/LICENSE ("MIT License").
  Note ByteTrack is an association/matching algorithm on top of *existing* detections (like the app's own
  IoU tracker), not a standalone lightweight neural tracker — it doesn't reduce detector calls by itself,
  it improves association quality for low-confidence boxes. Could inform improvements to the existing IoU
  tracker's matching (recover boxes the current tracker would drop) at effectively zero extra inference
  cost, since it's a pure algorithm over boxes already computed.
- **LightTrack** (researchmm/LightTrack, CVPR 2021, neural-architecture-search tracker) — **MIT License**
  per repo listing, https://github.com/researchmm/LightTrack . A genuine single-object Siamese tracker
  (not multi-object) designed for mobile — would need per-tracked-person instantiation, and it is a
  learned template-matching model (its own small forward pass), so it trades "no detector run" for "one
  small model run per tracked box per frame" — plausible mid-effort alternative to velocity-coast, but
  adds a new model to bundle/license-audit (paper's backbone choices need checking individually since
  NAS-derived models sometimes reuse licensed backbones).
- **NanoTrack** — multiple unrelated projects share this name: HonglinChu/NanoTrack (siamese tracker,
  NCNN-based, mobile-oriented, part of the SiamTrackers collection) and other unrelated YOLO-tracking repos
  called "NanoTrack" (ragultv/NanoTrack, VjiaLi/NanoTrack). Search results confirm **MIT-style licensing
  is common** in this family but the individual repos need per-repo verification before use — SPECULATIVE
  on the specific HonglinChu/NanoTrack license (not independently fetched); the PyPI `nanotrack` package
  (ragultv variant) is MIT per PyPI listing.

**Verdict for Track D.2:** Block matching on the existing 16×16 luma grid is the cheapest, most
architecturally-compatible option — it reuses infrastructure the app already has (the scene-cut gate) and
should cost well under 1ms per frame at 256×144. DIS optical flow is more accurate but requires bundling
OpenCV (native or ~8MB WASM) — a real cost the app doesn't currently pay. ByteTrack's association logic
(MIT) is directly reusable as an algorithm-only upgrade to the existing tracker with zero new inference.
LightTrack/NanoTrack are learned trackers (MIT-licensed variants exist) that would add a new small model
per tracked subject — plausible but a bigger lift than block matching.

---

## 3. Temporal redundancy / adaptive detector-run scheduling

- **"Looking Fast and Slow: Memory-Guided Mobile Video Object Detection"** (Liu et al., Google, CVPR 2019,
  arXiv:1903.10172) — MEASURED-BY-SOURCE: interleaves a large accurate feature extractor with an
  "extremely lightweight" one that only recognizes "the gist of the scene," aggregated via an LSTM-style
  memory; "designed to run in real-time on low-powered mobile and embedded devices achieving 15 fps on a
  mobile device." https://arxiv.org/abs/1903.10172 . This is architecturally close to the app's existing
  split (verdict pass every ~0.8s = "slow," velocity-coast between = "fast/free") — the paper's
  contribution is a *learned* adaptive interleaving policy (can even use RL to learn when to run the big
  model) rather than the fixed cadence the app uses today. Relevant as a direction (a learned "run detector
  now?" gate keyed on the same luma/motion signal the scene-cut gate already computes) but is a
  research-grade RL training project, not a drop-in library — HIGH EFFORT.
- **"Skip-Convolutions for Efficient Video Processing"** (Habibian et al., Qualcomm AI Research, CVPR 2021,
  arXiv:2104.11487, code at Qualcomm-AI-research/Skip-Conv) — MEASURED-BY-SOURCE: "reduce EfficientDet cost
  by 300%... reduce computational cost consistently by a factor of 3~4x... without any accuracy drop," by
  decomposing each conv as (conv of previous frame) + (conv of sparse residual) and skipping computation
  where the residual is ~zero. This requires re-architecting the *inside* of the detector's conv layers
  (a custom inference engine change) — not applicable to swapping in a pretrained BlazeFace/MoveNet TFJS
  graph without retraining/re-exporting the models; HIGH EFFORT, likely not portable to the existing
  TFJS/WebGL pipeline without a from-scratch reimplementation.
- **"Detect or Track: Towards Cost-Effective Video Object Detection/Tracking"** (arXiv:1811.05340) —
  DOCUMENTED: "a scheduler network to ascertain the action (detecting or tracking) performed on a specific
  frame... the basic frame skipping method... did worse... than the light, simple-structured scheduling
  network" — i.e., a small learned policy network beats naive fixed-interval skipping. No single
  headline %-reduction figure was retrieved in this pass.
- **FrameHopper** (arXiv:2203.11493, edge-cloud video analytics) — MEASURED-BY-SOURCE: "reduces processed
  frames to 10-20% of the original stream at target F1=0.8" using an offline-RL-trained lightweight agent
  that decides skip-length per frame based on temporal correlation between consecutive frames. This is the
  strongest quantified number found for "% fewer detector runs at near-equal accuracy" in this pass — a
  5-10x reduction in detector invocations is the ballpark the whole adaptive-scheduling literature is
  converging on, though FrameHopper's own numbers are for an edge-cloud streaming-analytics setting
  (surveillance-style fixed cameras), not necessarily representative of YouTube content's shot-cut-heavy
  editing pace (see §5) which likely needs re-detection at every cut regardless of an RL policy's learned
  "skip" preference — the app's own scene-cut gate already forces a detector run on cuts, so it's already
  doing the single highest-value part of what these policies learn.
- **AdaScale** (arXiv:1902.02910) — adapts input *resolution* per frame rather than skipping runs
  entirely; a different lever (accuracy/compute tradeoff via scale) than run-count reduction.

**Verdict for Track D.3:** The literature converges on 3-10x fewer detector invocations being achievable
via learned adaptive scheduling (FrameHopper's 10-20% frame rate at F1=0.8 is the clearest number), but
every one of these systems requires training a policy (RL or otherwise) on representative footage, which
is a real ML engineering project (data collection, training loop, on-device policy inference) rather than
a drop-in. The app's fixed ~0.8s cadence + forced-run-on-cut is a reasonable hand-tuned approximation of
what these systems learn automatically; the marginal gain from a full learned scheduler is uncertain
without dedicated experimentation, and HIGH EFFORT to build.

---

## 4. YouTube storyboard/thumbnail pre-scan

- **What storyboards are**: YouTube's `player_response` JSON includes a `storyboards` renderer with sprite
  sheet URLs (commonly `sb0`..`sb3` in various tools' naming) — sprite sheets tiling many small thumbnail
  frames into one image, referenced by a WebVTT-like index giving each frame's time range and pixel
  position. DOCUMENTED (general mechanism, non-YouTube-specific description):
  "The storyboard approach tiles thumbnails into one sprite sheet image and ships a text index... One
  request enables instant previews" — https://nikodev1.medium.com/storyboard-thumbnails-the-scrub-bar-preview-your-players-are-missing-8ee4182ea5f4
- **Resolution/frame-count for YouTube specifically**: per yt-dlp's own format listing behavior (community
  tool, DOCUMENTED via search-engine summary of forum/issue threads, not independently fetched from
  yt-dlp source in this pass): YouTube offers **multiple storyboard tiers** — roughly `sb3` at 48×27,
  `sb2` at 80×45, `sb1` at 160×90, `sb0` at up to 320×180 (varies by video/quality available) — each a
  sprite sheet grid, sampled at a fixed interval across the video's duration (commonly on the order of
  5-10 second intervals for a normal-length video, coarser for very long videos, per generic industry
  description: "a sprite sheet generated with one thumbnail every 5 seconds has limited resolution").
  **This is a moderate-confidence figure — mark SPECULATIVE on exact YouTube numbers**, since the fetch
  that would confirm current exact tier resolutions/sample-interval for YouTube specifically (as opposed
  to generic storyboard-format description) was not completed in this pass; the yt-dlp GitHub
  issues/forum threads found were tangential (format-list bugs) rather than a clean spec page. If this
  becomes load-bearing, verify by inspecting a live `get_video_info`/`player` response's `storyboards`
  field directly (this is what yt-dlp itself parses).
- **Feasibility of pre-judging from storyboards**: the images are ordinary `<img>`/sprite URLs the page
  already fetches for scrub-bar hover preview — no special auth, same-origin-adjacent network fetch the
  page already performs, so there's no new privilege needed to read them (same CORS/host-trust class as
  thumbnails the app already processes on feed pages). At 48×27 to 160×90 per frame, sampled every ~5-10s,
  a 10-minute video would yield roughly 60-120 tiny frames total — enough to run BlazeFace+gender +
  MoveNet against *once, ahead of playback*, to build a rough per-time-range "who's on screen" prior
  before the delay line even reaches that timestamp. Faces at 48-160px width in a sprite tile are within
  or above FACE_MIN_NATIVE_PX (40, per the project's own tuning) for the higher tiers, so gender reads
  could plausibly be attempted the same way as thumbnail-sized reads on the image path today — this is
  architecturally very close to what the app already does for feed thumbnails, just pointed at a
  scrub-preview sprite instead of a video-listing thumbnail.
- **No prior art found** of anyone pre-scanning YouTube's storyboards specifically for content
  moderation/blur pre-judgment — searches for "look-ahead storyboard analysis content moderation" and
  similar returned only generic prefetch/security-scanning patents unrelated to storyboards. **SPECULATIVE
  / novel** as an idea in this specific application, though the general "sample the seek-preview sprite
  sheet instead of decoding video" trick is a known technique among video-tooling hobbyists (yt-dlp,
  various "extract storyboard" scripts exist) for extracting cheap thumbnails, just not documented for
  this moderation use case.
- **Caveat**: storyboard sample points are sparse in time (every 5-10s) and low-res, and are NOT
  perfectly time-synced to actual cuts — a shot that starts and ends between two storyboard samples would
  be invisible to this technique entirely. It is a *prior*, not a substitute for the real-time verdict
  pipeline: useful as a warm-start ("this video is very likely to contain a woman throughout, bias initial
  gender-clear defaults / pre-warm the blur state") but not as a replacement for per-frame verdicts, given
  the app's own numbers show shots as short as 1-2s are common in modern content (see §5).

**Verdict for Track D.4:** Legitimate, low-risk (ordinary image URL the page already trusts), genuinely
novel-seeming idea for this app. Best use: a cheap pre-scan run once when a video loads (before or during
the first playback second) to seed initial track state / bias the "who might appear" prior, not as an
ongoing substitute for real detection. Effort is moderate (parse `player_response.storyboards`, fetch
sprite tiles, slice into per-frame crops, run existing gender/face pipeline once per tile) — no licensing
risk since it's the same public image URL the native player already uses for hover-preview.

---

## 5. Perceptual/psychovisual tricks

**Faces are found fast in periphery (supports existing face-first design):**
- MEASURED-BY-SOURCE (neuroscience): "human faces are located easily in peripheral vision... research
  using eye-tracking methods found that changes in facial identity or the addition of internal features to
  an initially-featureless face did not affect face detection, yet performance was hindered by the removal
  of internal features before fixation occurred." https://www.tandfonline.com/doi/full/10.1080/13506285.2025.2550777
  "Approximately 57% of foveal units in IT and 30% in V4 were selective for faces or houses, whereas only
  8% of peripheral units in IT and 4% in V4 showed similar selectivity" — https://elifesciences.org/articles/109498
  This supports the *existing* architecture choice (face-first detection) rather than suggesting a new
  lever, but is relevant confirmation that faces-first is the right perceptual priority, and that a viewer's
  gaze is drawn to faces quickly even off-fixation — meaning face patches must appear promptly (favors the
  existing "instant blur, no flash" design principle) more than it suggests any new shortcut.

**Motion masking — DOCUMENTED, real effect, directly actionable:**
- "Motion masking effect (MME) is an important human visual system property used to measure
  perceptual-distortion in video coding" — https://link.springer.com/chapter/10.1007/11581772_12 ,
  and "incorporating contrast masking effect and motion masking effect can achieve 14% bitrate reduction
  compared to standard codecs under the same visual quality" (same source) — MEASURED-BY-SOURCE (codec
  bitrate context, not detection-skipping context, but the underlying visual-acuity claim transfers).
  "Video compression systems can exploit the limited capability of the human visual perception system to
  perceive high resolution characteristics in rapidly moving images" — DOCUMENTED (patent literature
  paraphrase). Also relevant: "motion silencing of flicker distortions on naturalistic videos" —
  https://www.sciencedirect.com/science/article/abs/pii/S0923596515000429 — a distinct but related
  phenomenon where fast motion suppresses perception of superimposed flicker/distortion.
- **Actionable implication (SPECULATIVE application, DOCUMENTED underlying science):** during
  high-motion frames (large scene-gate luma deltas that don't cross the cut threshold, i.e. fast pans/
  camera shake/rapid subject motion — exactly the regime the app's own `CUT_DELTA` tuning already
  distinguishes from real cuts), a slightly wider/coarser blur patch and/or a skipped verdict is *less*
  perceptible to the viewer than the same imprecision on a static frame, because the visual system's own
  acuity for high-spatial-frequency detail is reduced during fast retinal motion. This could justify a
  "widen-and-relax" policy during high-motion, low-cut-confidence frames: cover a larger margin (cheaper
  to compute, safer/more failure-tolerant) rather than trying for tight tracking precision the viewer
  cannot perceive anyway. This is a genuinely different lever from anything in the current architecture
  (which treats motion mainly as a cut-detection signal, not as a "the viewer can't see edges right now"
  signal) — moderate confidence this transfers from codec-distortion-masking to blur-patch-precision
  masking, since both are fundamentally "can the viewer resolve fine spatial detail on this frame."

**Change blindness across cuts — DOCUMENTED, directly relevant to shot-cut handling:**
- "Change blindness describes the inability to detect shot cuts in edited film... editors began to notice
  that changes to the background were not noticed by those watching the film." "This blindness occurs when
  a cut coincides with a sudden onset of motion... when the audience moved their eyes across the entire
  screen, almost any change made during this time would often go unnoticed." — Wikipedia + academic sources,
  https://en.wikipedia.org/wiki/Change_blindness , match-action paper
  https://eprints.bbk.ac.uk/14904/1/CutDetect_MediaPsych_timjsmith_unblind_preprint.pdf . MEASURED-BY-SOURCE
  in the sense that this is an established, replicated finding in film-perception research (edit blindness
  studies use eye-tracking + explicit-detection tasks).
- **Actionable implication:** for the ~100-400ms immediately following a detected cut, the viewer's ability
  to notice a *slightly* wrong or briefly-absent blur patch is measurably reduced (their attention is
  reorienting/re-fixating on the new shot, exactly the window psychology calls "edit blindness"). This is
  a real, citable justification for the app's existing behavior of forcing an immediate full verdict pass
  on a detected cut rather than needing pixel-perfect coverage in the first frame or two after a cut — the
  literature suggests the app has some genuine slack in that specific window that it may not be
  fully "spending" (e.g., could tolerate a marginally later first-verdict-after-cut than a naive
  worst-case budget assumes, since the viewer is least likely to register a brief miss right at the cut,
  and *most* likely to register a wrong patch mid-shot on a static composition).

**Delay-line "verdict from the future" beyond current lookahead — DOCUMENTED shot-length numbers, used as
reasoning input:**
- Shot-length figures (Cutting, Cornell; Salt) — MEASURED-BY-SOURCE (film corpus analysis): "average shot
  length of English language films has declined from about 12 seconds in 1930 to about 2.5 seconds today"
  (Cutting) — https://flowingdata.com/2014/09/22/evolution-of-movies/ ; and by content type (general
  video-editing-industry sourcing, less rigorous than Cutting's film corpus but directionally consistent):
  "Short-form for TikTok and Reels often cuts every 1 to 2 seconds... faster commentary and vlogs run
  closer to 1 to 3 seconds... a calm talking-head or tutorial usually holds each shot around 4 to 8
  seconds" — https://www.miracamp.com/learn/youtube/duration-of-a-video . Barry Salt's dataset "calculated
  the average shot duration in more than 15,000 movies made between 1910 and 2010" —
  https://widescreenjournal.org/wp-content/uploads/2022/08/formatted-cutting-rates.pdf (methodology
  citation, not YouTube-specific).
- **Implication for "verdict only on first-frame-after-cut plus one mid-shot sample per N seconds"**: given
  typical YouTube shot lengths in the 1-8s range depending on genre (vlogs/commentary trending toward the
  short end, talking-head/tutorial toward the long end), a policy of "one verdict at cut + one more if the
  shot runs past ~2-3s" would, for the *majority* of shots in fast-cut content (1-3s), collapse to
  approximately the same single-verdict-per-shot behavior the scene-cut-forced-pass already provides —
  meaning **the marginal gain of formalizing this policy over the existing cut-triggered-verdict + regular
  0.8s cadence is likely small for fast content**, but could meaningfully reduce detector runs specifically
  on **long static talking-head shots** (4-8s+) where the current fixed 0.8s cadence keeps re-verifying a
  scene that statistically hasn't changed. This is a genuine, quantifiable-in-principle lever
  (SPECULATIVE on exact savings without a shot-length histogram of the app's own test corpus, but
  DOCUMENTED that YouTube content skews toward shorter shots than classic film, meaning the *cut gate*
  is already doing most of the useful re-verification work, and the fixed-cadence in between cuts is
  the more marginal spend during long shots specifically).
- The app's own docs already establish it looks 3s into its own delay buffer; that is comfortably longer
  than most single shots (median well under 3s per the figures above for typical YouTube pacing), meaning
  the delay line **already spans, on average, more than one full shot** — reinforcing that a
  "verdict-per-shot-plus-periodic-recheck" policy is compatible with the existing 1.5s delay/3s lookahead
  architecture without needing to extend the buffer further.

**Verdict for Track D.5:** Motion-masking (relax precision during fast motion) and change-blindness
(relax timing precision in the ~200-400ms right after a cut) are the two most directly actionable,
well-documented perceptual facts — both suggest the app can spend LESS effort in windows where it is
*currently* treating imprecision as costly, because the viewer's own visual system is least able to
notice it there. Shot-length statistics support "recheck less during long static shots, rely on the
cut-triggered pass for the rest" as a real, bounded-effort lever — but the gain is content-dependent
(large for talking-head/vlog content with long shots, small for fast-cut content where the cut gate
already dominates).

---

## 6. Cheaper blur mechanics (still solid rectangles)

- **`backdrop-filter` is the most expensive of the options, confirmed by multiple independent sources:**
  "backdrop-filter is heavier still, since it has to read and process the content behind the element" —
  https://www.f22labs.com/blogs/how-css-properties-affect-website-performance/ . "Backdrop blur is
  terribly slow compared to Chrome when enabled, and while it's perfectly fine on desktop, on mobile it's
  terribly slow compared to Chromium-based browsers on the same phone" (Firefox bug discussion, but
  directionally: backdrop-filter blur is a known heavy operation cross-browser) —
  https://bugzilla.mozilla.org/show_bug.cgi?id=925025 . "The GPU compositing cost of backdrop-filter
  scales with the blur radius and the pixel area of the element" — same source cluster. This matches the
  app's own findings (docs reference backdrop-filter as the mechanism; project notes elsewhere hint at
  per-frame cost concerns).
- **Chrome/Chromium bug confirms canvas-filter blur is also expensive, not a free alternative:**
  Chromium bug (referenced from Mozilla's sister-bug 1498291): "CSS blur effects are highly inefficient
  and very slow in canvas filters" — https://bugzilla.mozilla.org/show_bug.cgi?id=1498291 (title itself
  is the citation; this is a *known, filed, still-relevant-class* performance bug about `ctx.filter =
  'blur()'` on `<canvas>` specifically, not just CSS-element blur). This directly answers part of the
  Track D.6 question: **canvas `filter = 'blur(24px)'` is not a cheap escape from `backdrop-filter`'s
  cost** — both blur code paths have been independently flagged as slow across both major browser engines'
  bug trackers, and Skia (which underlies both Chrome and Android WebView rendering) is the shared
  implementation for both, so the same blur-kernel cost applies whichever CSS/canvas API triggers it.
- **What actually differs between the two mechanisms is *what* gets blurred, not the blur math itself:**
  `backdrop-filter` must sample and blur *live compositor output* behind the element (the video frame
  currently being displayed, which can change every frame) — this forces a read-back / re-composite of
  the layer stack under the patch on every paint. A `canvas.filter = 'blur()'` draw, by contrast, blurs
  whatever was already drawn *into that canvas* — if the app is already drawing the delayed video frame
  into its own presentation canvas (which the pipeline description here says it does — "frames buffered...
  interpolated between two known verdicts" implies the app already owns a canvas with the frame pixels),
  then blurring a *clipped region of that same canvat in-place*, in the same draw call that paints the
  frame, is architecturally a single extra Skia blur-filter pass on already-resident pixel data — no
  separate backdrop read-back of the live DOM/compositor stack is needed, because the source pixels are
  already in hand. This is the meaningful potential win: **not "canvas blur is cheaper per-pixel than
  backdrop-filter blur" (it may not be, per the bug reports above) but "canvas blur-in-place-on-a-frame-
  you-already-own avoids the backdrop read-back step entirely."** This reasoning is SPECULATIVE
  (architecture-specific, not directly benchmarked in any source found) but is grounded in DOCUMENTED facts
  about what each API must do (backdrop-filter's mandatory live-compositor sampling vs. canvas filter's
  operation on already-buffered pixels).
- **Skia progressive downsampling detail (relevant to blur radius cost):** "When sigmas are large
  (currently > 4), progressive downsampling is used so a lower resolution image can be evaluated, and then
  the blurred image is upscaled to simulate the larger blur" — general Skia blur implementation note found
  via search summary (React Native Skia community discussion), DOCUMENTED-ish (secondhand paraphrase of
  Skia internals, not a primary Skia source doc directly fetched) — implies the blur radius used (the
  app's `blurMaxPx 72` per project notes) is well within the range where Skia already downsamples
  internally regardless of which CSS/canvas API is used to request it, so radius itself is not the lever;
  *area* (how many pixels the blur touches, i.e. patch size) and *whether a backdrop read-back is forced*
  are the levers.
- **Pixelation as a cheaper-still alternative, not directly benchmarked but well-understood mechanically:**
  drawing a heavily-downscaled copy of the clipped region (e.g. to a 1/16-area offscreen canvas) and then
  drawing that back upscaled with `imageSmoothingEnabled = false` (nearest-neighbor) produces a "pixelated"
  solid-rectangle obscuration using only two cheap `drawImage` calls and zero blur-kernel math at all —
  this sidesteps the blur-filter cost question entirely since no `filter`/`backdrop-filter` blur is
  invoked. This satisfies "solid rectangle" (no holes, no masks) just as well as a Gaussian blur does, and
  is mechanically far cheaper (bilinear/nearest resampling is a much simpler GPU operation than a
  multi-tap Gaussian blur kernel) — this is a well-known general graphics technique (mosaic/pixelate
  censoring), not something requiring a citation beyond how `drawImage` scaling works, but it IS a genuine
  behavior/visual-style change (pixelation reads differently than blur) that the owner would need to
  approve given the project's history of the owner personally re-tuning blur look (feather/radius/solid-
  rectangle decisions are explicitly owner-owned per project notes) — flagging as a real option but one
  that changes the *look*, not just the cost, so it is a judgment call for the owner, not a pure
  perf swap.

**Verdict for Track D.6:** Both known blur mechanisms (CSS `backdrop-filter` and canvas `ctx.filter =
'blur()'`) share the same underlying Skia blur-kernel cost and both have been independently flagged as
slow in Chromium/Firefox bug trackers — swapping the *filter* alone is not a proven win. The real lever is
architectural: if the delayed-frame canvas the app already renders into is the same canvas the blur patch
is drawn onto (single draw call, blurring already-buffered pixels), that avoids `backdrop-filter`'s
mandatory live-compositor read-back — a genuine, if unbenchmarked, potential saving. Pixelation via
downscale+nearest-upscale `drawImage` is a mechanically much cheaper alternative that avoids blur-kernel
cost entirely and still satisfies "solid rectangle," but changes the visual style and would need the
owner's sign-off given how particular past sessions have been about blur look.

---

## Ranked table

| # | Idea | Expected gain | Effort | Licence/rule risk |
|---|---|---|---|---|
| 2b | Block-matching motion (16x16/32x32 grid, reuse existing luma-gate infra) for box propagation between verdicts, replacing/augmenting velocity-coast | Moderate-high: sub-1ms/frame cost (SPECULATIVE, reasoned from op-count), could tighten tracking during pans/motion without more detector runs | Low-moderate: extends code the app already has (16x16 luma grid); no new model/library | None — pure algorithm, no new deps |
| 3 | Adaptive/learned detector-run scheduling (Looking Fast & Slow / FrameHopper-style) | High in principle (literature: 3-10x fewer detector runs, FrameHopper 10-20% frames kept at F1=0.8) but app's own cut-gate + fixed cadence already captures much of the "obvious" savings (cuts always trigger); marginal gain over current heuristic is uncertain without a training project | High: needs a training pipeline (RL or supervised), on-device policy inference, validation corpus | Low licence risk (build in-house); moderate rule risk if a learned policy under-samples and misses a subject — needs the same critic-gate discipline as existing tuning |
| 5a | Relax blur precision/margin during high-motion, non-cut frames (motion-masking) | Moderate: fewer wasted-precision cycles, more tolerant/cheaper patches exactly when viewer can't perceive detail anyway; DOCUMENTED perceptual basis | Low: reuses existing scene-gate luma-delta signal as a "how much slack right now" dial rather than only a cut/no-cut binary | None — purely a tuning-constant/policy change, same class as existing OTA-tunable dials |
| 5b | Shorter mandatory-precision window immediately after a cut (change-blindness slack) | Low-moderate: a few hundred ms of relaxed timing budget right after forced cut-verdict, DOCUMENTED perceptual basis, but app likely already spends this budget forcing an immediate full pass | Low: policy/threshold tweak only | None |
| 5c | Verdict-per-shot + periodic recheck instead of fixed 0.8s cadence during long shots | Content-dependent: large for talking-head/vlog (4-8s shots), near-zero for fast-cut content (1-3s shots) where cut gate already dominates; DOCUMENTED shot-length stats support this split | Moderate: needs shot-length-aware cadence logic, some risk of missing a mid-shot subject change | Low — but is an EXPOSURE-class tuning change per project's own vocabulary; would need critic-gate scrutiny like other cadence dials |
| 4 | Storyboard pre-scan (fetch YouTube's own scrub-preview sprite sheets, run existing gender pipeline once on ~60-120 tiny frames per video, ahead of/at playback start) | Moderate, one-time per video: seeds initial track/gender priors before first real verdict lands, reducing early-playback risk; does NOT reduce steady-state detector runs | Moderate: parse player_response.storyboards, fetch/slice sprites, feed existing pipeline once | Low — same public image URL YouTube's own player already fetches for scrub preview; no ToS/access novelty found, but exact resolution/interval figures are SPECULATIVE and should be verified live before relying on them |
| 6a | Draw blur into the app's own delayed-frame presentation canvas in the same pass (avoid backdrop-filter's live-compositor read-back) | Moderate-high potential (SPECULATIVE, unbenchmarked): both blur APIs share the same Skia kernel cost per bug trackers, but this avoids the read-back step backdrop-filter is forced to pay | Moderate: requires the presentation architecture to already own the frame pixels in a canvas (matches the described delay-line design) — real reimplementation of the render path | None — solid rectangle, same visual result as backdrop-filter blur, no filter/masking change |
| 6b | Pixelate via downscale+nearest-neighbor-upscale drawImage instead of Gaussian blur | High cost-reduction (mechanically much cheaper than any blur kernel), but changes visual style | Low: two `drawImage` calls, no new deps | None on rules (still solid rectangle) but is a LOOK change — owner sign-off required per project history of blur-look decisions |
| 2a | OpenCV DIS optical flow for box propagation | Moderate-high accuracy gain over pure block-matching (DIS is a real optical-flow method, MEASURED-BY-SOURCE at 300-600Hz/core on desktop at 1024x436 — favorable extrapolation to 256x144 mobile, but unverified on ARM) | High: requires bundling OpenCV native/WASM (~8MB+), real integration work, native bridge from WebView | Apache-2.0 confirmed — no licence risk, but binary-size/perf-integration risk |
| 2c | ByteTrack-style low-confidence-box recovery in the existing IoU tracker's matching stage | Low-moderate: better association/fewer dropped tracks on marginal detections, zero new inference cost | Low: pure algorithm change on boxes already computed | MIT confirmed, zero risk — but must reimplement the algorithm cleanroom (never copy GPL/AGPL code per hard rule; ByteTrack itself is MIT so direct reference is fine, but verify no transitively-vendored non-MIT code in any adapted implementation) |
| 2d | LightTrack/NanoTrack learned per-subject tracker replacing velocity-coast | Uncertain: trades "no detector, no model" coasting for "one small model run per tracked subject per frame" — could be worse than current free coasting unless it clearly out-tracks IoU+velocity | High: new model to bundle, license-audit backbone components individually, integrate into TFJS pipeline | LightTrack repo MIT; NanoTrack family MIT-ish but must verify the SPECIFIC repo used, and audit backbone provenance (NAS-derived models sometimes reuse licensed weights) |
| 1 | Compressed-domain motion vectors (any form) | None achievable without a second full software decode; the "free" premise the whole research area depends on does not hold in this architecture | Very high (custom ffmpeg build for Android, duplicate stream fetch, MV-to-onscreen registration) for uncertain payoff | Moderate: ffmpeg bundling requires careful LGPL-only build config (GPL components must be disabled) — real audit burden for a DEAD-END idea |

