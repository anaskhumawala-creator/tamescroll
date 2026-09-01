# Box-only person detectors — alternatives to MoveNet MultiPose

We need a BOX, not keypoints. MoveNet costs 63-78% of a verdict pass.
Licences below were verified by fetching LICENSE files, not blog claims.

| model | licence (code + weights) | params | size | COCO AP | browser today? |
|---|---|---|---|---|---|
| Ultralytics YOLOv8n/YOLO11n/RT-DETR | **AGPL-3.0** | 3.2M | 6.3MB | 37.3 | **DISQUALIFIED** |
| YOLOX-Nano | Apache-2.0 | 0.91M | 1.9MB | 25.8 | yes, ORT-Web demo |
| YOLOX-Tiny | Apache-2.0 | 5.06M | 20MB | 32.8 | yes |
| NanoDet-Plus-m 320 | Apache-2.0 | 1.17M | **1.2MB int8** | 27.0 | yes, but **ncnn+wasm** |
| RTMDet-tiny (mmdetection) | Apache-2.0 | 4.8M | ~10MB | **41.1** | no |
| PicoDet-XS | Apache-2.0 | 0.70M | ~1MB int8 | 23.5 | no package found |
| D-FINE-Nano | Apache-2.0 | 3.8M | — | **~42.8** | no |
| coco-ssd (TF.js) | Apache-2.0 | — | 4.2MB | ~20.2 | **yes, official, our stack** |
| EfficientDet-Lite0 (MediaPipe) | Apache-2.0 | 3.2M | 4.6MB int8 | 25.7-26.4 | **yes, official** |

## The AGPL trap, stated exactly

Ultralytics' own licensing FAQ: *"All Ultralytics YOLO trained models
fall under the AGPL-3.0 License by default. The AGPL-3.0 License covers
the training code and the models produced by that training code."* And
embedding the weights in a shipped product triggers it with **no
modification required**. There was never a permissive era — YOLOv5 was
GPL-3.0 from inception, moved to AGPL-3.0 in April 2023.

**A trap inside the trap:** `open-mmlab/mmyolo` re-hosts RTMDet configs
and its **repo LICENSE is GPL-3.0**. RTMDet is only clean when taken from
`open-mmlab/mmdetection` (Apache-2.0), from that repo's own asset host.

**RT-DETR is two different licences.** The original `lyuwenyu/RT-DETR`
is Apache-2.0; the RT-DETR class inside the `ultralytics` package is
AGPL-3.0. Never `pip install ultralytics` for it.

## What the numbers say

Only two candidates have BOTH a first-party working browser deployment
AND a clean licence: **coco-ssd** (already our stack, weakest AP — and we
already measured it and refused it as a body-box source: phantom -41% but
exposure 82 -> 89.5s) and **EfficientDet-Lite0 via MediaPipe Tasks
Vision**, which is the only candidate with published latency:

CPU 29.31ms int8 / 61.30ms fp32; GPU 27.83ms fp32. Device unspecified,
likely Pixel-class — **not verified on Adreno 610**. Even discounted
heavily that is 10-20x below our ~500ms MoveNet. Cost: MediaPipe Tasks
runs its own WASM(+GPU) runtime, so it is a **second inference runtime in
the bundle**, not a model swap.

PicoDet publishes the survey's only real mobile-SoC latency: **7.81ms at
320px on a Snapdragon 865** (4 threads, FP16). Not our GPU, but the only
number measured on a phone at all.

Best paper ratios with no browser proof: D-FINE-Nano (42.8 AP at 3.8M)
and RTMDet-tiny (41.1 at 4.8M). Both are build-it-yourself.

## Before ripping MoveNet out

It also supplies keypoints that downstream code may quietly depend on —
`person-gate.mjs` head anchoring and `boundBodyToSlot` both read slots.
Grep before deleting.
