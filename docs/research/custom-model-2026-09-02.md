# Should we train our own model? — decision doc, 2026-09-02

**Verdict: NO-GO on all four options as currently framed, and the reason
is measured, not argued.** A gender/age model that is *perfect* — an
oracle that no amount of training can beat — removes **14% of scored
error in man mode and 24% in woman mode**. The other 76-86% is the
decision layer: patch geometry, association, coasting. Training a model
is a real project with a real licence minefield attached, and it is
aimed at the smaller half of the smaller half of the problem.

Two premises in the brief are refuted below on this repo's own data. One
option (a detector specialised to our input) survives as **GO-IF**, and
the gate on it is a measurement nobody has taken.

Companion docs, both from today, both still valid:
`gender-lowres-2026-09-02.md` (what off-the-shelf attribute models exist
and their weight licences) and `models-2026-09-02-partial.md` (no
licence-clean multi-task edge model exists). This doc is the layer above
them: *whether to build one at all*.

---

## 0. What is new here

Everything in §1-§3 is a measurement taken today against
`Z:/tamescroll-corpus`, not a literature claim. The scripts were run from
the scratchpad; **no repo source was modified**. The corpus is 10 videos,
18 windows, 3,465 banked reads, 112x112 face crops on disk, 107 clusters
of which 52 carry a `man`/`woman` label covering 2,385 reads.

---

## 1. PREMISE REFUTED #1 — the corpus is not a native-resolution instrument

CLAUDE.md (loop 40) records "THE CORPUS IS A NATIVE-RESOLUTION INSTRUMENT
AND HIS PHONE IS NOT" and attributes three flat sweeps to it. For the
**resolution** axis that is wrong, and it has been costing us.

`corpus-lib.mjs` decodes at `W = 640, H = 360` — *his measured decode,
itag 134*, the same numbers as the device. Measured face sizes across all
3,465 banked reads:

| | p05 | p25 | p50 | p75 | p95 |
|---|---|---|---|---|---|
| native px | 26.8 | 41.1 | **64.1** | 96.4 | 154.3 |

**49.9% of corpus reads are under 64px. 26.8% sit inside the device's own
38-62px band.** The corpus already contains his regime; it has to be
*sliced*, not replaced. And the descriptor-collapse figure the brief
quotes as a device-vs-corpus contrast reproduces almost exactly once you
slice it:

| population | fraction with `nm` < 5 |
|---|---|
| his phone, live | 36-42% (CLAUDE.md loop 38/40) |
| **corpus, px 38-62** | **37.5%** (n=929) |
| corpus, px 64-100 | 8% |
| corpus, px 100+ | 4% |
| corpus, all reads | 20.6% |

So "2.3% of corpus reads carry no descriptor signal against his 36-42%"
was comparing his 38-62px population against our *whole* corpus. Sliced
like-for-like the two agree to within a point and a half. **The device
regime has been sitting in the corpus the entire time.**

*Consequence:* the trap named in the brief's §5 is real for anything
resolution-shaped, but it is a *slicing* failure, not an instrument
failure, and it is fixable for free. Any future sweep that reads flat
should be re-run restricted to `px < 64` before it is written down as a
null result.

---

## 2. PREMISE REFUTED #2 — resolution is not why women read as men

This is the load-bearing measurement in the document.

### 2a. The population curve looks exactly like a resolution effect

Balanced accuracy of the shipped read against the human cluster label:

| band | n | man recall | woman recall | balanced |
|---|---|---|---|---|
| < 40px | 355 | 100.0% | 78.9% | 89.4% |
| **40-64px** | **509** | **99.0%** | **75.1%** | **87.0%** |
| >= 64px | 1521 | 99.7% | 90.3% | **95.0%** |

An 8-point balanced-accuracy hole sitting precisely in the device band.
That is the curve the whole "fine-tune on low-res faces" idea rests on.

### 2b. It vanishes within identity

Paired test: for each labelled cluster with >= 8 members on both sides of
64px, compare the model's accuracy on that *same person* small vs large.
18 clusters qualify.

**Mean accuracy delta (>=64px minus <64px): −1.6 points.** Being bigger
does not help. Per-cluster deltas are 0 for 9 of 18, and the largest
movements go in *both* directions (+25, −21, −22).

What *does* move with size, within identity, paired:

| quantity | mean delta (big − small) | sign |
|---|---|---|
| `nm` (descriptor magnitude) | **+0.97** | 12/18 positive |
| certainty `2·abs(v−0.5)` | **+0.091** | 14/18 positive |
| gender **correctness** | **−1.6 pts** | no signal |

This is coherent and it is the whole finding: **resolution degrades the
embedding and the confidence, and does not flip the decision.** It also
independently reproduces `detection-engine.md`'s own earlier result — "28
of 28 real faces agree with their own full-resolution answer at every
size down to 32px, 0 certain-wrong" — on a completely different
instrument (real video frames, human cluster labels, rather than degraded
thumbnails).

The §2a curve is therefore a **subject-mix confound**. The people who
appear small are different people from the ones who appear large.

### 2c. The real defect is per-subject female recall

Man recall is 99-100% at *every* size. Every error is a woman read as a
man. Per labelled woman cluster:

| cluster | n | accuracy | mean px | mean nm |
|---|---|---|---|---|
| KAWvDsghyc8#39 | 8 | 0% | 46 | 8.2 |
| H14bBuluwB8#6 | 38 | **16%** | 52 | 3.3 |
| RcGyVTAoXEU#10 | 10 | 30% | 38 | 5.7 |
| KAWvDsghyc8#20 | 36 | **42%** | **98** | 9.9 |
| eIho2S0ZahI#6 | 10 | 50% | 74 | 7.9 |
| 8R1hy3uHds0#15 | 80 | 71% | 47 | 7.9 |
| NWoT1ZVd1Lo#0 | 124 | 77% | 66 | 8.3 |
| z86LGEFyQpo#3 | 39 | 79% | 33 | 6.3 |
| (8 further clusters) | 490 | **96-100%** | 71-144 | 6.2-10.4 |

**7 of 22 woman clusters are below 50% accurate — 96 of 975 woman reads,
10%.** Note KAWvDsghyc8#20 at 42% with a mean face of **98px** and healthy
`nm` 9.9: a large, well-resolved face the model is simply wrong about.
This is a per-identity bias in faceres, not a resolution artefact, and it
matches CLAUDE.md loop 38 exactly ("it is per-SUBJECT: `H14bBuluwB8` reads
p50 0.635-0.670 with 0% clearable at 854, 1280 AND 1920").

---

## 3. THE CEILING — what a perfect model is actually worth

The scorer (`corpus-score.mjs`) replays the **shipped** decision layer over
banked reads and scores three errors in seconds. I substituted, for every
crop carrying a human label, the read a *perfect* model would have
produced (certain, adult, high `nm`, correct side), and re-scored. Nothing
can beat this arm.

| arm | EXPOSURE | FALSE COVER | PHANTOM | total error |
|---|---|---|---|---|
| **man mode** | | | | |
| shipped | 7.5s | 197.5s | 286.5s | 491.5s |
| perfect gender | **3.0s** | **143.0s** | 278.0s | **424.0s** (−13.7%) |
| + perfect face/non-face | 3.0s | 141.0s | 252.0s | 396.0s (−19.4%) |
| **woman mode** | | | | |
| shipped | 7.0s | 280.5s | 392.0s | 679.5s |
| perfect gender | 9.5s | **188.0s** | 318.5s | **516.0s** (−24.1%) |
| + perfect face/non-face | 9.5s | 186.5s | 292.0s | 488.0s (−28.2%) |

Read this carefully, because it is the go/no-go:

- **A perfect gender model buys 13.7% / 24.1% of total scored error.** The
  remaining 424s / 516s is produced by code, not by the classifier.
- **False cover falls 28% / 33% — and 143s / 188s survives perfection.**
  By construction, every second of that residual is *geometry*: a solid
  patch minted for person A covering person B. CLAUDE.md already records
  that cost as accepted policy ("Blur patches are SOLID"), so most of it
  is not even a defect.
- **Phantom barely moves — 286.5 → 278.0s, 3%.** Adding a *perfect
  face/non-face detector on top* only takes it to 252s. So ~88% of phantom
  is unclaimed patches: stale tracks, coasting, oversized synthetic
  bodies. No model fixes those.
- **Exposure is already 7.5s of 564s covered-or-exposed (1.3%)**, and
  perfection takes it to 3.0s. In woman mode perfection makes exposure
  *worse* (7.0 → 9.5s), because correcting reads lets more tracks clear.
- **A perfect model is worth about 68 seconds in man mode.** That is the
  entire prize, and it is the *upper bound* on options (a), (b) and (d)
  combined.

### Honest limits of this experiment

1. **It replays HIS REGIME only** (MoveNet admits nobody), the same
   limitation the scorer documents about itself.
2. **Labels cover faces the detector found.** Exposure from a *missed
   detection* is invisible here, so 7.5s is a **lower bound**. This is the
   one crack through which a model project could still be justified — see
   §4c.
3. `mixed` and unlabelled faces are skipped in both directions.
4. The oracle sets `nm = 12`, which also switches off the null-mint gate
   for labelled faces. That is part of "perfect", but it means the arm is
   slightly generous to the model.
5. Ten videos, heavily autocorrelated. **n is not confidence.**
6. Run once. Replay is deterministic, so there is no variance to quote —
   but there is also no second corpus.

---

## 4. The four options

### (a) Fine-tune an existing model on low-resolution faces — **NO-GO**

The premise is refuted (§2). Resolution-augmented training targets the
axis on which our decisions do *not* move. It would improve `nm` and
confidence — quantities we consume as a *quality signal*, deliberately
(`NULL_MINT_NM_FLOOR`) — and leave female recall where it is.

The literature's headline numbers do not transfer, and it is worth being
explicit about why. Ge et al. (TIP 2019) report LFW 70.23% → 89.72% at
32px from selective distillation; Massoli et al. (IVC 2020) report IJB-B
TAR@FAR=1e-3 rising 24.4% → 67.0% at 16px; arXiv:2302.05621 reports
SCface +7.81pp and XQLFW +25.4pp from **augmentation alone**.
[arxiv.org/abs/1811.09998](https://arxiv.org/abs/1811.09998) ·
[arxiv.org/abs/1912.02851](https://arxiv.org/abs/1912.02851) ·
[arxiv.org/abs/2302.05621](https://arxiv.org/abs/2302.05621)

**Every one of those is identity recognition** — a fine-grained
embedding match, which is exactly the capability that collapses first at
low resolution, and exactly the capability **this repo deleted in R13**
("Identity memory — DELETED IN R13 — the whole mechanism"). We run a
*binary* classifier, which §2b shows is stable to 32px. Quoting an
LR-recognition gain as an LR-gender gain is a category error, and it is
the error the brief's framing invites.

**GO-IF, reframed:** if the fine-tune is retargeted from *resolution* to
*female recall on our domain* — a head-only fine-tune on gender-balanced,
domain-matched crops — it attacks the right defect. Even then §3 caps the
prize at ~68s in man mode, and §5 says the data to do it legally barely
exists. Would change my mind: a measurement showing female recall is
recoverable to >95% by head-only fine-tuning on our own 975 woman reads
held out by cluster, *and* a re-score showing the oracle gap actually
closes.

### (b) Distil the three-model stack into one multi-task network — **NO-GO for accuracy, GO-IF for latency only**

It cannot beat the oracle, so its accuracy ceiling is the same 14-24% —
and a distilled student is normally *worse* than its teachers, not better.
As an accuracy play it is strictly dominated.

As a **latency** play the motivation is real (the person model is 63-78%
of a pass while admitting nobody) but the cheap version of that win is not
a training project: it is *not running MoveNet in a regime where it admits
nobody*, which is a config change. `models-2026-09-02-partial.md` already
establishes that no licence-clean multi-task edge model exists to copy, so
this would be a from-scratch distillation — the highest-complexity option
on the list, needing paired teacher outputs, a training pipeline, an
export path, and permanent maintenance. For a solo beginner developer this
is the option most likely to consume months and ship nothing.

Would change my mind: a measured pass-cost budget showing that a single
2-4MB forward pass at ~10Hz is the difference between the blur tracking
and not tracking, *after* the cheap MoveNet-skip has been tried.

### (c) Train a detector specialised to our input distribution — **GO-IF, and it is the strongest of the four**

This is the only option the ceiling experiment cannot dismiss, precisely
because the instrument is blind to it. The scorer says so in its own
header: *"labels cover faces the DETECTOR FOUND. A person BlazeFace never
detected is invisible here."*

So **detector recall is the one error class in this product that has never
been measured**, and it is the class the owner's oldest complaint ("she
doesn't get blurred") would live in. BlazeFace runs at 128/256px model
space; a 40px face in a 640x360 frame arrives at ~13-16px of model input.
Everything about that is unfavourable, and we have no number for it.

**The gate is therefore a measurement, not a training run.** See §9.

Two further constraints if it ever proceeds: WIDER FACE — the obvious
training set — is explicitly non-commercial ("not to reproduce,
duplicate, copy, sell, trade, resell or **exploit for any commercial
purposes**",
[wider-challenge.org/terms_and_conditions_2018.html](https://wider-challenge.org/terms_and_conditions_2018.html)),
so it is a trap; and Qualcomm's BSD-3-Clause `face_det_lite` (878K params,
~1MB quantized, per `models-2026-09-02-partial.md`) may be a drop-in
replacement that needs *no training at all*. **Try the swap before
training anything.**

Would change my mind (toward GO): measured BlazeFace recall below ~85% on
corpus frames at px < 64, *and* `face_det_lite` failing to close the gap.

### (d) Test-time adaptation / super-resolution preprocessing — **NO-GO**

Refused on two independent grounds.

*Ours:* §2b says resolution does not flip the decision, so a preprocessor
that restores resolution has nothing to fix.

*The literature's:* the evidence that SR helps downstream recognition is
weak and contested. A Frontiers study (2022) with 130+ human subjects
found deep SR gave **no considerable advantage over plain bicubic**
despite far better visual quality
([frontiersin.org](https://www.frontiersin.org/articles/10.3389/frsip.2022.854737/full)).
And the failure mode is the dangerous one for us: PULSE (Menon et al.,
CVPR 2020, [arxiv.org/abs/2003.03808](https://arxiv.org/abs/2003.03808))
searches a StyleGAN latent space for *any* high-res face that downscales
to match the input — it does not recover detail, it invents a plausible
face. Its public failure (a pixelated Obama upsampled to a white face)
is the canonical demonstration that generic SR **fabricates apparent
attributes**. A generative preprocessor in front of a gender classifier
can manufacture a confident wrong answer out of nothing, which is
strictly worse than the abstention we get today. Identity-preserving SR
(EIPNet, Super-Identity CNN) exists but is research-grade, not a
preprocessing bolt-on.

The cheap non-generative half of (d) — better crop resampling — is
already shipped: `crop-geometry.mjs` does aspect-preserving square crops,
and getting that wrong was the 2026-08-28 defect that flipped gender
reads.

---

## 5. Data — the licence situation, adversarially

**In two sentences:** almost every well-known face-attribute dataset —
CelebA, UTKFace, IMDB-WIKI, Adience, VGGFace2, AgeDB, FFHQ, WIDER FACE,
CASIA-WebFace, MORPH — is explicitly non-commercial-research-only, and
several (CelebA, AgeDB, VGGFace2) extend that restriction to "**derived
data**" or "redistribution **in any form**", which reads directly onto
trained weights. The only genuinely permissive candidates are **FairFace**
(CC BY 4.0) and **Open Images / MIAP** (CC BY 4.0 annotations over CC BY
2.0 images, with Google expressly disclaiming any warranty on per-image
licence status) — and neither is face-attribute-clean enough to be a
drop-in replacement for what the NC datasets offer.

| dataset | licence as stated | NC? | still distributed | derivative-weights clause |
|---|---|---|---|---|
| **FairFace** | CC BY 4.0 | no | yes | silent (CC BY permits) |
| **Open Images V6/V7, MIAP** | annotations CC BY 4.0; images "listed as CC BY 2.0", warranty disclaimed | no | yes | silent (CC BY permits) |
| COCO / persons | annotations CC BY 4.0; images per Flickr ToU | mixed | yes | silent; risk at image layer |
| LAION-Face | metadata CC BY 4.0; images **not licensed by LAION** | no (metadata) | metadata only | inherits uncleared pixels |
| CelebA | "**non-commercial research purposes only**… not to… exploit for any commercial purposes, any portion of **derived data**" | **yes** | yes | **explicit** |
| AgeDB | same "derived data" template | **yes** | yes | **explicit** |
| VGGFace2 | "same conditions of non-commercial research for any modification and/or **re-distribution in any form**" | **yes** | **official download REMOVED** | **explicit** |
| WIDER FACE | academic research only, non-commercial | **yes** | yes | broad enough to sweep in |
| CASIA-WebFace | signed agreement, "non-commercial research and educational purposes" | **yes** | gated | contractual |
| UTKFace | "**non-commercial research purposes only**"; images "not property of AICIP" | **yes** | yes | silent |
| IMDB-WIKI | IMDb terms: "personal and **non-commercial** use" | **yes** | yes | IMDb bars re-databasing |
| Adience | no open grant; "all rights reserved" compilation | implicit | yes | silent |
| FFHQ | collection **CC BY-NC-SA 4.0**; images mixed per-image | **yes** | yes | **ShareAlike would infect our weights** |
| MS-Celeb-1M / MS1MV2 | never formally licensed | yes | **WITHDRAWN 2019** | n/a — do not touch |
| MegaFace | Flickr CC, mostly NC | yes | **DECOMMISSIONED 2020** | n/a — do not touch |
| DiveFace | majority **CC BY-NC-ND** | **yes** | partial (MegaFace links dead) | **NoDerivatives — maximally hostile** |
| BUPT-Balancedface / RFW | gated, non-commercial | **yes** | gated | **derived from MS-Celeb-1M** |
| LFW / funneled | UNVERIFIED — no open grant found | by convention | yes | UNVERIFIED |
| AFAD, CACD, APPA-REAL, MTFL | **UNVERIFIED** (MTFL is CelebA-derived — assume CelebA terms) | likely | yes | UNVERIFIED |
| MORPH | **paid** commercial tier exists | n/a | paid | UNVERIFIED |

**The traps, named plainly:** MS-Celeb-1M and MegaFace (withdrawn — every
pretrained "MS1MV2" checkpoint in the wild inherits this); FFHQ (looks
open because StyleGAN is everywhere, is NC-SA and the ShareAlike would try
to force our weights NC-SA); CelebA / AgeDB / VGGFace2 (the "derived data"
clause is unambiguous and universally ignored in tutorials); DiveFace
(NoDerivatives); RFW / BUPT-Balancedface (MS-Celeb-1M provenance); and
IMDB-WIKI, which half the age/gender literature is built on.

**A conflict worth flagging.** `gender-lowres-2026-09-02.md` marks
FairFace "AMBIGUOUS, not usable" — that judgement is about the
**checkpoints**, which have no LICENSE file. This doc's CC BY 4.0 finding
is about the **dataset**. Both are right and they are not the same
question: we could lawfully *train on* FairFace and could not safely
*ship their weights*. Keep the two separate.

One further caveat on FairFace, from Adam Harvey's licensing survey: its
distributed archives carry **no per-image CC licence metadata**, and the
YFCC100M "all CC-licensed" claim it inherits has been shown unreliable.
So the dataset-level CC BY 4.0 covers the *labels* with confidence and the
*pixels* only on trust. [adam.harvey.studio/creative-commons](https://adam.harvey.studio/creative-commons/)

### The dataset we already own, and its exact limits

The corpus is **3,465 face crops at 112x112, on disk, from the real
640x360 decode, with 2,385 of them carrying a human gender label at the
cluster level**. Nothing external matches it for domain fit — it *is* the
deployment distribution.

- **Usable for internal training and evaluation:** yes.
- **Redistributable:** **no.** They are frames from copyrighted YouTube
  videos. This kills the "open-source the eval set" half of §8 outright.
- **Big enough to fine-tune a head:** marginally — but 52 identities is
  not 52 independent samples. Held-out evaluation must split **by
  cluster**, never by read, or the number is meaningless.

### Ethics and law, briefly but not dismissively

- **GDPR:** Article 9's special-category regime attaches to biometric data
  processed "for the purpose of uniquely identifying a natural person".
  We infer an attribute and never identify, which is a genuine argument in
  our favour — not a guarantee. On-device-only with nothing transmitted is
  close to the best-practice pattern.
- **Illinois BIPA:** "scan of… face geometry" is a biometric identifier,
  consent is required *before capture*, and courts have read "capture" to
  cover non-users whose faces merely appear. **Our app processes the faces
  of third parties in other people's content.** There is no express
  on-device exemption. Statutory damages are $1,000-$5,000 per violation
  with a private right of action. This is the sharpest single legal risk
  in the product and it is **UNRESOLVED**; it deserves counsel before an
  Illinois release, independent of anything in this doc.
- **Texas CUBI:** HB 149 (TRAIGA), effective 2026-01-01, exempts
  biometric identifiers used to "develop, train, evaluate, disseminate, or
  offer AI models… unless the system is used to uniquely identify a
  specific individual." We appear to sit inside that carve-out.
- **EU AI Act — and this one bites the open-source goal specifically.**
  Article 5(1)(g) prohibits biometric categorisation inferring race,
  political opinion, union membership, religion, **sex life or sexual
  orientation**. Plain male/female is *not* on that list, so we are not
  prohibited. But **Annex III(1)(b)** classifies as *high-risk* systems for
  "biometric categorisation, according to **sensitive or protected
  attributes**", and sex is a protected characteristic under Charter
  Article 21. The escape is Article 3(40), which excludes categorisation
  that is "**ancillary to another commercial service and strictly
  necessary for objective technical reasons**" — a defensible reading for
  a blur feature. **That escape does not travel with a standalone released
  model.** A gender classifier published as a general-purpose reusable
  artefact has no ancillary service to be ancillary to. This is a direct
  argument against the brief's stated open-source ambition, and it is the
  kind of question that needs EU counsel, not a research doc.
  [artificialintelligenceact.eu/article/5](https://artificialintelligenceact.eu/article/5/) ·
  [/annex/3](https://artificialintelligenceact.eu/annex/3/) ·
  [/article/3](https://artificialintelligenceact.eu/article/3/)

---

## 6. Cost and mechanics, if it ever happens

**Compute is not the constraint and should not be discussed as one.**
Reference points: insightface's own recipes put ResNet18 on MS1MV3 (~5.1M
images) at ~4 GPU-hours, ResNet100 at ~116
([arxiv.org/html/2404.11118v1](https://arxiv.org/html/2404.11118v1)). A
MobileFaceNet-class *head fine-tune* on tens of thousands of crops is far
below that — **ESTIMATE: 1-10 GPU-hours**, unverified for our exact setup.
2026 rental, on-demand single GPU, **ESTIMATE and volatile**: RTX 4090
~$0.34-0.69/hr (RunPod) or ~$0.09-0.59/hr (Vast.ai marketplace, no SLA);
A100 80GB ~$1.07/hr on-demand, $2.06/hr Lambda; H100 ~$2.01-2.99/hr. So
the compute bill is **$0.50-$25**. That is not a decision input.

**The constraints are the export path and the maintenance burden.**

- **PyTorch → TF → TF.js** is the path that matches what we already run
  and what we have already debugged inside WebView2 and Android WebView.
- **PyTorch → ONNX → onnxruntime-web** is architecturally nicer (WebGPU,
  broader ops) but **its behaviour inside Android system WebView and
  WebView2 specifically is UNVERIFIED** in anything found. This repo's own
  history — Trusted Types blocking blob Workers, the >1MB
  `initialization_script` truncation, the service worker eating our
  synthetic URLs — says that class of gap costs a session to discover.
- **int8 is not safe for this model class.** TF.js's own quantization
  example reports "significant deterioration" from int8 on MobileNetV2 and
  recommends float16
  ([tfjs-examples/quantization](https://github.com/tensorflow/tfjs-examples/tree/master/quantization)),
  and this repo measured it directly: full uint8 requant of faceres
  produced **17/100 decision flips at `GENDER_MIN_SCORE`, 8/100 at
  `GENDER_IMAGE_MIN_SCORE`, 2 outright sign flips** (loop 34). The hybrid
  uint8/f16 requant that worked on MoveNet worked because pose regression
  tolerates noise that a small-margin classifier does not.

**And the honest maintainability question.** The owner is a solo beginner
developer. A trained model is not a commit; it is a permanent dependency
with a training pipeline, a data provenance record, a reproducibility
burden and a re-training obligation every time the input distribution
moves. The fallback if it is not maintained is worse than the status quo:
a bespoke model nobody can retrain, with worse provenance than a
well-known MIT one. **Swapping to an existing licence-clean model
(`face-api.js age_gender_model`, 420KB, MIT code *and* MIT weights) is a
day's work and carries none of that** — and it is the experiment
`gender-lowres-2026-09-02.md` already nominates as cheapest.

---

## 7. The evaluation protocol I would demand

Any candidate model, trained or swapped, before it ships:

1. **Re-run the model over the 3,465 banked PPM crops**, regenerate the
   reads, and replay `corpus-score.mjs` unchanged. The decision layer must
   be byte-identical between arms; only the reads change. This is cheap —
   the crops are on disk — and it is the only way the three error numbers
   stay comparable to every figure this repo has published.
2. **Report all three errors, both gender modes, always.** A model that
   cuts false cover by buying exposure is a regression.
3. **Split held-out data by CLUSTER, never by read.** 3,465 reads are 107
   clusters and 10 videos. A read-level split trains and tests on the same
   face.
4. **Slice every result by `px`**, at minimum `<40 / 40-64 / >=64`. §1 is
   the reason: three sweeps have already read flat because they were run
   over a population dominated by faces larger than the device sees.
5. **Report per-class recall, not accuracy.** §2c: man recall is 99-100%
   at every size, so overall accuracy is mostly a measure of how many men
   were in the slice.
6. **Score against the oracle arm from §3, not against zero.** "Model B
   beats model A by 12s" means nothing until it is set against the 68s
   that perfection is worth.
7. **Avoiding the trap the brief names.** The corpus *does* contain the
   device regime (§1), so the resolution half of that trap is handled by
   slicing. What the corpus still cannot see is (i) **compression and
   motion artefacts of the live MSE decode** as opposed to our ffmpeg
   decode of an mp4, (ii) **WebGL fp behaviour on Adreno 610**, and (iii)
   **detector recall**. A corpus win must still be confirmed by a device
   A/B on the read rings before it is called a win — the standing rule in
   this repo, unchanged.

---

## 8. The open-source release — and whether it is a distraction

If a model were trained and were good, a genuinely useful release is:
permissively-licensed weights *and* code; a model card stating training
data provenance, the measured accuracy-by-resolution and
accuracy-by-subgroup curves, and the known failure modes; reproducible
training code; and a published eval set.

**Three of those four we cannot currently supply.** The eval set is
copyrighted YouTube frames and is not redistributable (§5). The training
data would have to come from FairFace or Open Images, whose per-image
provenance Google itself declines to warrant. And §5's EU AI Act analysis
says a **standalone** gender classifier loses the Article 3(40) "ancillary"
argument that protects the in-app use — publishing it as a general-purpose
artefact is a materially worse legal posture than shipping it inside the
blur.

**So yes: as currently framed, it is a distraction.** It is a
research-project-shaped goal attached to a product whose measured error is
76-86% not-model. The version of this ambition that is *not* a distraction
is much smaller and genuinely valuable: **publish the evaluation
methodology and the negative results** — the oracle-ceiling technique of
§3, the within-identity paired test of §2b, the corpus-slicing correction
of §1. Nobody else has published "here is how much a perfect attribute
model is worth in a real blur product, measured", and it costs no licence,
no weights and no legal exposure.

---

## 9. What to do instead, in order

1. **Measure detector recall — the first experiment.** Sample ~200 frames
   across the 18 windows, stratified so half are frames where the current
   pipeline found nothing. Hand-annotate every human face. Compute
   BlazeFace recall overall and sliced by native px. It costs an afternoon
   and $0, it is the only error class this product has never measured, and
   it is the sole gate on option (c). If recall at px < 64 is high, the
   model question is closed for good; if it is low, that number — not a
   resolution argument — is what justifies a detector project.
2. **Spend the effort on the decision layer**, which §3 shows owns 76-86%
   of the error: unclaimed patches (88% of phantom), coasting, and
   synthetic-body geometry.
3. **If gender accuracy is still wanted**, swap `face-api.js
   age_gender_model` (MIT code and weights, 420KB against faceres' 6.98MB)
   and score it through §7. A day's work, no training, no data licence, and
   it might pay for itself in bundle size alone.
4. **Revisit training only** if (1) shows a detector recall hole that
   `face_det_lite` cannot close.

---

## Appendix — provenance of every number in §1-§3

All figures computed 2026-09-02 against `Z:/tamescroll-corpus/bank`
(`reads/*.json`, `label/clusters.json`, `label/labels.json`,
`crops/**/*.ppm`) using `app/gaze/bench/corpus-score.mjs`'s exported
`replay()` and `score()` unmodified, driven by a scratchpad oracle arm.
**No repo source was modified.** The oracle arm is reproducible: for every
crop with a human label, overwrite the banked read with a certain, adult,
high-`nm` read on the correct side, then replay and score as normal.
Limits are stated in §3. Corpus videos: `NWoT1ZVd1Lo H14bBuluwB8
z86LGEFyQpo Ary1gIbaOTc RcGyVTAoXEU 4u3jS_cTHH0 8R1hy3uHds0 1L_R0MB2W5A
KAWvDsghyc8 eIho2S0ZahI`, all 640x360.
