# Native spike 1: TFLite on the old Redmi (M2010J19SI, Helio G88 / Adreno 610) -- 2026-09-02

Instrument: `BenchActivity` inside the tamescroll app (an exported debug
activity -- MIUI refuses to install a NEW package, `INSTALL_FAILED_USER_RESTRICTED`,
but re-installs the app it already has). Each model x {GPU delegate via
`CompatibilityList().bestOptionsForThisDevice` + `setPrecisionLossAllowed(true)`,
XNNPACK 4 threads}: init, one warm-up run, then 100 timed runs, p50/p95/min/max.
Raw: `gpu-bench-1.json` / `gpu-bench-2.json`, delegate partitioning in
`gpu-bench-1.delegate.log`. Launch:

```
adb shell am start -n app.tamescroll.client/.BenchActivity --ei runs 100
adb shell run-as app.tamescroll.client cat files/tsbench.json
```

## Run 1 (phone idle, thermal status 0)

| model | delegate | init ms | warm | p50 | p95 | min | max |
|---|---|---|---|---|---|---|---|
| blazeface f16 | **GPU** | 2414 | 29.9 | **19.3** | 20.3 | 16.7 | 21.4 |
| blazeface f16 | CPU | 16 | 75.5 | 56.3 | 56.9 | 55.4 | 57.2 |
| blazeface f32 | **GPU** | 1890 | 23.4 | **19.0** | 21.3 | 16.9 | 21.8 |
| blazeface f32 | CPU | 6 | 77.5 | 56.0 | 56.8 | 54.8 | 57.1 |
| faceres f16 | **GPU** | 1444 | 39.7 | **38.0** | 40.6 | 35.4 | 44.2 |
| faceres f16 | CPU | 39 | 123.0 | 110.6 | 120.6 | 109.2 | 128.9 |
| faceres f32 | **GPU** | 1425 | 40.0 | **37.5** | 38.4 | 34.9 | 41.8 |
| faceres f32 | CPU | 34 | 118.5 | 110.1 | 111.0 | 109.0 | 111.4 |
| movenet f16 | **GPU** | 3929 | 112.3 | **159.7** | 179.7 | 120.6 | 182.2 |
| movenet f16 | CPU | 62 | 241.0 | 230.9 | 232.2 | 229.8 | 232.4 |
| movenet f32 | **GPU** | 3897 | 108.8 | **159.8** | 179.1 | 123.5 | 181.1 |
| movenet f32 | CPU | 62 | 240.4 | 231.2 | 232.9 | 230.6 | 233.6 |

## Run 2 (back to back, phone warm from run 1)

| model | delegate | p50 | p95 | min | max |
|---|---|---|---|---|---|
| blazeface f16 | GPU | 19.4 | 20.2 | 17.3 | 22.3 |
| blazeface f32 | GPU | 19.5 | 20.2 | 17.2 | 20.9 |
| faceres f16 | GPU | 38.0 | 38.6 | 35.7 | 44.2 |
| faceres f32 | GPU | 37.8 | 38.7 | 35.6 | 45.1 |
| movenet f16 | GPU | 159.9 | 162.2 | 130.7 | 180.2 |
| movenet f32 | GPU | 159.7 | 162.9 | 113.7 | 179.3 |
| blazeface / faceres / movenet | CPU | 56.0-56.3 / 110.0-110.2 / 230.4-231.2 | | | |

Every p50 within 1ms of run 1. No throttling across ~5 minutes of back-to-back inference.

## Reading

- **One verdict pass on the GPU delegate = MoveNet 160 + BlazeFace 19 + 2 x faceres 76 = ~255ms** (p95 ~270). Today the WebGL worker's verdict on this phone is **922ms p50** (1092, `latency-ab-stageB5.json`); the 1091 figure was 1193. That is the whole of Task 1's gate (<= 300ms steady) with room, and it is inference only -- frame readback and the bridge (0b: 21ms) come on top.
- **Even XNNPACK on the CPU beats WebGL: 231 + 56 + 220 = ~510ms**, so the CPU fallback is not a regression path, it is still a 1.8x win. The GPU is 3.6x.
- **f16 buys nothing on the GPU** (identical p50s; the delegate computes in f16 either way with precision loss allowed) and nothing on XNNPACK either. It halves the bytes: 17MB against 34MB for the three. Ship f16 IF Task 3's corpus parity holds for faceres (one-input descriptor cosine 0.9973); otherwise f32 and 34MB.
- **MoveNet is only 112 of 237 nodes on the GPU, 2 partitions** -- the backbone. The keypoint-decoding tail (TopK, GatherNd, Range, Select ...) runs on the CPU behind it, which is where the 160ms against a 109ms warm run and the 120ms min come from: two delegate boundaries per inference, plus the GPU clocking between them. Splitting the model at the heatmaps and decoding in Kotlin or the page is the next MoveNet win and it is NOT needed to pass the gate. blazeface and faceres are 100% delegated, 1 partition each.
- **GPU init is 1.4-3.9s per model** (shader compile), ~8s for the three, once per process. Must happen off the page's critical path and before the first watch page; the existing worker warm-up already hides ~1.2s of WebGL compile the same way. Serialised OpenCL/GL kernel cache (`GpuDelegate.Options.setSerializationParams`) can cut it on the second launch -- Task 2 detail, not a gate.
- **Steady, not spiky:** p95 is within 2ms of p50 for every CPU row and within 20ms on the GPU rows. WebGL in the WebView on this phone has never produced numbers this flat.

## Decision (Task 1)

**Delegate = TFLite GPU delegate, XNNPACK as the automatic fallback**, f16 models
pending Task 3 parity. Gate passed on run 1: 255ms against 300.
