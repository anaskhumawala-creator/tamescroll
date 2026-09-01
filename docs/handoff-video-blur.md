# Handoff — redo the in-video blur

Written 2026-09-01, end of loop 38, so the next session can start from a
cleared context. **The owner has asked for the in-video blur mechanism to
be redone.** He also said, in the same breath, that the THUMBNAIL blur is
fine. That sentence is the most useful thing in this document: it scopes
the rewrite to one half of the pipeline and it rules out a whole class of
suspects.

> "I like the thumbnail blur, but the in-video blur is just not there."
> — owner, 2026-09-01

> "the male should not be blurred, like the wrong gender should not be
> blurred. That is the simple idea and there should not be random blurred
> patches." — owner, the standing definition of done

---

## 0. What is NOT in scope

- **The image path.** Same models, same thresholds, and he is happy with
  it. Do not touch `handleImage`, the image drain, the queue, or
  `region-blur.mjs`'s image half. If a change would affect both, it needs
  a reason in writing.
- **The detector.** BlazeFace and faceres are exonerated on measurement
  (§2). Swapping models is not the first move and probably not the tenth.
- **The blur LOOK.** `video-region.mjs` `LOOK` is frozen by owner ruling:
  featherFrac 0, radiusPx 8, blurFrac 0.09, blurMaxPx 72. Nine "low
  quality" reports came from accuracy rounds moving geometry under
  cosmetic dials. A round that needs to change it must change the test
  that quotes him.
- **Patch shape.** SOLID, always. Never cut, split, window or
  silhouette-tighten a patch. He has rejected both forms, twice each. A
  cleared person inside someone else's patch gets covered; fix that
  upstream, never by cutting a hole.

---

## 1. The two sections

The work splits at a hard boundary, and doing them out of order is how
the last three attempts failed.

### Section 1 — BUILD THE INSTRUMENT (no product code)

**You cannot redo a decision layer that has no way to be scored, and
right now there is none for video.**

Every threshold in `gender-verdict.mjs` was calibrated on THUMBNAILS —
full-quality still JPEGs, faces detected at 150–230px. His player decodes
**640x360** and faces reach faceres at **px p50 38–62**. There is no
video-path calibration anywhere in this repo below **px 90**. So today
every number in the verdict layer is being applied to a population it was
never measured on, and that is the actual root cause of the last month.

Deliverable: a **banked, labelled corpus of real video frames from his own
regime**, and a scorer that replays the decision layer over it offline.

Requirements, each of which is a trap something already fell into:

1. **Frames, not reads.** The read rings bank `{g,s,a,px,ab,v,pc,fc,nm}`
   and NO BOX and NO PIXELS, so nothing offline can re-run a decision or
   ask whether two reads are the same subject. Bank the crop.
2. **His pixel path, not a downscale.** `app/gaze/bench/nm-floor.mjs` and
   `clear-vs-size.mjs` degrade a 200px thumbnail detection. That isolates
   RESOLUTION and bypasses detection quality and source quality — which
   is exactly why a clean face at 32px reads fine there and his 40px face
   does not. Frames must come from a decoded video element at 640x360.
3. **Labels from a human, once.** Each face: person / not-a-person, and
   if a person, the gender. Bank it beside the crop. This is the thing
   the repo has never had and every round has substituted a proxy for.
4. **Score BOTH errors, always, on every run.** A number that reports
   only one is how "the gate catches 96% of non-faces" got published
   without "and refuses a real face forever" beside it:
   - **EXPOSURE** — a person the owner asked to cover is sharp. Severest.
   - **PHANTOM** — a patch with no person under it. His "random blur".
   - **FALSE COVER** — the wrong gender covered. His oldest complaint.
5. **Score over TIME, not per read.** The unit he experiences is
   "seconds of a person sharp" and "patches per minute", not per-read
   accuracy. A per-read score cannot see the tracker at all, and the
   tracker is where all three of this month's exposures lived.

Section 1 ends when a source change can be scored offline in seconds,
with no device and no emulator.

### Section 2 — REBUILD THE DECISION LAYER

Only after §1. The decision layer is `gender-verdict.mjs` (per-read),
`person-track.mjs` (per-track), and the observation assembly in
`init-entry.js`. That is where every failure this month has been.

The design question to answer FIRST, with the §1 instrument, before
writing anything:

> Given reads this weak, is a per-frame verdict the right architecture at
> all — or should the video path decide per SUBJECT over a window, and
> hold the patch while it decides?

Both known alternatives are already measured and REFUTED as
drop-in tweaks, and both refutations are on this repo's own data:

- **Track pooling** (`bench/pool-vs-single.mjs`): weighted-logit pooling
  over 386 male subjects **rescues 4 men and loses 75**. Two-consecutive-
  over-the-bar is a max-like operator and beats a mean when one weak read
  lands in a strong track.
- **Lowering the clear bar** (`bench/clear-bar-roc.mjs`): 0.60 → 0.40
  buys **80% → 89%** of real men for **2% more non-faces patched**.
  Temperature scaling is the SAME move — temperature is monotone in v.

They are refuted as tweaks. They are not refuted as parts of a different
architecture, and §1 is what would tell the difference.

---

## 2. What is measured and settled — do not re-derive

| Claim | Evidence |
|---|---|
| His device is fine | Adreno 610 reports HIGH_FLOAT precision 23 (true fp32) in BOTH shaders. `probe_glprec.py` |
| The model is fine on his phone | Fixed-input bench, 20 thumbnails, phone vs emulator: persons 25/25, maxKp p50 0.779/0.779, identical on all 20 |
| The corpus IS the video path | 15k banked reads under `spikes/gauntlet/runs` are video reads, so "wrong pixel path" is not the variable. `bench/path-split-mine.mjs` |
| Resolution alone does not explain it | vw 600 clears 96% of men, vw 1920 clears 55%. It is per-SUBJECT: `H14bBuluwB8` reads p50 0.635–0.670 and is 0% clearable at 854, 1280 AND 1920; `z86LGEFyQpo` clears 99.4%. `bench/res-vs-read.mjs` |
| Face SIZE does not explain it | Ground-truth faces degraded to 32–64px: men clear 7–8 of 9, label agrees 23–25 of 25, **0 certain-wrong at every size**. His phone at the same sizes: 48%. `bench/clear-vs-size.mjs` |
| So it is the SOURCE | 640x360 decode on a 4G link with 9.6 Mbps down and 1080p available. m.youtube picks quality from the 393px player box |
| 30% of his reads carry no signal | His phone, live, 90s, 300-entry ring: **89 of 300 are null reads**, each minting a patch. patchesP50 1, max 2 |
| `nm` separates them | descriptor magnitude before L2: p50 **12.66** on reads that clear, **2.88** on null reads. NOT the sigmoid restated — inside a narrow v slice the correlation with \|v-0.5\| collapses to −0.21..+0.30 |
| MoveNet admits nobody in his regime | all twelve slots n:0, every run, on his hardware. The face path carries the whole player blur |
| The emulator cannot verify any of this | 200s on a watch page under swiftshader: 22 samples, **0 reads, 0 passes**. Sixth occurrence |

**THE ONE BIG UNTRIED LEVER, AND IT IS HIS CALL.** Raising the stream
quality above 640x360. It is a page mutation beyond hide/blur/remove and
it spends his data, so it needs his word — but every measurement above
points at it and no architecture change can make a compressed 40px face
sharper.

---

## 3. The traps, in the order they will bite

1. **`npx tauri android build` does NOT build the gaze bundle.**
   `gaze-page.js` is `include_str!`d into the Rust lib, so an APK built
   without `node app/gaze/build/build.js` first carries the PREVIOUS
   bundle and the change is silently absent. Use
   `spikes/gauntlet/bx86.sh` / `barm.sh`, which now do it. This nearly
   shipped the reverted tracker as 1079.
2. **Verify constants in the EMITTED BUNDLE, never the source.**
   `FACE_MIN_NATIVE_PX` once shipped dead for six rounds as `var IY;`.
   The floor emits as `Cfe=5`. Check the packaged `.so`/dex too — the
   offline screen was confirmed in `classes7.dex`, not merely in the
   Kotlin.
3. **A test that cannot fail is worse than no test.** Four separate
   rounds shipped one. The last: `indexOf(a) < indexOf(b)` is TRUE when
   the first term is −1, so it passed with the whole gate DELETED.
   **Run every new behaviour test against the pre-fix source and confirm
   it fails**, and say so in the commit.
4. **Restart the emulator before believing any failure or timing
   number.** Sixth occurrence. `-no-snapshot-load`, then re-`adb forward`
   to the NEW `webview_devtools_remote_<pid>`.
5. **Use `$ANDROID_HOME/platform-tools/adb.exe` (37.x).** The `adb` on
   PATH is a stray 28.0.3 with no `mdns`.
6. **Never render feed content on his monitor.** Headless emulator or
   JSON-only probes. Delete evidence screenshots he did not ask for.
7. **A counter nobody has seen fire is a claim.** Check it rose in a real
   run before quoting it.
8. **`player.life` reaches the report as a shape-checked pass-through**,
   but a new counter still has to be *named* somewhere to be readable.

---

## 4. State at handoff

- **1079 is PUBLISHED** (sha `b0ebc3d7`; raw manifest, GitHub asset and
  the downloaded APK all agree, `isDraft` false). His phone was on 1078
  and he has been told to update.
- **1079 carries:** the bounded null-mint hold (a null read mints on its
  SECOND sighting, never its first) and the offline screen.
- **Reverted tonight, deliberately:** the UNBOUNDED null-mint refusal. It
  was an exposure — a track dies on coast expiry or a cut, coming back
  needs a birth, and the tag is a property of CONTENT so the refusal was
  permanent. 40 tagged passes after a death left 0 tracks where one
  untagged pass covered her. Third build of that gate to ship an
  exposure.
- **Retracted tonight, mine:** "floor 6 would have refused a real woman
  five times" is FALSE. All five refused reads are one MAN
  (`RcGyVTAoXEU`). The woman in the band reads nm 9.93/11.48 and is
  untouched until floor 10. The in-band evidence is 7 reads from TWO
  faces, and the arms OVERLAP there (faces min 5.11, non-faces max 6.66).
- **UNVERIFIED ON HIS DEVICE:** the bounded hold. `nullDropped` never
  fired on the emulator. The number that decides whether it works is
  **`nullDropped` against `nullMintedHeld`** in a 90s read on his phone —
  it says whether the hold is killing graphics or merely delaying
  everybody by one pass.
- His phone needs **Wireless debugging** on (not just USB debugging) to
  be reachable; only the old M2010J19SI advertises on mdns today.
- gaze 447/447, cargo 59/59.

---

## 5. The first three things to do

1. Ask him the stream-quality question (640x360 → 720p). It is the
   largest lever, it is his call, and §1's corpus should be banked at
   whatever he decides — otherwise the instrument is calibrated on a
   resolution he is about to leave.
2. Get 90 seconds of his phone with 1079 on it and read `nullDropped`
   vs `nullMintedHeld`. That is the only outstanding measurement from
   tonight and it is cheap.
3. Then Section 1. Not before.

---

## §3 — WHY THE MAN IS BLURRED. IT IS NOT THE MODELS. (2026-09-01, loop 40)

The owner ordered a better model twice. The measurements below say the
models are not the constraint, and they are recorded here because the
next round will otherwise spend a night swapping one.

Everything is scored on the 10-video / 18-window / 3,465-read corpus in
his own regime (man mode, verdict cadence 1.5s, scene gate on).

### The gender model is right about his men

`app/gaze/bench/man-clear.mjs`, 1,410 faces this corpus labels MAN:

| | n | share |
|---|---|---|
| reads the WRONG gender | **5** | **0.4%** |
| reads male, under the clear bar | 177 | 12.6% |
| reads male AND clears the bar | **1228** | **87.1%** |

male raw v p05/p50/p95 = **0.663 / 0.864 / 0.991**. Replacing faceres
can recover at most the 13% tail, and 0.4% of that is actual misgender.

### And the verdict layer mostly lets them through

`app/gaze/bench/veto.mjs` runs every shipped gate over the same faces
and charges each to the FIRST that would reject it:

| veto | n | share |
|---|---|---|
| **survives everything -- should clear him** | **1023** | **72.6%** |
| FACE_MIN_NATIVE_PX 40 (abstains, fails closed) | 249 | 17.7% |
| null read (band + age) | 71 | 5.0% |
| under the clear bar | 51 | 3.6% |
| nm floor | 11 | 0.8% |
| reads FEMALE | 5 | 0.4% |

### So the clear reaches the verdict layer and not the screen

`app/gaze/bench/lost-clears.mjs`, all time a MAN is covered:

| what the pipeline already knew about him | | |
|---|---|---|
| no read yet -- cadence, correct, blur-first | 36.0s | 15% |
| a weak read | 40.5s | 17% |
| **had a CLEAR-CERTAIN read** | **164.5s** | **68%** |

and of that 164.5s: a scene cut wiped it in only **8.5s (4%)**; **156.0s
(65%)** had no cut at all. The clear was **0-3 seconds old** in 116.0s of
it -- fresh, not coasted.

### Every lever that changes geometry or thresholds moves ~1 second

| change | exposure | false cover | phantom |
|---|---|---|---|
| 1081 shipped | 82.0s | 241.0s | 142.5s |
| CLEAR_STREAK_N 2 -> 1 | 83.5s | **230.0s** | 141.5s |
| coco-ssd measured body, pad .045 | 40.0s* | 40.5s* | 37.0s* |
| coco-ssd measured body, pad .30 | 34.5s* | 40.5s* | 34.5s* |

\* the ssd rows are the 5-window subset the bank had reached, not
comparable to the full-corpus rows above -- but *within* that subset a
**sevenfold change in patch area moved FALSE COVER by 1.0s**, from 40.5s
to 40.5s. A quantity that ignores patch area is not a patch problem.

FACE_MIN_NATIVE_PX could not be priced here at all: the corpus banks a
read for every face regardless of px, so the floor never fires in
replay. The 17.7% above is a property of the SHIPPED path. Pricing it
needs a device A/B or a re-bank that records the abstain.

### What is left: the covering track flaps

`app/gaze/bench/churn.mjs`, over the 482 frames a MAN is covered:

- covering track state: **blurred 482, other 0**
- **covering-id CHANGES 260, distinct ids 163**
- frames one id keeps covering him: **p50 1, p90 3, max 9**

So the track that covers him is replaced about every pass, and a track
is born blurred. A clear that has to survive two passes on one track
cannot -- which is exactly why CLEAR_STREAK_N 1 recovered only 4.5% and
why no threshold below it matters.

### Honest limits on the above

- The ABSORBED / OWN split (55.5s / 23% vs 174.5s / 72%) uses "the patch
  is CENTRED on him" as provenance, because `newTrack` builds its box as
  a literal and no faceBox rides the track. With the synthetic body at
  **p50 0.696 of frame width**, two people 0.15 apart both read as
  centred, so that split is a WEAK proxy and must not be quoted as a
  measurement. Bench-only `id`/`state` provenance is now emitted on
  patches so the next round can attribute properly.
- 5 of 18 windows have coco-ssd boxes banked. The geometry comparison
  (synthetic width p50 0.696 -> ssd 0.495, narrower in 61 of 69 pairs)
  is real; the SCORE on that subset is preliminary.

### The lead, and what it is not

The next round is the tracker, not a model. Specifically: why one
subject's coverage passes through 163 track ids, and whether an
identity that already read clear-certain can carry across a re-birth
(the descriptor memory already exists and already stores earned clear
states -- it is not consulted at birth).

## §4 — coco-ssd IS BETTER GEOMETRY AND IT IS NOT SHIPPABLE YET (loop 40)

Full corpus, 18 of 18 windows, his regime, on top of 1082:

| arm | exposure | false cover | phantom | measured/faces |
|---|---|---|---|---|
| 1082 | 82.0s | 218.0s | 142.0s | 0/1153 |
| + coco-ssd @0.35 pad .15 | **89.5s** | 217.5s | **87.0s** | 1071/1153 |
| + coco-ssd @0.20 pad .25 | 96.0s | 215.5s | **82.0s** | 1100/1153 |

**The phantom win is real and it is his "random blur marks".** Verified
against the obvious artifact -- an arm that simply draws fewer patches
would score better without covering anybody differently
(`bench/phantom-check.mjs`): patch count falls only 7% (1798 -> 1667)
and MEAN PATCH AREA RISES (0.372 -> 0.393), while patches landing on
nothing **halve, 229 -> 115**. Patches move onto people.

**The exposure cost is two windows out of eighteen** (`bench/
exp-where.mjs`): 8R1hy3uHds0_w1642 +5.0s and NWoT1ZVd1Lo_w702 +3.0s.
Thirteen windows improve on phantom; sixteen are zero or better on
exposure.

**And rendering the worst one settles what it is.** A classroom: the
synthetic body, 63% of frame width, was covering a girl seated to the
RIGHT of the subject entirely by accident. The measured box is correct
about the subject and stops covering her, and she has no patch of her
own. So coco-ssd does not CREATE exposure -- it removes an accident
that was hiding a recall hole.

That is why it does not ship yet, and the fix is not a wider box:

- **A minimum width in face widths makes exposure WORSE, not better**
  (2.5 -> 93.5s, 3.5 -> 101.0s, 4.5 -> 121.0s). Widening feeds the
  adjacency clamp more overlap with cleared faces and it pulls the edge
  back harder. Do not re-derive this.
- **Applying the measured box only beside a cleared face is worse
  still** (102.5s, and phantom recovers to 117s). Mixing box SOURCES
  frame to frame churns the tracker -- the same mechanism §3 measured,
  arriving from a different direction. A subject's box must come from
  one source for as long as it is that subject.
- Raising detector recall does not touch it (0.35 -> 0.20 moves
  measured 1071 -> 1100 and exposure 89.5 -> 92.5).

**NEXT, and it is a recall question rather than a geometry one:** the
people the fat patch was covering by accident need patches of their own.
Until they do, narrowing anything -- ssd or otherwise -- trades his
"random blur marks" for someone uncovered.
