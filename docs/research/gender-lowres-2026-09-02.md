# Gender/age attribute models at 38-62px — survey

Our production model is HSE-FaceRes (MIT, vladmandic/human) at 224x224,
6.98MB. Faces reach it at **38-62px** on his phone. Two hard gates:
permissive licence on **both code and the specific weights**, and any
evidence at all about small-input behaviour.

**Nothing surveyed is simultaneously (a) clean MIT/Apache/BSD on code AND
weights, (b) TFJS/ONNX-web ready today, and (c) published with a real
accuracy-vs-resolution curve near our regime.** Two paths are worth
benchmarking ourselves.

## Worth a spike

**face-api.js `age_gender_model` — MIT code, MIT weights, ~420KB.**
Multitask net (tinier-Xception stem, age regression + gender head).
Gender 95%, age MAE 4.54yr across UTK/FGNET/Chalearn/Wiki/IMDB/CACD/
MegaAge. **Already a browser TFJS graph model — same deployment shape we
run.** 420KB against faceres' 6.98MB. No published low-res curve and no
stated minimum crop size, so we would have to measure it. Cheapest real
experiment on this list.
https://github.com/justadudewhohacks/face-api.js

**MiVOLO v1 — Apache-2.0 (repo-wide; not restated per checkpoint).**
Architecturally the interesting one: **dual input, face crop AND body
crop together**. Directly relevant to us, because a 40px face usually
comes attached to a much larger body region we already have a box for.
Gender 97.99% / age MAE 3.65 face+body on Lagenda; face-only
cross-dataset falls to MAE 5.55. **No TFJS/ONNX-web build; PyTorch only,
real-time claimed on A100.** A porting project, not a drop-in. Note v2
is DISQUALIFIED (DINOv3 backbone, Meta custom gated licence).
https://github.com/WildChlamydia/MiVOLO

## Known trap

**`gender-ssrnet-imdb` — Apache-2.0 both, native 64x64, 0.32MB.** The
closest published native resolution to our regime, which makes it
tempting. It is very likely the same model class **this repo already
shipped and retired as miscalibrated** (2026-08-23: single output
saturated ~1.0 on every real face). No upstream fix found; nobody
appears aware of the defect. Practitioner comparison at ~150px crops put
it last: SSR-Net 88% gender vs FaceRes 98%, GEAR 93%.

## Disqualified on licence — do not revisit

- **InsightFace `genderage`** (0.3MB, 96% gender — very attractive, and
  unusable). Code is MIT but the README states the training data *and
  the models trained with it* are **non-commercial research only**.
- **MiVOLO v2** — DINOv3 backbone, Meta custom gated licence.
- **DEX / IMDB-WIKI** — dataset is "academic research purpose only" and
  the restriction travels with weights trained on it.
- **Levi-Hassner (2015)** — no licence grant at all, only an AS-IS
  copyright notice. Absence of a licence is all-rights-reserved.
- **FairFace** — AMBIGUOUS, not usable. The only licence statement is
  "CC BY 4.0" sitting under the **Data** section; no LICENSE file and no
  terms for the checkpoints. Third-party claims that FairFace weights are
  CC-BY or MIT are unsourced — arXiv 2509.09873 documents this exact
  "licence drift" as a recurring problem. Treat with suspicion.
- **GEAR** (human-models, 198x198) — no licence metadata anywhere. Needs
  a direct check on `Udolf15/GEAR-Predictor` before it can be scored.

## The resolution evidence, such as it is

**arXiv 2511.14689 (2025)** — 1,000 IMDB-Clean images at 7 resolutions:

| res | DeepFace MAE | InsightFace MAE |
|---|---|---|
| 64 | 12.36 | **8.72** |
| 112 | 11.36 | 7.48 |
| **224** | **10.83** | **7.46** |
| 512 | 11.02 | 8.45 |
| 1080 | 11.22 | 9.76 |

Accuracy peaks at 224 and degrades **at both extremes**. The compact
ResNet/ArcFace-family pipeline loses only +1.26 MAE at 64px. Directional
evidence that compact backbones degrade gracefully at our sizes — it
measures a pipeline, not the standalone attribute model.

**FaceHop (arXiv 2007.09510)** — 32x32 GREYSCALE gender at **16.9K
parameters**: 94.63% LFW, 95.12% CMU Multi-PIE, via successive subspace
learning (not a CNN). No code and no licence found. Cite for the
approach, not the artifact: it is evidence that gender at 32px is
tractable with a nearly free model.

**AutoGen on SCFace** — 88.53% gender at **24x24** on a surveillance
benchmark. No repo/licence found.

**arXiv 2503.20108** — outside data point: *human* face recognition falls
to 50.7% accuracy at 10px inter-pupillary distance while self-reported
confidence stays at 77%. Different task and a different axis, but it
marks where the information genuinely runs out.
