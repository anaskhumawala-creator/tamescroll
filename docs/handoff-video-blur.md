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
