# 1101 — the GPU delegate stops trusting a hardcoded list

**Owner ruling 2026-09-03:** "I want it so that any mobile would work
fine with this... instead of it missing my phone's GPU completely."

## The defect

`NativeInfer.loadModel` gates the GPU delegate on
`CompatibilityList().isDelegateSupportedOnThisDevice` (NativeInfer.kt:368).
That answer comes from `gpu_compatibility.bin`, a fixed device database
baked into tensorflow-lite-gpu 2.16.1. A device absent from it is
reported unsupported and **the delegate is never constructed** — no
throw, no log line, nothing in the diagnostics report.

Measured consequence (spikes/gauntlet/phone-diag-1100.jsonl, his Redmi
13 / SM4450 / Adreno 613, every 1098 and 1100 report):
`native.nativeBackend` and all three per-model backends read `cpu`;
`npu` reads `disabled` (NATIVE_NPU 0, expected). The old test Redmi
(Helio G85 / Mali-G52, 2020) reads `gpu` in every banked run.

Cost: verdict p50 611-805ms on his phone against ~300ms on the Redmi's
GPU. And it generalises — every phone newer than that database gets the
same silent CPU fallback.

**Scope correction banked this session:** the native engine on CPU is
NOT measurably faster than the WebGL worker fallback on his phone
(cpu docs verdict p50 611/657/760/763/805 vs dead-native docs
478/531/584/828 — overlapping, n=5 vs 4, uncontrolled). So the GPU is
the native engine's whole remaining value there.

## Constraint that shapes the design

A GPU delegate spends 1.4-3.9s per model compiling shaders cold
(spikes/native/GPU-REPORT.md). Three models inside `loadAll` could
exceed the page's 15s ready timeout — which is exactly how the 1098
NNAPI-inside-loadAll build killed native (26.5% drops, native dead).
**Nothing expensive may move into loadAll.**

## Design

Reuse the shape of the NNAPI arbiter that already exists in this file
(`npuTrial` -> `snapshotInput` -> `arbitrate` -> `decideNpu`).

- **T1** `loadModel` records WHY a model is not on the GPU:
  `gpuWhy` = `gpu` | `unlisted` | `threw` | `masked`, plus the throw
  message. `unlisted` is the new, previously invisible case.
- **T2** After ready (never inside `loadAll`), each `unlisted` model
  gets a measured GPU trial on the trial thread: build + warm there,
  copy the last REAL input on ts-infer, then time the GPU copy against
  a shadow copy of the shipping CPU model and compare EVERY output head
  with the existing `outputsAgree` (2% of head max-abs). Swap on
  ts-infer only if it agrees AND is 10% faster. A model that loses stays
  lost for the process.
  NNAPI trials are scheduled only after the GPU trials settle, so two
  shadow interpreters never build at once.
- **T3** A win is remembered in SharedPreferences under a token of
  asset + versionCode + model byte length (same token shape as the
  shader cache), so the SECOND launch goes straight to GPU and pays no
  trial. A later throw clears the key; a new build invalidates it.
- **T4** The report carries the whole story so one Share from any phone
  answers it with no cable: per model `listed`, `tried`, `won`,
  `agree`, `gpuMs`, `cpuMs`, and a redacted `whyR`. Numeric or closed
  enum everywhere except the `R` key, per `reportViolations`.
- **T5** Tests: the pure decision (agree && faster -> swap) as a JVM
  test, red-proved; JS parse of the new ready/backends fields.
- **T6** Old Redmi smoke must still read `gpu` x3 with NO trial fired
  (it is listed) — that is the no-regression check. Then 1101, and his
  phone answers `gpu` or tells us why in one Share.

## Explicitly NOT in this change

- Qualcomm's own LiteRT delegate (licence, see NOTICE).
- The "native never came ready on 4 of 9 videos" defect — its reason
  field rides the same build only if it is cheap; otherwise 1102.
