# The accuracy + optimization run — one release, one roadmap

**His ask, verbatim:** *"There's a lot of optimization or I mean accuracy,
precision work to be done on the model... the thumbnails part and even in
the videos. If we can get this much nicer and done much nicer, it would be
much better."* Then: *"can you do both accuracy and optimization run
together?"*

**Answer to the second question, and it is the organising fact of this
plan: they are the same run.** `track-accuracy.md` §5 settles it with this
repo's own numbers — verdict interval 1.5s -> 0.5s is worth **19 seconds**
of man-mode exposure; a **perfect** gender model is worth **4.5 seconds**
of exposure and 68s of total error. Every point of dropped frames we
recover buys cadence, and cadence is worth more than a perfect classifier.
So performance work IS accuracy work here, and there is no sequencing
conflict to resolve.

## What the existing research already settled — do not re-derive

Read before touching anything:
`docs/research/distill-2026-09-03/track-accuracy.md` (the error taxonomy),
`docs/research/gender-lowres-2026-09-02.md` (the 38-62px survey),
`docs/research/wild-performance-2026-09-03.md` (the perf list),
`docs/engine-findings.md` §11 / §24 / §25.

1. **72-86% of scored error is the decision layer, not the model.** The
   oracle experiment: a perfect gender read moves man-mode total error
   491.5s -> 424.0s (-13.7%); adding a perfect face/non-face gate reaches
   396.0s (-19.4%). (`custom-model-2026-09-02.md` §3.)
2. **Phantom is 88% unclaimed patches.** A perfect model moves it 286.5 ->
   278.0s. Three percent. His "random blur marks" is a tracking problem.
3. **69% of false cover is a CORRECT read arriving late** — 115.0s of
   216.5s is male, has descriptor signal, is adult, clears the bar at score
   p50 0.71, and is covered anyway. His "Linus still gets covered" is a
   clock problem.
4. **The one crack in that ceiling is unmeasured:** 5.6% of person-instances
   (119 of 2,131) are seen by NEITHER model; p50 0.38 of frame height, a
   third of them women, worst run 7 seconds. The scorer is structurally
   blind to them. **Nobody has ever priced this in seconds.**
5. **M-10, the most expensive lesson in the file:** six loops blamed a model
   for what was the tfjs WebGL runtime on Adreno 610 (maxKp 0.033 on the
   device against 0.768-0.822 on four other runtimes, same frames). Measure
   the runtime before blaming the model.

## The gate that orders everything

**§6.2 first, because it is the only measurement that can CLOSE a question
rather than open one.** Extend `corpus-score.mjs` to charge EXPOSURE for a
banked person-instance with no read whose label says cover.

- man-mode exposure moves 7.5s -> **X**.
- **X < 20s** -> the model question is closed for good; every remaining
  accuracy day belongs to the decision layer and the clock.
- **X > 60s** -> a detector project is justified on measurement for the
  first time in this project's history.

Everything in Phase B below is gated on that number. Phase A and Phase C
are not.

---

## PHASE A — accuracy items that need no ruling and no new model

### A1. Price the detector-recall class in seconds  *(the gate, ~1 day)*

Everything is banked: `bank/ssd` has coco-ssd person boxes per frame,
`bench/detector-recall.mjs` already computes the 119 misses,
`corpus-score.mjs` already scores in seconds. Needs a missed-detection
class added to the scorer, and the gender of those 119 off the labels.

### A2. MoveNet stops getting a squashed frame  *(the largest unclaimed win)*

`detector.js:591` resizes 16:9 to 256x256 unconditionally. Measured on 241
frames through the shipping graph: **persons admitted 219 -> 269 (+22.8%)**,
53 frames admitting more against 11, and **35 frames where the squash
admits NOBODY and the letterbox admits someone** against 4 the reverse
(p < 1e-5), same direction in all five videos. Video-blocked bootstrap
p05 +8.7%, so it survives the clustering the frame-level test ignores.

Not done until now because MoveNet's outputs are normalized to its own
input: every keypoint and box needs mapping back through the pad before
`parsePersons` reads it, on the extent source the placement layer and the
whole corpus sit on. `PERSON_LETTERBOX` ships false (`detector.js:369`) and
the native Kotlin path has the same question. **This is a round, not an
edit** — and it is the direct fix for A1's miss class if A1 says the class
is real.

### A3. Thumbnail bars have never been calibrated  *(his "thumbnails part")*

`GENDER_IMAGE_MIN_SCORE` 0.4 (`gender-verdict.mjs:61`), `FACE_MIN_CONFIDENCE`
0.35 (`face-decode.mjs:31`), `IMAGE_MIN_SIZE` 120 (`init-entry.js:355`) —
none measured against ground truth at real thumbnail resolution. The video
path got `isNullRead` plus the `nm` floor; the image path got a null-read
guard only in loop 42. Build the same two-arm ground-truth harness that
priced `NULL_MINT_NM_FLOOR` (`bench/nm-floor.mjs`: real faces against
corner crops where BlazeFace found nothing), at thumbnail sizes, and move
the bars on the curve instead of on a guess.

### A4. The free swaps, scored through the unchanged protocol  *(1 day each)*

No training, no dataset licence, no maintenance obligation. In this order:

- **BlazeFace full-range** (1.0MB, Apache/Apache) — the untried variant of
  the model we already ship. Its own model card warns the short-range
  version is for faces within 2 metres, which is M-3 exactly.
- **YuNet** (MIT/MIT) — the only permissive detector with a disclosed
  WIDER-hard score (0.708-0.7503); BlazeFace publishes none.
- **face-api.js `age_gender_model`** (420KB against faceres' 6.98MB, MIT
  code, public-domain weights) — might pay for itself in bundle size alone.

Protocol is §4d in full: re-run over the 3,465 banked crops, replay
`corpus-score.mjs` **unchanged**, all three errors, both modes, sliced by
px, against the oracle arm, with the 7 bad woman clusters reported
separately. **A swap scored on one error is a regression waiting to ship** —
in woman mode a perfect model makes exposure WORSE (7.0 -> 9.5s).

---

## PHASE B — model work, gated on A1

Only if A1 returns X > 60s.

### B1. Teacher-ensemble kill-shot  *(2 days, desktop only)*

CLIP (MIT/MIT), MiVOLO v1 (Apache/Apache), SigLIP2 (Apache/Apache) over the
3,465 crops already on disk, scored against the 107 human cluster labels,
sliced by px. **If the ensemble does not beat faceres on the 7 woman
clusters below 50%, no student distilled from it can, and the model
programme ends on two days of desktop compute.**

### B2. The student

20.5 engineering days plus training, plus a permanent maintenance
obligation (a training pipeline, a data-provenance record, a
reproducibility burden, a re-training duty every time the input
distribution moves). Not in this run. Recorded so the ordering is explicit.

---

## PHASE C — optimization, which is the same as accuracy

### C1. `BLUR_IN_FRAME: 1` over OTA  *(0 days, needs one repeat run)*

2.22% dropped against 3.34% control on the GPU engine, n=1. Repeat, then
push. No install.

### C2. Single-frame crops  *(design already written)*

`docs/superpowers/plans/2026-09-03-native-single-frame-crops.md`. One frame
upload per verdict, crops cut in Kotlin, srcRect echo as the parity check.
The gain is READBACKS not bytes: 5 x ~20ms p50 -> 1. Predicted verdict
355 -> 275-300ms **on top of** the MoveNet split. Direct cadence, so direct
accuracy.

### C3. Fullscreen arm in the auto test  *(his report)*

*"I was feeling the full screen mode is a bit more laggy compared to the
normal viewing mode."* The auto test has never had a fullscreen arm, and
fullscreen changes both the presented resolution and the composite path.
Add the arm before believing or dismissing it.

### C4. Block-matching motion on the 16x16 luma grid  *(wild #16)*

The one row on the performance list that is an accuracy item: move coasting
patches by MEASURED displacement instead of a decayed velocity, using the
grid the scene gate already computes at 10Hz. Sub-millisecond. Attacks
phantom and between-verdict false cover — the 88% a model cannot reach.

---

## PHASE D — his rulings, none of which I take alone

| ruling | the trade | status |
|---|---|---|
| `PTRACK_MIN_COAST_PASSES` 2 -> 1.33 | -26% phantom (149.5s man / 185.0s woman), -18.5s / -7.5s false cover, for **+4.5s / +4.0s exposure** across 18 windows. Zero engineering days, zero extra inference, OTA, no install. **Highest ratio in the whole file.** | open since 2026-09-02 |
| Stream resolution above 640x360 | faces reach the gender model at **38-62px**; nothing here is calibrated below 90px. Biggest single accuracy lever available. **Spends his data**, and it is a page mutation beyond hide/blur/remove | never asked properly |
| `DELAY_MS` 1500 -> 0 or a middle value | he measured 0 himself: *"just turning off the blur delay to zero just made the YouTube video so much smoother."* Costs one verdict of latency on every entry. A 400-600ms middle has never been measured | open |
| Child gate by policy | `GENDER_CHILD_MASS` 0.25 orders our two reference faces backwards (a 21-year-old at 0.49-0.94, a known 12-year-old at 0.146-0.194); the literature wants ~32 for a 1% false-adult rate on minors. Costs adult men their clear | open |

---

## Order of work

1. **A1** — it gates Phase B and it is a day.
2. **C1** — a repeat run and an OTA push, no install, while A1's bench runs.
3. **A2** — the letterbox round.
4. **A3** — thumbnail bars.
5. **A4** — BlazeFace full-range first.
6. **C3, C4** — the two perf items that are also accuracy items.
7. **B1** only if A1 says so.

Every step ends with `corpus-score.mjs` unchanged, both modes, all three
errors, against the oracle arm. A win on one error is not a win.
