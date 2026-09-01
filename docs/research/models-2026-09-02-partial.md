# 2025/2026 model survey — partial, salvaged from an agent that returned no file

Recorded because the finding is real and the parent agent lost it. Not a
complete survey; the full one is being re-run.

## The headline negative

**No genuinely new, licence-clean, edge-deployable model published in
2025/2026 does two or three of our jobs in one forward pass.** Face
detect / person detect / gender-age attribute remain three models. A
single multi-task net would have to be **our own distillation project**.

Checked directly and empty: Google AI Edge / MediaPipe (one release in
the window, v1.0.0 2025-07-28, entirely LLM/TextEmbedder/WebGPU work, no
new vision detector); Meta (2025/26 open releases are generative);
Qualcomm (see below). PapersWithCode task pages now 302 to
huggingface.co/papers/trending — the face-detection leaderboard is gone.

## The one real candidate

**Qualcomm `face_det_lite` (Lightweight-Face-Detection)** — a possible
**BlazeFace replacement only**, not a multi-task win.

- **878K params**, 3.37MB float, **965KB-1.09MB quantized** (w8a8/w8a16)
- Face bbox + 5 landmarks, no attributes
- **BSD-3-Clause on code AND weights** — clean for us
- Checkpoint `QFD_V3_superlite_060525_50_pickled.pt`: the `060525` implies
  June 2025 training, so genuinely fresh work
- **NO Adreno 610 benchmark exists.** Qualcomm's device tables for every
  face/person model list flagship tiers only (Snapdragon 8-series, X
  Elite/Plus, Dragonwing). We would have to benchmark it ourselves.

Also on AI Hub, all BSD-3-Clause: `foot_track_net` (person + feet, 2.53M
params, 9.69MB float / 2.6-2.9MB quantized); `face_attrib_net` (12.1M,
attributes are eye-closed/mask/glasses only — **no gender, no age**);
`MediaPipe-Face-Detection` (a repack of BlazeFace, i.e. what we ship).

## Disqualified on licence

- **Ultralytics YOLOv8 / YOLO11 — AGPL-3.0.** Confirmed. This also kills
  the ETASR "unified human and face detection" fine-tune built on it.
- **FaceXFormer** (ICCV 2025, MIT licence, 10 facial tasks in one pass)
  is clean on licence but is a desktop-GPU research transformer with no
  ONNX/TFLite export, no browser path, incomplete repo, and no person
  detection. Not usable. Also note it is a **March 2024** preprint riding
  a 2025 venue — not fresh work.
- `onnx-community/age-gender-prediction-ONNX` (Oct 2025, Apache-2.0) is
  a **ViT-Base, 86.8M params** — roughly 100x `face_det_lite` and far
  larger than our HSE-FaceRes. Classification-only on a pre-cropped face.
  A regression, not a win.

## Noted

A Google/Qualcomm patent filing ("Whole person association with face
screening") describes exactly the shared-backbone, person-head +
face-head design as a compute saving. A patent, not a released model —
but worth knowing the idea is claimed.
