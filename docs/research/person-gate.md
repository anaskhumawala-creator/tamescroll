# On-device person/pose detector for face-blur gating (research)

Context: need a PERSON/pose detector to gate the face-blur pipeline in a
WebView (tfjs, WebGL backend, models base64-embedded, no runtime network).
Up to ~4 people/frame, sampled 3-7Hz, bundle budget ~5MB extra, need
per-person regions (keypoints OK, we derive boxes). MPL-2.0 app,
App-Store-safe — no GPL/AGPL.

## Candidates

### 1. MoveNet SinglePose Lightning/Thunder

- **License (weights): Apache-2.0.** Confirmed via the official model card PDF
  (`https://storage.googleapis.com/movenet/MoveNet.SinglePose%20Model%20Card.pdf`,
  license field links `apache.org/licenses/LICENSE-2.0.html`). No attribution
  clause beyond standard Apache-2.0 (retain notice if redistributing the
  file itself — matches how we already handle BlazeFace in NOTICE).
- **TFJS availability**: hosted on TFHub/Kaggle, package format is
  `model.json` + `.bin` shard(s), loaded via `tf.loadGraphModel(url, {fromTFHub: true})`.
  Canonical URLs (resolved internally by tfjs's `fromTFHub` flag, not a plain
  HTTP redirect — Kaggle now gates the raw `?tfjs-format=file` download
  behind an authenticated session, confirmed by a 400 on a bare `curl -L`):
  - Lightning: `https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4`
  - Thunder: `https://tfhub.dev/google/tfjs-model/movenet/singlepose/thunder/4`
  - No separately-published fp16/int8 **tfjs** variant — TFJS-format MoveNet
    ships as one fp32 graph. (TFLite has separate fp16/int8 exports, not
    applicable to a WebGL-backend tfjs runtime.) As a size proxy, the ONNX
    export of the sibling multipose model (Xenova/movenet-multipose-lightning,
    HuggingFace) is 19MB fp32 / 9.65MB fp16 / 5.26MB int8 — singlepose is
    smaller than multipose, so expect low-single-digit MB for a quantized
    singlepose tfjs conversion if we quantize ourselves (tfjs-converter
    supports `--quantize_float16`/`--quantize_uint8` on a fp32 SavedModel).
    We'd need to run that conversion ourselves; no pre-built tfjs int8
    MoveNet exists in the standard TFHub/Kaggle distribution.
- **Input**: Lightning 192x192, Thunder 256x256 (square, single centered/
  cropped person assumed). **Single person only** — no multi-person output.
- **Output**: 17 COCO keypoints, each `[y, x, confidence]`, one person.
- **Perf**: no Helio-G88-class number published anywhere (searched directly,
  nothing found). Closest published numbers (TF blog,
  `blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet-and-tensorflowjs.html`):
  Pixel 5 (mid-range, similar CPU class to G88's Cortex-A75/A55 mix) —
  Lightning 34 FPS / Thunder 12 FPS on WebGL. iPhone 12: 51/43 FPS. These are
  native-app WebGL numbers, not WebView, and Pixel 5's Snapdragon 765G GPU
  (Adreno 620) is meaningfully faster than the G88's Mali-G52 MC — treat as
  an optimistic ceiling, not a G88 estimate.
- **Wrapper vs raw graph**: `@tensorflow-models/pose-detection` npm wraps
  loading + pre/post-processing (crop-region tracking between frames,
  keypoint decoding). Raw graph model is loadable directly with
  `tf.loadGraphModel` + manual work: resize to input dim with padding to
  square, normalize to `[0,255]` int32 (MoveNet expects **raw uint8/int32
  pixel values, no [-1,1] or [0,1] scaling** — unlike BlazeFace/most tfjs
  vision models), output tensor is `[1, 1, 17, 3]` (y, x, score per
  keypoint, normalized 0-1 coords). Manageable to hand-roll, avoids pulling
  in the wrapper's crop-tracking state machine we don't need for a
  single-shot per-sample call.

Sources:
- https://storage.googleapis.com/movenet/MoveNet.SinglePose%20Model%20Card.pdf
- https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4
- https://blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet-and-tensorflowjs.html
- https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md
- https://huggingface.co/Xenova/movenet-multipose-lightning/tree/main/onnx (size proxy)

### 2. MoveNet MultiPose Lightning

- **License: Apache-2.0**, same terms as SinglePose (same model family/card
  lineage; TFHub page: `https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1`).
- **TFJS availability**: same distribution mechanism as SinglePose
  (`tf.loadGraphModel(url, {fromTFHub:true})`), URL:
  `https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1`.
  Again gated behind Kaggle auth for a raw file download; no pre-built
  quantized tfjs variant found. ONNX size proxy (HuggingFace
  Xenova/movenet-multipose-lightning, actual file listing fetched): fp32
  **19MB**, fp16 **9.65MB**, int8/uint8/quantized **5.26MB** (all three int8
  variants converge to the identical byte size — same quant scheme).
  A tfjs uint8/float16 conversion of this model would land in the same
  ballpark, i.e. **over our ~5MB budget even in the best (int8) case**, and
  fp32/fp16 well over it.
- **Input**: variable, default `multiPoseMaxDimension` 256 (must be
  multiple of 32, recommended range 128-512 — smaller = faster/less
  accurate, tunable at inference time unlike SinglePose's fixed input).
- **Max persons**: up to **6** detected simultaneously (covers our 4-person
  requirement with headroom).
- **Output**: `[1, 6, 56]` tensor — 6 person slots x (17 keypoints x 3
  [y,x,score] = 51, + 4 bounding-box values [ymin,xmin,ymax,xmax] + 1 box
  score = 56). Gives us per-person boxes directly, no keypoint-to-box
  derivation needed — the model already emits them.
- **Perf**: no G88 number; no MultiPose-specific FPS published in the TF
  blog post above (only SinglePose numbers were benchmarked there). Expect
  meaningfully slower than SinglePose Lightning at the same input size
  since it's a heavier backbone processing a full multi-person scene rather
  than a cropped single-person region — no hard number available to cite.
- **Wrapper vs raw**: same `tf.loadGraphModel` path works; manual
  post-processing is more involved than SinglePose (parsing the 56-wide
  per-slot output, filtering by box score, NMS-free by design since the
  model itself limits to 6 non-duplicate detections per Google's docs, but
  this wasn't independently verified against source).

Sources:
- https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1
- https://raw.githubusercontent.com/tensorflow/tfjs-models/master/pose-detection/src/movenet/constants.ts
- https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md
- https://huggingface.co/Xenova/movenet-multipose-lightning/tree/main/onnx

### 3. BlazePose (MediaPipe)

- **License: Apache-2.0** for both code and model weights (MediaPipe/GHUM
  models, per Google's Model Card and multiple corroborating sources —
  `storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf`,
  npm `@mediapipe/pose` package metadata).
- **TFJS availability**: `@mediapipe/pose` npm package, or
  `@tensorflow-models/pose-detection` with `BlazePoseTfjsModelConfig`
  (`blazepose_mediapipe` variant in tfjs-models). Assets normally fetched
  from `cdn.jsdelivr.net/npm/@mediapipe/pose` at runtime — would need to be
  vendored + base64-embedded ourselves to meet the no-network requirement
  (same pattern we already use for BlazeFace/nsfwjs).
- **Sizes (fetched from the tfjs-models BlazePose README file listing)**:
  Lite **10.6MB**, Full **14MB**, Heavy **34.9MB**. All three blow the
  ~5MB budget outright — even Lite is 2x over. This is also a two-stage
  pipeline in the general case (person/ROI detector + landmark model),
  so real bundle cost is higher than the single landmark-model number
  above once the detector stage is included.
- **Input/output**: 33 keypoints (superset of COCO's 17: adds face, hand,
  foot points) plus optional segmentation mask. Landmarks include a rough
  z-depth.
- **Max persons: 1. Single-person only** — the tfjs-models README states
  the validation set was single-person, 2-4m from camera. Disqualifying on
  its own for a "up to 4 people" requirement — would need running it once
  per already-detected person, which requires a separate person detector
  first (circular for our use case, and multiplies cost by person count).
- **Perf**: no G88 number found; not benchmarked further given the
  size/person-count disqualification.

Sources:
- https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
- https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/blazepose_mediapipe/README.md
- https://www.npmjs.com/package/@mediapipe/pose

### 4. Tiny person-detection SSD (general note, not benchmarked in depth)

Not pursued in detail: TFJS's own model garden doesn't ship a maintained,
license-clean "person-only SSD" comparable in effort/size to MoveNet
MultiPose, which already gives boxes AND keypoints for free at a known
Apache-2.0 license and a known (if not G88-specific) perf profile. A
generic COCO SSD-MobileNet (`@tensorflow-models/coco-ssd`, Apache-2.0) does
exist and could be filtered to the `person` class only, but it returns axis-
aligned boxes only (no keypoints, so no gender/face-crop-quality signal
later), and published bundle size (MobileNetV2 SSD, tfjs) is in the same
~10-13MB range as BlazePose Lite — no smaller than MultiPose, no extra
capability for our use case. Not worth a deeper look given MultiPose covers
the requirement natively.

## Recommendation

**MoveNet SinglePose Lightning is the wrong shape (1 person only) and
MultiPose Lightning is the wrong size (~5-19MB depending on quant, no
pre-built tfjs quantized variant, needs us to run our own
tfjs-converter quantization pass to even attempt hitting 5MB) — but of
the four candidates, MultiPose Lightning is still the recommended pick**,
for the same reason it's already the default answer for "cheap multi-person
box source": Apache-2.0 clean, up to 6 persons (covers "up to 4" with
margin), returns boxes AND keypoints in one pass (no second model needed
for box derivation the way SSD would leave us), tunable input size
(128-512, so we can trade accuracy for speed/size at the 256 default or
drop to 192/224 for our 3-7Hz sampling need), and manual `tf.loadGraphModel`
integration is straightforward (same shape of work as our existing
BlazeFace integration in `app/gaze/src/detector.js`).

**Action before committing to the 5MB budget**: run `tensorflowjs_converter
--quantize_uint8` (or `--quantize_float16`) ourselves against the MultiPose
Lightning SavedModel/TFHub export — no one has published a ready-made tfjs
int8 MultiPose bundle, so hitting anywhere near 5MB requires doing that
conversion in-house rather than downloading a pre-quantized file. The ONNX
int8 proxy (5.26MB) suggests it's *close* to achievable but not guaranteed
to convert 1:1 to tfjs's quantization path or to stay under budget once
tfjs's own bin-shard overhead is added — budget this as a spike, not a
sure thing.

**Reject BlazePose**: single-person only (disqualifying for up to-4-people),
and even its smallest (Lite) variant is 2x the size budget before counting
the person-detector stage it needs in a multi-person scene.

**Reject SinglePose Lightning/Thunder as the primary gate**: single-person
only, same disqualifier as BlazePose, despite being the smallest/fastest
option and the best-documented on real hardware (Pixel 5 numbers exist,
nothing else has any non-desktop number at all).

**Unresolved / needs a follow-up spike**: no source anywhere (TF blog,
GitHub, HuggingFace, general search) publishes Helio-G88-class or
MediaTek-Gxx-class performance numbers for any of these models in ANY
runtime (TFLite or tfjs) — the closest reference point (Pixel 5, Snapdragon
765G/Adreno 620) has a materially stronger GPU than the G88's Mali-G52 MC,
so treat 34 FPS (Lightning)/12 FPS (Thunder) as an optimistic ceiling, not
a G88 estimate, and MultiPose has no published FPS number at all on any
device. Real numbers only come from running it on the owner's phone
(same caveat that applies to every other gaze-module perf question in this
repo's session log).
