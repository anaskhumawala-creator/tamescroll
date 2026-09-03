# Distillation track — data inventory (2026-09-03, read-only research)

Goal being scoped: distill MoveNet MultiPose + BlazeFace + HSE-FaceRes
(`app/gaze/src/detector.js`, `docs/detection-engine.md`) into one student
model trained on teacher labels from the current pipeline. This inventories
what already exists on disk vs. what a fresh pass would cost.

## 1. What's already banked

### 1a. The corpus — `Z:\tamescroll-corpus\` (NOT in the git repo)

`app/gaze/bench/corpus-lib.mjs` defines `ROOT = 'Z:/tamescroll-corpus'`. Total on disk: **847M** (`du -sh /z/tamescroll-corpus`).

| subdir | size | files | content |
|---|---|---|---|
| `video/` | ~369M (sum of 10 files) | 10 `.mp4` | **source pixels**, itag 134, 640x360, the owner's own YouTube watch-list picks (`4u3jS_cTHH0.mp4` 89M ... `1L_R0MB2W5A.mp4` 6.3M) |
| `bank/reads/` | 16M | 18 `.json` + 18 `.desc` | **teacher labels**, per-face, per-frame |
| `bank/crops/` | 137M | 3465 `.ppm` | **face-crop pixels**, 112x112 RGB, one per face-read, path is `crop` field in the matching `reads/*.json` |
| `bank/persons/` | 2.9M | 18 `.f32` | **MoveNet raw output**, per-frame, `[1,6,56]` float32 flattened (336 floats/frame) |
| `bank/label/` | 34M | `labels.json`, `clusters.json`, `sheets/` | **human ground truth**: person-identity clusters with a hand-assigned class |
| `bank/ssd/` | 272K | 18 `.json` | a **COCO-SSD** (not the shipped model) person-box arm, for comparison — not a teacher label of the shipped pipeline |
| `bank/body/`, `bank/downbody/`, `bank/ssdbody/` | 100M+11M+20M | 225+49+111 `.png` | rendered comparison sheets (guess-vs-measured body boxes) for a past research round — **visual review only, no structured labels attached** |
| `bank2/` | ~76M | crops 1670, reads 8×2 | an earlier/staging generation of the "round two" 5 videos (`1L_R0MB2W5A`, `4u3jS_cTHH0`, `8R1hy3uHds0`, `KAWvDsghyc8`, `eIho2S0ZahI`) — **superseded/duplicated by `bank/`**, per `corpus-lib.mjs`'s own comment ("a staging bank, so a corpus expansion can be prepared while another process is still scoring the current one"). Don't double-count. |
| `parity/` | ~2.2M (+ `parity/models` 7.4M, `parity/frames` 20M/30 files) | model-conversion parity checks (fp16/uint8 vs fp32), not a labelling set |
| `device-1081/` | 46M | ~46 `.png` | raw device screenshots, one research round, no attached labels |
| `models/cocossd/` | small | the COCO-SSD comparison model's weights | not the shipped model |

**Scale, verified exactly** (`bank/reads/*.json` + `bank/label/*.json`):
- 18 windows across the 10 videos, 60s each at 2fps = **2,160 frames**, **3,465 face-reads** total (`python3` sum over `bank/reads/*.json`) — matches `CLAUDE.md`'s "10 videos, 18 windows, 3,465 reads" exactly.
- `bank/label/labels.json`: **107** labelled clusters — `Counter({'notperson': 32, 'man': 30, 'woman': 22, 'mixed': 15, 'bodypart': 4, 'child': 4})`.
- `bank/label/clusters.json`: **184** cluster entries total (labels.json covers 107 of them = the "93.7%" coverage CLAUDE.md cites).

**Per-read schema** (`bank/reads/1L_R0MB2W5A_w2.json`, sample face record):
```
{x1,y1,x2,y2, conf, px, gender, score, raw, age, childP, nm,
 shape:{norm, ageBin, ageMass, ageEnt}, descIdx, crop}
```
— box (normalized), BlazeFace confidence, native pixel size, HSE-FaceRes
gender label + raw sigmoid + score + age (years) + childP + descriptor
magnitude (`nm`) + age-head diagnostics, plus `descIdx` pointing into the
paired `.desc` file and `crop` pointing at the paired `.ppm`.

**`.desc` files are the FaceRes 1024-d identity descriptor**, raw float32,
confirmed by byte math: `1L_R0MB2W5A_w2.desc` = 851,968 bytes / 208 faces
= exactly 4096 bytes/face = 1024 × float32. This is the richest teacher
signal in the bank (full embedding, not just the 2 scalar outputs used
downstream).

**Crops are 112×112 P6 PPM** (verified header), i.e. the pre-cropped face
patch a human labels against, NOT the full 640×360 frame. The full frame
is not separately stored per-read, but it doesn't need to be: it is
reconstructible byte-exact via `corpus-lib.mjs`'s `grabRaw()`
(`ffmpeg -ss <t> -i <video> -frames:v 1 -f rawvideo -pix_fmt rgb24 -`)
since window `t0`/`fps` are recorded in the read JSON and the source
`.mp4` files are on disk unmodified.

**`bank/persons/*.f32`** = raw MoveNet MultiPose output per frame,
**[1,6,56]** tensor flattened (336 floats × 4 bytes = 1344 bytes/frame,
verified: `161280 bytes / 120 frames = 1344`). This is the full teacher
signal for the person/pose model — not just admitted boxes, every slot.

### 1b. `spikes/gauntlet/` — 1.9G, almost entirely NOT training-shaped

- `spikes/gauntlet/*.json` (160 top-level files): **diagnostic rings**
  pulled from `__TS_DIAG_NOW()` / probe scripts (e.g.
  `diag-v1098b-control.json`, 947 bytes: `{bundle, versionCode, codec,
  native, perf, tuningApplied, life, render, presenter}`). **Numbers only,
  no pixels, no per-frame face records.** Useless for distillation as-is.
- `nmtruth-face.json` (27K) / `nmtruth-nonface.json` (92K): **numbers only**
  — per-video-id (`id: '1myh3Nu-y-k'`) degraded-resolution sweeps of
  gender/age/childP/nm at synthetic px sizes (32-152px), no crop or frame
  saved, only a YouTube video id that isn't even a corpus video. Not
  reconstructible locally (would need to re-fetch that specific
  thumbnail).
- `native-frames-1788346009.json` (2.0M): 256×256 base64 RGBA frames +
  MoveNet-only arbitration target — **only 3 frames**, negligible.
- `spikes/gauntlet/runs/` (4,719 files: 4,279 `.png`, 287 `.json`, 153
  `.jpg`): gauntlet-round evidence screenshots at ~996×528
  (`child-f000-zoom.png` etc.), named per round (`r1-man`,
  `r10-cold-woman`, `polish2-r2-man`, ...). These are **full-player
  captures used for human eyeball scoring against 5 failure classes**
  (per the `gauntlet-round` skill) — pixels exist but (a) many likely have
  the blur overlay baked into the frame (contaminated, not clean input)
  and (b) none carry a structured per-frame teacher record next to them;
  the `.json` files present (`bisect-m02.json`: `{result, samples}`) are
  bisection/diagnostic summaries, not per-frame box/gender/age labels.
  **Not directly usable; would need re-running the offline harness against
  the underlying video+timestamp if that's still known, not against the
  screenshot itself.**

### 1c. `spikes/native/` — 1.8G, but 1.5G of it is a Python venv

- `spikes/native/venv/` = 1.5G (pip packages incl. `tensorflow`), junk.
- `spikes/native/bench-android/` = 167M (Gradle build tree for an Android
  bench APK), junk for this purpose.
- `spikes/native/out/` = 56M: converted `.tflite` files (blazeface,
  faceres, movenet-multipose, each f32 + f16) — model artifacts, not data.
- `spikes/native/GPU-REPORT.md` / `BRIDGE-REPORT.md` / `REPORT.md`: **numbers
  only** (per-model latency tables on the owner's Redmi, see §3).
- `spikes/native/arbiter.mjs` / `arbiter.py`: run the banked
  `movenet-multipose.tflite` over base64 RGBA frames from a
  `native-frames-*.json` dump — **MoveNet only**, and only 1 such dump
  exists with 3 frames (see above).

### 1d. Small spike sets (`spikes/perf-harness`, `spikes/faceres-parity`, `spikes/delay-line`)

29M / 26M / 73K respectively. Contain a handful of hand-picked frames
(`frames1007/` 15 PNGs, `faceres-parity/liveframes/` 24 PNGs,
`faceres-parity/vframes/` 16 PNGs named `<vid>_t<seconds>.png` — pulled
from the SAME corpus videos at specific timestamps) used for one-off
model-conversion parity checks (fp16/uint8 vs fp32 outputs). Not
systematic, single-digit-to-double-digit frame counts each, no bulk value
beyond what `bank/` already has better versions of.

## 2. Classification: as-is / needs-rerun / useless

| bucket | source | why |
|---|---|---|
| **Usable as-is (pixels + all 3 teachers' outputs present)** | `Z:\tamescroll-corpus\bank\reads\*.json` + `bank\crops\*.ppm` (face crop + BlazeFace + FaceRes gender/age/descriptor) joined with `bank\persons\*.f32` (MoveNet raw per-frame) via the shared `(vid, t)` key | 2,160 frames / 3,465 face-reads, all 3 models' outputs present, crop pixels present, full-frame pixels reconstructible from `video/*.mp4` at the exact same timestamp. This is the only place all three teachers + pixels overlap today. |
| **Needs the teachers re-run (pixels only)** | `video/*.mp4` (10 files, ~4.23 hours total — see §4) outside the 18 banked 60s windows; `spikes/gauntlet/runs/*.png` IF the underlying video+timestamp for each is still identifiable AND the frame is confirmed clean (no baked-in overlay) | Bulk of available footage. Sampling more windows from the *same already-decoded* corpus videos is the cheapest expansion — no new licensing/collection work, just harness time (§3). |
| **Useless for distillation (numbers only, no recoverable pixels)** | `spikes/gauntlet/*.json` diagnostic rings, `nmtruth-*.json` (keyed to a YouTube id, not a local file, no crop saved), `spikes/native/*REPORT.md`, `bisect-*.json` | No pixel path back to the frame that produced the numbers (or the source isn't a corpus asset you can regrab). |

## 3. Cost of a fresh labelling pass

### 3a. Per-frame model cost — what's actually written down

- **RTX 3060 Ti (desktop GPU, WebGL backend, in-browser)** —
  `CLAUDE.md:6124`: *"true cost 19.6ms face / 17.1ms NSFW per frame
  (dataSync bench, RTX 3060 Ti)"*. This is **BlazeFace only** (~19.6ms)
  and the NSFW model (irrelevant to this distillation — not being
  distilled). **No RTX/desktop-GPU number for MoveNet or FaceRes exists
  anywhere in the repo.** `docs/research/blur-pipeline-audit-2026-08-24.md:11`
  explicitly says the RTX is irrelevant to their perf story because the
  bottleneck was main-thread JS scheduling, not GPU throughput — so this
  number was never chased further for the other two models.
- **Android TFLite GPU delegate (Redmi Helio G88 / Adreno 610)** —
  `spikes/native/GPU-REPORT.md`: measured p50 per single inference:
  BlazeFace **19.3ms**, FaceRes **38.0ms**, MoveNet MultiPose **159.7ms**
  (all f16≈f32). *"One verdict pass on the GPU delegate = MoveNet 160 +
  BlazeFace 19 + 2× faceres 76 ≈ 255ms"* for one frame with up to 2 faces.
  This is a much weaker GPU than the RTX 3060 Ti, so treat this as a
  **pessimistic** bound, not the desktop number.
- **Actual measured cost of the existing offline harness** (Node.js,
  `tf.setBackend('cpu')` — pure-JS CPU backend, **not** GPU-accelerated;
  `@tensorflow/tfjs-node`/`tfjs-node-gpu` are NOT installed —
  `app/gaze/package.json` only lists `tfjs-backend-cpu` and
  `tfjs-backend-webgl`, and every corpus-generation log prints *"Hi,
  looks like you are running TensorFlow.js in Node.js. To speed things up
  dramatically, install our node backend"*). Reconstructed from file
  mtimes (`bank/persons/*.f32`, `bank/reads/*.json`):
  - MoveNet-only pass (`corpus-persons.mjs`): consecutive 120-frame
    windows completed **~6-11 minutes apart** ⇒ **~3-3.5 s/frame** on this
    machine's CPU, single-threaded pure-JS.
  - BlazeFace+FaceRes pass (`corpus-bank.mjs`): windows completed
    **~1-6 minutes apart** depending on face count (FaceRes cost scales
    per face; this corpus averages ~1.6 faces/frame) ⇒ roughly
    **~1-2.5 s/frame**.
  - Combined 3-teacher offline pass, current tooling, no code changes:
    **~4.5-6 s/frame ⇒ roughly 600-800 frames/hour** on one machine.
    At 2fps sampling that's **~5-7 minutes of source video labelled per
    hour of compute** — this is the honest, measured "as-is" throughput,
    NOT a GPU number.
  - **Labelling the remaining, already-downloaded corpus footage** (see
    §4: ~4.1 hours beyond the 18 banked windows) at this rate would take
    roughly **30-40 hours single-threaded** on this CPU-only path.
  - **Speed-up path, not yet built**: swap in `@tensorflow/tfjs-node-gpu`
    (native CUDA bindings, would actually use the RTX 3060 Ti) or drive
    the real browser bundle headless via WebGL (Puppeteer) — the
    BlazeFace 19.6ms/NSFW 17.1ms browser numbers imply an order-of-
    magnitude speedup is available (hundreds of ms/frame combined, not
    seconds) but this has never been measured for MoveNet+FaceRes on this
    GPU. Flag as unmeasured, not fact.

### 3b. Existing offline harness — confirmed, and it already runs all 3 teachers

- **`app/gaze/bench/corpus-bank.mjs`** — runs the actual **shipped**
  `detectFaceBoxes` + `classifyFaceGenders` (imported from
  `.cache/shipped.mjs`, i.e. the real built bundle, not a re-implementation)
  over raw frames pulled via `ffmpeg` (`corpus-lib.mjs: grabRaw`) from
  `video/*.mp4`. Writes `bank/reads/*.json` + `bank/crops/*.ppm`.
  Input: a video file + a `(t0, fps, windowS)` window. Output: the exact
  schema in §1a.
- **`app/gaze/bench/corpus-persons.mjs`** — same pattern, runs the shipped
  `movenet-multipose` graph over the same frames, writes raw `[1,6,56]`
  output to `bank/persons/*.f32`. Comment in the file is explicit about
  why raw, unthresholded output is banked: *"the arms call the SHIPPED
  `parsePersons` on these floats... which is the difference between a
  number a change can be made on and a number about my arithmetic."*
- Both scripts already constitute a working **3-teacher offline labelling
  pipeline outside the browser**, on CPU, driven by two small Node
  scripts + `ffmpeg`. No new harness needs to be built to generate more
  training pairs from the existing (or new) corpus videos — only more
  compute or a backend swap for speed.
- `spikes/native/arbiter.mjs`/`.py` is a **separate, narrower** harness:
  MoveNet-only, TFLite runtime (not tfjs), input is a JSON of base64
  RGBA frames from a live-device dump (`native-frames-*.json`), used for
  cross-runtime arbitration (WebGL vs TFLite CPU vs TFLite GPU), not for
  bulk labelling.

## 4. Where more frames could come from

| source | on disk? | licence for shipping trained weights (MPL-2.0 app) | notes |
|---|---|---|---|
| **The 10 corpus videos themselves** | **Yes** — `Z:\tamescroll-corpus\video\*.mp4`, ~369M total | N/A (frames used for training only, never redistributed; only weights ship — matches the repo's own stated approach for the shipped MoveNet/FaceRes models, which are themselves derivatives of MIT-licensed base models) | Total duration **~4.23 hours** (15,240s, `ffprobe` summed above) against only **18 minutes** (1,080s) currently banked at 2fps. **The single cheapest expansion**: re-run `corpus-bank.mjs`/`corpus-persons.mjs` over more windows of video already on disk — no new download, no new legal question, ~14x more frames available from data already fully teacher-labelled once (same videos, same licence posture already accepted for the current corpus). |
| **yt-dlp of the owner's own watch history** | Would need to be pulled fresh; not present | **Training-only use of frames from videos the owner has watched, without redistributing the frames**, mirrors what was already done to build `tamescroll-corpus` (this repo's own precedent) — YouTube's ToS restricts *downloading/redistributing* video content, not an individual's private, non-distributed use of derived model weights; ship weights only, never the frames or the source clips. This is a policy judgment for the owner, not a settled legal fact — flag for his sign-off, same posture as the existing corpus. | Same pipeline (`corpus-lib.mjs` + `ffmpeg`) would ingest arbitrary new `vid.mp4` files with no code change. |
| **WIDER FACE** (face detection, boxes) | Not on disk | Per its own site: **non-commercial research use only** — would need explicit verification before relying on it, but as commonly published this licence does **not** clearly permit shipping weights trained on it inside a commercial-adjacent, publicly distributed MPL-2.0 app. Treat as **blocked** pending a licence re-read. | http://shuoyang1213.me/WIDERFACE/ |
| **UTKFace** (age/gender/face crops) | Not on disk | Commonly published as **"available for non-commercial research purposes only"** — same caveat, likely **blocked** for shipping weights, needs a fresh licence read before use. | https://susanqq.github.io/UTKFace/ |
| **FairFace** (face, age/gender/race, balanced) | Not on disk | **CC BY 4.0** per its GitHub — permits commercial use with attribution, the most promising of the four for gender/age. Still worth a direct licence-page re-read before committing. | https://github.com/joojs/fairface |
| **COCO (person keypoints)** | Not on disk | **CC BY 4.0** (images), annotations too — commonly used as a base for commercial pose models; best candidate to backstop MoveNet's person/keypoint half if the corpus's own MoveNet-teacher frames (§1a) aren't enough for a small person model. | https://cocodataset.org/#termsofuse |
| **CrowdHuman** (dense person boxes) | Not on disk | Commonly published as **non-commercial research only** — likely **blocked**, needs a fresh licence read. | https://www.crowdhuman.org/ |

**None of the public dataset licences above were re-verified live in this
session** (read-only, local-machine investigation only, no web fetch was
performed) — the licence column reflects commonly known terms and must be
re-confirmed by opening each dataset's actual licence page before any
decision to ingest.

## 5. Disk

- **Z:** 1.9T total, 502G used, **1.4T free** (`df -h /z`) — plenty of
  headroom for a much larger labelled corpus or new downloaded video.
- **C:** 465G total, 447G used, **19G free** — per the project's own
  standing rule, nothing bulky (frame dumps, model checkpoints, new video)
  should land here.
- The existing corpus already lives on Z: (`Z:\tamescroll-corpus`), so the
  established convention is already correct — a distillation dataset
  should extend that same tree, not create a second one.

## Summary for the owner

- **One place has everything needed already: `Z:\tamescroll-corpus\bank\`.**
  2,160 frames / 3,465 face-reads with BlazeFace box+conf, FaceRes
  gender/age/childP/**1024-d descriptor**, and MoveNet's raw `[1,6,56]`
  per-frame output, all joined to real 640×360 video and 112×112 face
  crops. Ready to train a student on today, no re-labelling needed.
- **The cheapest scale-up is re-running the two Node scripts that built
  it** (`app/gaze/bench/corpus-bank.mjs`, `corpus-persons.mjs`) over more
  of the **same 10 videos already sitting on disk** — only 18 of ~4.2
  hours of footage have been sampled. At the harness's current
  CPU-only speed (~4.5-6s/frame, no GPU backend installed) that's
  30-40 hours of compute for full coverage of the existing videos;
  wiring in `tfjs-node-gpu` or a headless-WebGL path would very likely
  cut that by an order of magnitude but has not been measured.
  `spikes/gauntlet` and `spikes/native` contribute almost nothing extra
  — they're diagnostic numbers or screenshots, not pixel+teacher pairs.
- **Public datasets are a distant second option**: FairFace (CC BY 4.0)
  and COCO (CC BY 4.0) look shippable; WIDER FACE, UTKFace and
  CrowdHuman look non-commercial-only and are likely blocked — all four
  licence reads need to be redone live before anyone commits to them.
