# THE GPU BENCH — read this before running another accuracy round

**Every bench in this repo before 2026-09-04 ran on tfjs' pure-JS CPU
backend at ~0.15 crops/second.** That is why rounds took nights, why
sample sizes were 140 instead of 1,400, and why "run it and see" was
never an option. It is fixed. The same work now runs at **11–19
crops/second on the RTX 3060 Ti — measured 127×** — and the numbers are
byte-comparable with the CPU ones.

```bash
node bench/gpu/run.mjs --pop=corpus --backend=webgl --arms=rgb,grey --out=NAME
```

---

## 1. Why it is Chrome and not node

tfjs has no GPU backend in node without a CUDA toolkit. This machine has
an RTX 3060 Ti and **no toolkit**, and installing one (CUDA 11.8 + cuDNN,
version-pinned to `tfjs-node-gpu`) is a large, brittle dependency.
`@tensorflow/tfjs-node` — native CPU, no GPU — does not even build here:
node-pre-gyp has no prebuild for node v24.

Chrome reaches the same GPU through ANGLE/D3D11 with nothing installed:

```
ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti (0x00002489) Direct3D11 vs_5_0 ps_5_0, D3D11)
```

So the inference runs in a **headless Chrome page** and the scoring stays
in node, off banked JSON rows, exactly as every existing bench already
works. `@tensorflow/tfjs-backend-webgl` was already a dependency.

**Nothing is ever shown on his screen.** Chrome runs `--headless=new`
against `127.0.0.1` and loads only our own crops and models off local
disk. No feed, no thumbnails, no external network.

## 2. Shape

Three files, one job:

| file | role |
|---|---|
| `bench/gpu/run.mjs` | node: builds the bundle, serves crops+models, launches Chrome, banks rows |
| `bench/gpu/entry.js` | browser: fetches the job, runs the **shipped** functions, POSTs rows |
| `bench/gpu/arms.mjs` | pixel transforms, imported by **both** sides |

**There is deliberately no CDP.** The page fetches its own job and POSTs
its own result, so the driver is an HTTP server and a process handle — no
websocket, no protocol version to drift, and a page-side failure arrives
as `ok:false` with a stack instead of a hang.

The browser half is a **pure inference producer**. It holds no
thresholds, makes no comparisons and does no analysis, so a GPU row and a
CPU row are the same JSON and the same node scorer reads both.

## 3. Flags

| flag | default | meaning |
|---|---|---|
| `--pop` | `corpus` | `corpus` = 2,159 labelled reads off his 10 videos; `fairface` = 1,400 balanced crops |
| `--backend` | `webgl` | `webgl` (GPU) or `cpu` — **the parity control** |
| `--arms` | `rgb,grey` | any of `rgb grey blueOnly redOnly greenOnly gammaUp invert` |
| `--mirror` | `0` | also read each arm mirrored, average in raw space |
| `--desc` | `0` | bank the [1024] descriptor per arm (big files) |
| `--limit` | `0` | first N crops; fairface is **interleaved by race×sex** so a limit stays balanced |
| `--out` | auto | bank name under `Z:/tamescroll-corpus/bank/` |
| `--port` | `8931` | change it to run two jobs at once |

## 4. THE PARITY GATE — run it, do not skip it

WebGL is not CPU arithmetic. tfjs renders to half-float textures wherever
`EXT_color_buffer_float` is missing, and the shader path is a different
order of operations regardless. **This repo has already been burned by
exactly that**: findings 25 measured tfjs-WebGL on an Adreno reading
MoveNet's best keypoint at 0.03–0.19 — admitting *nobody* — where TFLite
CPU, tfjs CPU and native GPU all read 0.77–0.82 on the same frames. Six
loops of work described a regime that did not exist.

```bash
node bench/gpu/run.mjs --pop=corpus --backend=webgl --limit=60 --out=smoke-webgl
node bench/gpu/run.mjs --pop=corpus --backend=cpu   --limit=60 --out=smoke-cpu --port=8932
node bench/gpu/parity.mjs smoke-webgl smoke-cpu
```

Result on 2026-09-04, 60 crops, arms `rgb,grey`:

```
arm      spreadA  spreadB   |d| p50   |d| p95   |d| max  labelFlip  clearFlip
rgb        0.615    0.615   2.38e-7   1.85e-6   2.05e-2       0/60       0/60
grey       0.599    0.599   2.12e-7   1.22e-6   3.96e-2       0/60       0/60

PASS. Output spans 0.599, worst shipped-bar flip rate 0.00%.
```

`parity.mjs` **exits non-zero** and refuses to print a verdict if either
arm's output spans less than 0.2 — the finding-43 saturation shape, where
a dead constant output agrees with itself perfectly. An agreement number
without a spread number beside it is not evidence.

It also joins **on the crop name, never on position**: one skipped
`noFace` row on one side shifts every later index and the diff becomes
noise that reads as a backend difference.

## 5. Speed, measured

| | rate | 2,159 crops |
|---|---|---|
| tfjs CPU (pure JS) | 0.15 crop/s | ~4 hours |
| **WebGL, 3060 Ti** | **11.1–19.1 crop/s** | **194 seconds** |

Rate falls with more arms: 2 arms + mirror = 4 gender inferences plus one
detection per crop, and that is the 11.1 figure. Warm-up runs both graphs
once before the clock starts — a first WebGL call pays shader compilation
for every kernel in the graph, and charging that to crop #1 makes every
per-crop timing a lie.

## 6. THE BUG THIS HARNESS SHIPPED ON ITS FIRST RUN, because it will happen again

The first stack run reported mirror-averaging as **worthless** — fixing 0
of 235 women the shipped arm gets wrong, against finding 40's measured
18.0% → 12.3%. That was not a result. It was an indexing bug in the
harness:

**Detector boxes are NORMALISED [0,1], not pixels.** `classifyFaceGenders`
hands the box straight to `tf.image.cropAndResize`, whose rects are
fractions of the source. `mirrorBox` flipped by *pixel width*, so the
mirrored crop landed far off the face.

**The tell, and it is the generalisable part:** mirror read **66% of
small women as male** against rgb's 36.9%. A crop of nothing reads as the
model's prior, and this model's prior is male-leaning — so **a bad crop
looks exactly like a bad arm.** Any arm that is dramatically worse than
the control in one direction is a geometry bug until proven otherwise.

The cross-check that caught it: grey touches no box and reproduced
finding 41's CPU numbers exactly (25.8% of women wrong, 3.6 points of
false cover at matched exposure). One arm agreeing and one arm collapsing
points at the thing only one of them does.

## 7. What still applies, unchanged

- **The clear bar sits far above the label boundary.** `GENDER_CLEAR_SCORE`
  0.45 male means **raw ≥ 0.725**, so a label flip between 0.50 and 0.725
  changes nothing that ships. Never score on label accuracy alone.
- **Match the exposure.** Any arm wins an accuracy column by leaning
  female, which is a threshold move in disguise. Solve each arm its own
  bar to a common exposure, *then* read false cover. Findings 29, 40, 41
  and 45 all turn on this.
- **FairFace `sample.json` is grouped by race**, so a head-N slice is a
  single-race sample. `run.mjs` interleaves by race×sex; do not
  re-introduce a raw slice.
- Detection runs **once** on the untouched crop and every arm reuses the
  box, so a gender result can never be confounded with a detector result.

## 8. What this unlocks

Cheap now that were impossible before:

- **Full FairFace instead of a 140-crop slice** — 1,400 crops in ~2 min.
- **Sweeps.** Any dial across its whole range in one run.
- **Descriptor banking** (`--desc=1`) for head-retraining work: extracting
  the [1024] vector for every FairFace crop is minutes, not a night.
- **Bootstrap confidence intervals** — resampling needs the population,
  and the population now costs 3 minutes.

## 9. Gotchas

- `execFileSync` cannot spawn `esbuild.cmd` on Windows without a shell;
  `run.mjs` uses the esbuild **JS API**.
- Repo files are CRLF. A python patch must `.replace('\r\n','\n')` before
  matching or the anchor silently misses.
- Two jobs at once need different `--port` (and get different Chrome
  profiles automatically).
- The Bash heredoc breaks on long bench bodies — use the Write tool.
