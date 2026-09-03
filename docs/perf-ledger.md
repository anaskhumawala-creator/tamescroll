# Performance ledger — his Redmi 13 (23122PCD1I, SM4450 / Adreno 613)

One row per shipped build, measured on HIS phone through the in-app
Share report. This is the revert map: if a future build reads worse than
the row above it, the build that owns the gain is named here and its APK
is one install away.

**How to revert.** Every release is a git tag AND a GitHub release with
its own APK:

    gh release list --repo anaskhumawala-creator/tamescroll
    gh release download app-v0.1.101 --repo anaskhumawala-creator/tamescroll

Install that APK from Files. Code side, `git tag` carries the same
points. Nothing has to be rebuilt to go back.

**Rule for this file.** A row is only written from a report off HIS
phone. Old-Redmi and emulator numbers are a different machine and go in
the handoff, never here. Every row names the engine it ran on, because a
drop percentage measured on a CPU engine cannot be compared with one
measured on GPU.

## Rows

| build | engine (face / gender / person) | drops % | verdict p50 | notes |
|---|---|---|---|---|
| 1096-1098 | — | — | — | no report from his phone |
| 1100 | cpu / cpu / cpu | **3.62** | 611-805 | first diagnostics off his phone. Native never came ready in 4 of 9 watch documents. Auto test: control 3.62, blur-in-frame 16.68, gl 13.44, cpu-mask 17.74, render-every-2 5.39 — but the two worst rows had native DEAD, so they measured the WebGL worker, not the dial. |
| 1101 | npu / gpu / gpu | 2.5 | **402** | GPU delegate stops trusting the frozen device list and measures. His phone is `listed: false`. Trial ran on all three, all agreed: gender 11ms GPU vs 37 CPU (won), person 46 vs 75 (won), face 29 vs 22 (GPU REFUSED, then NNAPI won it). Ready 6816ms -> 2597ms on the trial path. |
| 1102 | npu / gpu / gpu | **3.34 control** | 402-487 | pill + gear stop riding the home feed (no perf change). First GPU-era auto test, 60s per arm: control 3.34 / 54.7Hz, **BLUR_IN_FRAME 2.22 / 54.6Hz**, PRESENTER_GL 4.67 / 52.0, NATIVE_CPU_MASK 4.00 / 52.8, RENDER_EVERY 2 5.50 / 26.8Hz. |

## What each row proved

- **1101 is the build that owns the speed.** 402 against 611-805 is the
  single biggest gain his phone has ever recorded, and it came from
  measuring the delegate instead of reading a device list.
- **The chip choice is worth ~0.7 points of dropped frames**, measured
  directly: forcing face back to CPU (auto-test arm 3) reads 4.00
  against the control's 3.34 with everything else identical.
- **BLUR_IN_FRAME 1 is the open win**: 2.22 against 3.34, no framerate
  cost, and it is an OTA dial — no install. n=1 per arm; repeat before
  it is called.
- **The NPU is not deterministic.** Auto-test arms 0-2 ran face on the
  NPU; a later document on the same build reads `npu: failed` and face
  on CPU. Android picks the NNAPI device per launch. It can only ever
  take the FASTER one, so this is variance, not a risk — but it means a
  drop percentage carries a launch-to-launch spread and two reads of the
  same build can differ.

## Open, unmeasured

- Startup: the first seconds are where the drops live. Not fixed.
- Whether NNAPI is genuinely on the Hexagon NPU: `npu: ok` proves it beat
  CPU on a real frame, NOT which silicon Android chose. The report
  carries no NNAPI timing and no device name.
