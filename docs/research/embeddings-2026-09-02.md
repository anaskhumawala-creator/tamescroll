# Face and person embedding models — licence survey

We use faceres' [1024] descriptor for identity memory. Bar: permissive
on **code AND weights**. Verified against primary sources.

## Face embedding — one clean winner

**dlib ResNet-34, shipped as face-api.js `face_recognition_model`.**
The only candidate permissive on both halves AND already a working TFJS
package. Code MIT (justadudewhohacks/face-api.js); weights **public
domain** by an explicit grant from Davis King ("the pretrained model used
by this example program is in the public domain", dlib blog 2017).
**128-dim, ~6.2MB quantized** (2 shards), 150x150 aligned input, **LFW
99.38%**. Trained on ~3M faces / 7,485 identities (FaceScrub + VGG +
own scrape). No conversion work.

**Fallback: BecauseofAI MobileFace via vladmandic/human-models.** MIT,
**2.1MB**, 256-dim, 112x112, already one config flag from our pipeline
since we depend on human-models already. LFW 99.653% but **self-reported
on a non-standard "Actual Scene" protocol** — discount it. **Training
dataset is undisclosed anywhere in the repo** — a provenance gap, not a
licence violation.

### Disqualified on WEIGHTS — do not revisit

- **MobileFaceNet**, every reimplementation checked (foamliu Apache-2.0,
  sirius-ai MIT): all trace to **MS-Celeb-1M**, which Microsoft took down
  in June 2019 over consent. Code licence does not launder the weights.
- **InsightFace buffalo_l / w600k_r50 / antelopev2.** Their own README:
  *"The pretrained models we provided with this library are available for
  non-commercial research purposes only."* MIT code, restricted weights,
  stated explicitly.
- **EdgeFace — the sharpest trap here.** Idiap's code is BSD-3-Clause,
  but the official weights are **CC BY-NC-SA 4.0** on Idiap's own model
  card. A third-party ONNX repo (`yakhyo/edgeface-onnx`) re-badges them
  **MIT** — a repackager cannot relicense someone else's NC weights.
  **Do not trust that badge.** (1.24M params, LFW 99.57% — attractive and
  unusable.)
- **SFace (OpenCV Zoo)** — Apache-2.0 repo and model LICENSE, but the
  README **never discloses which dataset the shipped checkpoint used**
  (the paper trains variants on CASIA-WebFace, VGGFace2 *and*
  MS-Celeb-1M). 36.9MB fp32. Unresolved, deprioritised on size anyway.

## Person re-ID (appearance, not face)

**OSNet (KaiyangZhou/deep-person-reid).** Code **MIT** and the official
HF weight card says **"License: mit"** — clean on both. 512-dim,
256x128 input, five scales:

| variant | params | GFLOPs | Market-1501 r1 (mAP) |
|---|---|---|---|
| x1_0 | 2.2M | 0.98 | 94.2 (82.6) |
| x0_5 | 0.6M | 0.27 | 92.5 (79.8) |
| x0_25 | **0.2M** | 0.08 | 91.2 (75.0) |

Relevant to us because our subjects are often not facing camera.
**No browser build exists for ANY permissive person-reID model** — a
GitHub search for onnxruntime-web/tfjs reID returned zero repos. Torchreid
added ONNX/OpenVINO/TFLite export in Aug 2022, so the path is supported;
the work is ours. Accuracy at our tiny crop sizes is uncharacterised
anywhere in the literature.

Provenance flag: the released OSNet weights are **MSMT17**-trained, a
research-use dataset — lower severity than the retracted ones (never
pulled, no scandal) and the author MIT-licensed the weights himself, but
worth a sanity check. **Torchreid's zoo also hosts DukeMTMC-trained
variants — avoid those**; Duke pulled DukeMTMC in June 2019 over consent.

FastReID (JDAI-CV, Apache-2.0) noted so it is not rediscovered: ResNet50
-class by default, no lightweight config with published numbers found, no
browser path. OSNet already covers this niche.
