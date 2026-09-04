# PLAN -- THE ACCURACY ROUND, SCORED GLOBALLY

**Owner ruling that reframed this round, 2026-09-04:** *"I need every
single phase to work properly. People watch videos throughout the world.
It isn't restricted to India or some other country."*

That is a scoring instruction, and it invalidates how the last several
rounds were judged. Everything since finding 20 has been scored on **his
corpus** -- ten YouTube videos, 52 identities, mostly white tech
presenters. Finding 31 already measured what that hides.

---

## 1. WHAT THE FINDINGS ALREADY SETTLE

Do not re-open these. Each cost a round.

| # | Settled | Consequence for this plan |
|---|---|---|
| 31 | Race-correlated female-recall defect. Indian women **52.6%** wrong, Black **51.5%**, White 31.6%. Exposed under the image rule: Black **24.7%**, Indian **21.6%**, White 3.1%. AUC Black 0.868 / Indian 0.898 vs Middle Eastern 0.982. | Separability itself collapses, so **no threshold closes it**. The fix is a better model. Per-race calibration **REFUSED ON PRINCIPLE** (biometric categorisation on a sensitive characteristic). |
| 32 | The failure is per-person and deterministic. | Every temporal/pooling idea is dead. Re-reading the same face more times cannot help. |
| 34 | Face alignment loses, free and expensive versions both. `src/face-align.mjs` is dead code. | Crop geometry is not the lever. |
| 37 | 720p buys 4.7 points; the model costs 34.3. | Stream resolution is a rounding error against the model. |
| 38 | Detector **recall** is fine: 0.4% missed at 48px, no race or sex bias. | Detection is not why women are missed. **But it is structurally blind to false positives** -- see gap 2. |
| 43 | faceres will not run smaller: 9.3% of decisions flip at 160px input. | No free latency in the gender model. |
| 46 | Descriptor veto dead. pearson(head raw, probe) = **0.893**. | *"Every remaining idea that re-reads another head, layer or view of faceres is drawing from one well."* |
| 41/45/47 | Grey wins on **both** paths. Video: 3.6 pts of false cover at matched exposure (z 5.56, 2,159 reads). Thumbnails: junk marks **2.5-3x lower** at matched protection, and false cover lower at the same time. | Grey is the only change measured to help **both** of his complaints, it is one line, and it is free. |
| 35/45 | Junk marks measured. Null guard kills 77.8%; **19.1% still get through on video**, 7.6% on images. `NULL_MINT_NM_FLOOR` 5->6 halves video junk but **buys nothing on thumbnails and costs coverage there** -- one OTA number moves both paths in opposite directions. | The dial is an exposure trade and is his. |
| 44 | Grey silently changes the identity memory: the same pass produces the [1024] descriptor matched at `MEM_SIM` 0.6, already near its edge. | A grey build **owes a descriptor-separability bench first**. Both descriptor banks now make that a ten-minute job. |

### The two gaps nothing has measured

1. **Is the wall the gender HEAD or the TRUNK?** Finding 46 killed the
   linear probe as a veto but never asked whether a *retrained* head
   beats the shipped one. If the head is the wall it is ~4KB of weights
   in the same forward pass. If the trunk is, no head work can ever help.
2. **How often does BlazeFace fire on something that is not a person?**
   Findings 35, 38 and 45 each flag this in the same words: every junk
   number is *conditional on detection*, and the corpus holds only crops
   the detector already fired on. **His loudest complaint -- "randomly
   just blur some text" -- lives entirely in this gap.** 19.1% and 7.6%
   are lower bounds on an unknown base rate.

### The scoring defect this plan fixes

Every arm from here is scored **per race on FairFace, judged on the
WORST group**, never on the mean and never on his corpus alone. A change
that improves the average while Indian and Black women stay where they
are is a failure, and the corpus cannot see the difference.

---

## 2. WHAT WAS BUILT TODAY, BEFORE THE PLAN

- **The full FairFace validation split is extracted**: 10,954 labelled
  faces out of `val025.parquet`, which has been sitting on this disk
  while every FairFace figure was measured on the 1,400 in `sample/`.
  That 13% sample was a CPU-era decision (0.15 crops/s = a night per
  pass). Labels read from the parquet's own metadata and cross-checked
  against `sample/` by MD5 of decoded pixels: **60 of 60 agree on race
  and gender**, so old and new rows are comparable and finding 31's
  labelling is confirmed sound.
  `bench/gpu/extract-fairface.py` -> `fairface/full/` + `full.json`.
- **`--pop=fairfull`** wired into `bench/gpu/run.mjs`, interleaved by
  (race,gender) so a `--limit` slice stays balanced.
- **`bench/head-ceiling.mjs`**, the probe for gap 1, with three arms
  (FairFace->corpus transfer, leave-one-video-out, and per-race held-out
  FairFace) and three controls that can fail.

**A defect caught in that bench, recorded because it would have produced
the wrong ruling:** the first version trained a fixed 60 epochs and
**overfit** -- 1,024 free parameters on 1,348 rows scored *worse* than 6
epochs. Read straight that says "the trunk is the wall" when it is a
training defect. Fixed with a validation split, early stopping and a
config sweep selected on the **training domain only**.

---

## 3. THE PHASES

### Phase 0 -- SHIP WHAT IS ALREADY PROVEN (grey)

Grey has been confirmed four separate times (39 FairFace z 4.16, 41 his
corpus z 5.56, 45 the image path, 47 re-measured on the GPU) and has not
shipped. It is the only measured change that improves accuracy **and**
reduces junk marks, and it costs nothing.

1. Descriptor-separability bench (finding 44's precondition) off the two
   banked descriptor sets. Ten minutes, no device.
2. One line after `cropAndResize` in `classifyFaceGenders`
   (`src/detector.js:825`), covering the video AND thumbnail paths.
3. Ship it the 1098 way: `GENDER_GREY` at 0, clamped [0,1], so the
   switch and the revert both travel over OTA.

**Gate:** descriptor separability at `MEM_SIM` 0.6 must not degrade.

### Phase 1 -- THE CEILING PROBE, PER RACE (gap 1) -- RUNNING

Banking descriptors for all 10,954 on the GPU (~7 min at 26 crops/s),
then `bench/head-ceiling.mjs --arm=race`.

- **Retrained head beats the shipped one on the WORST group** -> the head
  is the wall. Phase 3a.
- **It does not** -> the trunk destroyed the information. Every head idea
  dies here and Phase 3b is the only route.
- **Learning curve still climbing at 10,954 rows** -> the answer is
  "underpowered", not "trunk", and the next step is the 86k FairFace
  train split, not a conclusion.

### Phase 2 -- THE DETECTOR'S FALSE-FIRE RATE (gap 2)

His loudest complaint, never measured, cheap now.

Run the shipped detector over frames and thumbnails **with no people in
them** -- text cards, gaming and tech thumbnails, the ten corpus videos'
own title cards -- and count how often it reports a face. Until this
exists nobody knows whether the marks come from the model shrugging or
from the detector hallucinating, and those need opposite fixes.

### Phase 3 -- THE MODEL

**3a, if the head wins.** Retrain the gender head on FairFace real
labels, trunk frozen, with **scale augmentation**: each 224px portrait
degraded to 24/32/40/48/64/96/128/224 native px through the same path the
player produces, so one head covers his whole 34-192px band instead of
only clean portraits. ~4KB of weights, same forward pass, zero extra
inference, no licence question.

**3b, if the trunk wins.** Distil from a **better teacher** -- and this
is the correction to the 2026-09-04 handoff, which dismissed distillation
wholesale on the grounds that a student inherits its teacher's errors.
True when the teacher is faceres. Finding 31 already found a better one:

    dima806 ViT-base   93.4% FairFace gender   Apache-2.0, clean
    ours (faceres)     80.6%                   MIT, clean

A 13-point-better Apache-2.0 teacher and a CC BY 4.0 training set both
exist today. Distilling *that* into a small student is a global accuracy
fix, not a latency project. Finding 31 says so in its own words: *"the
DISTILLATION job got cheaper, not the shopping trip."*

**Blocked before either:** nothing small AND clean AND better exists off
the shelf (finding 31's table). Every big model beats us by 13+ points;
every small one is licence-poisoned.

### Phase 4 -- VERIFY, THEN SHIP

Per-race table on held-out FairFace, corpus at matched exposure, junk
marks on both paths, then the device.

---

## 4. ORDER, AND WHY

1. **Phase 0 (grey)** -- proven, free, helps both complaints, still not
   shipped. Highest value per unit of risk in the whole plan.
2. **Phase 1 (ceiling)** -- running; decides whether the cheap fix exists
   before anyone commits to the expensive one.
3. **Phase 2 (detector false fires)** -- unmeasured, aimed straight at
   his loudest complaint.
4. **Phase 3** -- whichever branch Phase 1 selects.

**Explicitly not doing:** mirror-averaging (7 women beyond grey for
1.4-1.6x of the gender inference, finding 47); per-race calibration
(refused on principle); any further descriptor/layer re-reading
(finding 46).
