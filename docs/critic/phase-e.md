# Phase E adversarial critic — video-blur engine

- **Base ref:** `76b9ba6` (packet range `76b9ba6..a63df3b`, 14 commits, releases 1089 + 1090)
- **Packet:** `C:/Users/zvcla/AppData/Local/Temp/claude/Z--Apps-Disconnect/8ca5aa38-69f9-42ad-ba8b-6276ac45efc2/scratchpad/packetE3/`
- **Date:** 2026-09-02
- **Repo HEAD when the report was written:** `4636720` — FIVE commits past the packet.
  `fa3ba17` flips `PTRACK_ASSIGN` `greedy -> optimal`, which moves every corpus number;
  `c24f221` re-reads the IOU ladder under it; `6623d38` / `0e234ce` re-read the coast and
  CUT_DELTA. Two of those commits independently reproduce part of what is filed below.
  Every finding states whether it survives at HEAD.

Everything marked **EXECUTED** was run. Nothing else was.
Mutation testing was done on a repo-shaped copy under the scratchpad; the repo itself was
not written to except for this file. The phone was not touched.

---

## FINDINGS

### E1 — DEAD-CHECK — the new cadence guard's only call site is untested (EXECUTED — still open at HEAD)

**WHERE** `app/gaze/test/cadence-pinned.test.mjs` (whole file) against
`app/gaze/bench/arch-arms.mjs:466`

**CLAIM** The test imports `warnDerivedCadence` and calls it directly; it never calls
`makeArms`. Deleting the guard's only call site —
`if (typeof o.fixedCadence !== 'number') warnDerivedCadence(told);` — leaves the suite
green, so the property the change exists for ("any arm that does not pin a cadence says
so, loudly") has no check. `grep -rn makeArms app/gaze/test/` returns one comment and no
call.

**FALSIFIER** Copy the tree, delete `bench/arch-arms.mjs:466`, run
`node --test test/cadence-pinned.test.mjs`. **Executed: 2/2 pass with the call site
deleted.** The check that would fail: build an arm via `makeArms(mod)({hold:true})` with
no `fixedCadence`, capture stderr, assert `CADENCE NOT PINNED` fires — and assert it does
NOT fire when `hisRegimeOpts` is passed.

**COST** Not seconds of exposure. It is the defect class that produced four published
tables of which three REVERSED. The guard is the repo's answer to that, and it can be
removed by an unrelated refactor without a red test.

---

### E2 — DEAD-CHECK — the "no four-argument squash" guard matches one spelling (EXECUTED — still open at HEAD)

**WHERE** `app/gaze/test/crop-geometry.test.mjs:176`

**CLAIM** The guard is
`(src.match(/drawImage\(video, 0, 0, detector\.INPUT_SIZE/g) || []).length === 0`.
Reintroducing the identical defect spelled
`ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);` — which is how the sibling
image-path defect of 2026-08-28 was actually written — leaves all 15 tests green: `fitBox(`
still appears (the call remains, its result unused) and `fillRect` is untouched. The
class-level guarantee the comment claims is not held.

**FALSIFIER** Copy the tree, replace `init-entry.js`'s
`ctx2d.drawImage(video, fit.dx, fit.dy, fit.dw, fit.dh);` with the `canvas.width` spelling,
run `node --test test/crop-geometry.test.mjs`. **Executed: 15/15 pass with the frame
squashing again.** The check that would fail: assert that between `fillRect(` and
`getImageData(` there is exactly one `drawImage` and that it takes nine arguments — or
assert on the EMITTED bundle rather than on source.

**COST** The squash returns on the ONLY path Reddit, X, Instagram and Facebook have, and
the suite says nothing. 16a prices that at 17 of 18 faces losing descriptor signal and
2 of 13 solid-signal faces flipping gender label.

---

### E3 — EXPOSURE — the letterbox blinds three frames the squash saw; 16a's "the frame boolean moved once, in the harmless direction" does not survive N=241 (EXECUTED — open)

**WHERE** `docs/engine-findings.md` §16a *HONEST LIMITS*; `app/gaze/src/init-entry.js:4370-4383`

**CLAIM** 16a rests on 15 frames. Re-run on the SAME 241-frame set 16b uses, both arms
through the shipped `detectFaceBoxes`:

| | squash (pre-1089) | letterbox (1089) |
|---|---|---|
| detections | 372 | 396 |
| **frames with NO detection** | **0** | **3** |
| detections lost by the letterbox | — | 33 (**26 of them, 79%, under 64px native**) |
| detections gained | — | 57 |

The change is net positive on detections and I am not arguing it should be reverted. But
the frame-blind direction is **one-way and no longer zero**, and 16a asserts it is zero. A
frame with no detections cannot flag whatever the gender read would have said:
`wholeFrameFlagged` returns false, `cleanStreak++`, and four such samples reach
`clearEl(video)`. The mechanism is arithmetic — the letterbox gives a 640x360 face `0.4x`
on both axes where the squash gave `0.4 x 0.711`, so a 40px native face is 16px tall in
the tensor instead of 28px, and the losses concentrate in exactly his 38-64px band.

**FALSIFIER** The arm is saved at `<scratchpad>/repo1/app/gaze/bench/blaze-aspect.mjs`;
run it from a bench dir with `N=241`. Or re-run 16a's own `stretch-arm.js` over 241 frames
instead of 15 and read `flagManA`/`flagManB` — the claim is falsified if no frame goes
`1 -> 0`.

**COST** On the four platforms where this is the only evidence, ~1.2% of sampled frames
lose it. At 500ms sampling and a 4-sample clean streak that is not an immediate reveal, but
it is the direction 16a says cannot happen. HONEST LIMIT OF MY OWN ARM: it does not run the
gender read, so a lost DETECTION is not automatically an uncovered person — 16a's three
lost detections were all null reads. A blind FRAME is a different quantity, and it is
gender-independent.

---

### E4 — DEAD-CHECK — `iou-where.mjs`, the instrument that justified 1090, now compares 0.15 against 0.15 and reports zero everywhere (EXECUTED — **still open at HEAD**)

**WHERE** `app/gaze/bench/iou-where.mjs:24` — `const CAND = Number(process.env.IOU || 0.15);`

**CLAIM** `SHIPPED` is read out of the built bundle; `CAND` is hardcoded 0.15. The moment
0.15 shipped, the bench became a self-comparison. At HEAD it prints:

```
PTRACK_IOU_MIN 0.15 -> 0.15   k=3  told 2000ms
-- man --    TOTAL +0.0 +0.0 +0.0   windows whose EXPOSURE moved at all: 0 of 18
-- woman --  TOTAL +0.0 +0.0 +0.0   windows whose EXPOSURE moved at all: 0 of 18
```

A reader re-running the file that decided 1090 sees "this dial costs nothing anywhere".
That is the shape this repo files under *"a probe that measures nothing reads exactly like
a clean one"* (loop 37d) and *"a flat sweep is a claim about the instrument"* (loop 40).

**FALSIFIER** `cd app/gaze/bench && node iou-where.mjs` — **executed, all zeros**. Then
`IOU=0.20 node iou-where.mjs`, which recovers the published trace exactly with the sign
inverted. The fix is one line: default `CAND` to something that is not `SHIPPED`, or throw
when they are equal.

**NOTE** `iou-ab.mjs` had the same defect in the packet (`[SHIPPED, 0.15, 0.10, 0.05, 0.02]`
— duplicate control row, nothing above the shipped value). **`c24f221` fixed that half
post-packet**; `iou-where.mjs` was not touched and is still self-comparing.

**COST** No exposure today. The next session re-runs the trace that priced 1090, reads
three columns of zeros, and concludes the association dial is free.

---

### E5 — WRONG-NUMBER — the association dial was only ever swept BELOW the shipped value, and the unswept direction is the one that REDUCES exposure (EXECUTED — **independently confirmed post-packet; residual open**)

**WHERE** `app/gaze/src/person-track.mjs:26-61`; `app/gaze/src/tuning.mjs`
(`PTRACK_IOU_MIN: [0.10, 0.35, ...]`); `docs/engine-findings.md` §10g

**CLAIM** In the packet, both source comments present the dial as one-sided — *"THE FLOOR
IS 0.10 AND IT IS AN EXPOSURE FLOOR"*, the monotone ladder quoted only downward
(0.20/0.15/0.10/0.05/0.02), the ceiling of 0.35 described only as a valve "if his rings
show re-association going wrong". Nobody had measured above the shipped value. Swept
upward on the packet baseline, both arms:

| IOU_MIN | man exp / fc / phantom | woman exp / fc / phantom |
|---|---|---|
| **0.15 SHIPPED (1090)** | **23.0 / 139.0 / 561.0** | **24.5 / 200.5 / 663.0** |
| 0.20 (pre-1090) | 22.0 / 155.0 / 573.5 | 25.5 / 201.0 / 679.5 |
| 0.25 | 18.5 / 157.5 / 586.0 | 22.5 / 201.5 / 699.0 |
| 0.30 | 16.5 / 165.5 / 590.0 | 22.5 / 205.5 / 711.5 |
| **0.35 (OTA ceiling)** | **16.0 / 174.0 / 621.5** | **21.0 / 211.5 / 731.0** |

Exposure is monotone across the WHOLE range, not just below the shipped point: **1090
shipped the dial to the worst exposure setting reachable over OTA**, 23.0s against 16.0s
at the ceiling. The trade is real (phantom +60.5s man) and preferring phantom is
defensible; the FRAMING was not, and nothing in the packet said the dial had a better
exposure point at all.

Related, same section: *"the exposure NETS TO ZERO across the two arms"* averages man
`+1.0` against woman `-1.0`. His setting is **man**. In man mode 1090 is strictly `+1.0s`.

**STATUS AT HEAD** `c24f221` re-swept both directions under the optimal assignment and
reproduces the direction exactly (man 22.5 -> 21.5 -> 19.5 -> **17.0** at 0.30; woman
25.5 -> 23.0 -> 21.5 -> **20.0**), and its message withdraws the nets-to-zero sentence.
**Residual, still open:** the ladder stops at 0.30 and never reaches the OTA ceiling 0.35;
`iou-where.mjs` is still self-comparing (E4); and the one-sided "exposure floor" comment in
`person-track.mjs` is unchanged, so shipped source still describes a dial whose measured
exposure optimum is at the opposite end.

**FALSIFIER** `GENDER=man node iou-ab.mjs` at HEAD reproduces the upward half; add 0.35 to
`LADDER` to close the residual. **Executed on the packet baseline; the table above is the
output.**

**COST** If his rings say phantom is tolerable, ~5-7s of man exposure across 18 windows is
available over OTA with no install — and the packet's source comments tell the next session
that direction is a risk rather than a lever.

---

### E6 — WRONG-NUMBER — three different "shipped baseline" control triples are in circulation, and the published self-check does not reproduce (EXECUTED — open)

**WHERE** `CLAUDE.md`; `app/gaze/bench/arch-arms.mjs:99`;
`app/gaze/src/person-track.mjs:36`; `app/gaze/src/person-track.mjs:1668`

**CLAIM** CLAUDE.md publishes the regime self-check as *"its control row must read man
23.0 / 139.0 / 561.0 ... Five independent benches now land on those triples."*
`arch-arms.mjs`'s own docstring — the first place a bench author looks — and the coast
table in shipped `person-track.mjs` still read the pre-1090 **22.0 / 155.0 / 573.5**. And
at repo HEAD the correct triple is neither: **22.5 / 136.5 / 547.5**.

So a bench author checking a CORRECT arm against the published self-check concludes it is
in the wrong regime — which is exactly the diagnosis the self-check was invented to enable.

**FALSIFIER** Run any two of `iou-ab.mjs` (control row), `coast-ab.mjs 2`, `cut-sweep.mjs`
(row 60). **Executed: all three read 22.5 / 136.5 / 547.5 at HEAD and 23.0 / 139.0 / 561.0
at the packet HEAD.** Neither equals the triple in shipped source. The fix is to make the
self-check a derivative that declares what it was derived from — an assignment mode and a
version code beside the numbers.

**COST** The instrument's own staleness detector is stale.

---

### E7 — WRONG-NUMBER — §10h's CUT_DELTA table was measured at `PTRACK_IOU_MIN` 0.20 and every row moved when 1090 shipped (EXECUTED — superseded at HEAD, was wrong in the packet)

**WHERE** `docs/engine-findings.md` §10h (line 2551); `spikes/gauntlet/cut-sweep-hisregime.txt`

**CLAIM** The raw was banked before 1090; §10h quotes it as current and asserts *"Both
control rows land on the shipped triple (man 22.0 / 155.0 / 573.5)"*. Re-run, man:

| CUT_DELTA | §10h published | packet HEAD |
|---|---|---|
| 35 | 14.0 / 180.5 / 976.5 | 15.0 / 174.5 / 950.5 |
| 50 | 16.5 / 156.0 / 660.0 | 16.5 / 154.5 / 624.5 |
| **60 SHIPPED** | 22.0 / 155.0 / 573.5 | **23.0 / 139.0 / 561.0** |
| 75 | 25.5 / 141.0 / 476.5 | 26.5 / 133.0 / 475.5 |
| 90 | 27.0 / 141.5 / 470.0 | 28.5 / 133.5 / 471.0 |

The load-bearing sentence — *"60 -> 75 buys 97.0s of man phantom and **14.0s** of false
cover for +3.5s of exposure — the best ratio in the table"* — is, at the configuration that
shipped, **85.5s of phantom and 6.0s of false cover**. The false-cover half is overstated
by 133%. Directions hold and 75's refusal rests on his device luma p95 (54.9), not on the
corpus, so the CONCLUSION survives; the pricing does not.

**FALSIFIER** `GENDER=man node cut-sweep.mjs`. **Executed; the right-hand column is the
output.** `0e234ce` re-derives this post-packet.

**COST** `CUT_DELTA` is OTA-tunable with a ceiling of exactly 75. In the packet, the only
table anyone would price a push against was wrong in every cell.

---

### E8 — WRONG-NUMBER — the coast table in SHIPPED SOURCE, which prices the owner's one open decision, is still on the superseded baseline at HEAD (EXECUTED — **open**)

**WHERE** `app/gaze/src/person-track.mjs:1668`

**CLAIM** That table's `2 SHIP 4000ms` row reads `22.0 / 155.0 / 573.5` — pre-1090. It is
the table behind the handoff's single open question ("1.33 buys 26% of the phantom for
~4.5s more exposure") and behind a dial that can travel over OTA today. Re-derived, man:

| passes | coast | published | packet HEAD |
|---|---|---|---|
| 1.0 | 2000ms | 38.0 / 134.0 / 365.0 | 39.5 / 127.0 / 352.0 |
| **1.33** | 2660ms | 26.5 / 136.5 / 424.0 | **27.5 / 126.0 / 406.5** |
| 1.5 | 3000ms | 25.5 / 140.5 / 488.5 | 26.5 / 130.0 / 463.0 |
| **2 SHIPPED** | 4000ms | 22.0 / 155.0 / 573.5 | **22.5 / 136.5 / 547.5** |

**The trade survives and that is worth stating plainly**: `2 -> 1.33` now buys **141.0s of
phantom (-25.8%) for +5.0s of exposure**, against the published 149.5s for +4.5s. Same
size, same sign, same recommendation. What is wrong is that the table a reader would quote
to him is wrong in every cell and nothing marks it — and `6623d38` ("the coast dial re-read
under the optimal assignment") landed post-packet **without updating line 1668**, so a
commit that explicitly re-read this dial left the stale table in shipped source.

**FALSIFIER** `GENDER=man node coast-ab.mjs 1.0,1.33,1.5,2,3`. **Executed; the right-hand
column is the output.** Then `sed -n '1660,1675p' app/gaze/src/person-track.mjs` — still
22.0 / 155.0 / 573.5 at HEAD.

**COST** None to protection. It is the number he is being asked to rule on, so it should be
the number the code says.

---

### E9 — WRONG-NUMBER — §10g's own conclusion contradicts the binary that shipped, in all three clauses (EXECUTED against the 1090 APK — **open at HEAD**)

**WHERE** `docs/engine-findings.md:2544`

**CLAIM** The section documenting the 1090 change ends:

> `PTRACK_IOU_MIN` is **not on the OTA whitelist** (`src/tuning.mjs`), so unlike the coast
> dial this cannot be tried on his phone without a release. ... Recorded at 0.15 as the
> candidate; shipped at 0.20.

All three clauses are false of what shipped. Verified inside the released APK
(`app-arm64-debug.apk`, sha256 `9d1483a2…`, which matches `updates/app-manifest.json` byte
for byte):

```
wv=.15                                 FOUND   the constant, live-read at 3 sites
PTRACK_IOU_MIN:[.1,.35,function(t)     FOUND   the OTA whitelist entry
"PTRACK_IOU_MIN": 0.15                 FOUND   the embedded tuning.json
```

**FALSIFIER** `unzip -p <apk> lib/arm64-v8a/libapp_lib.so | grep -a PTRACK_IOU_MIN` and
`grep -o 'wv=[0-9.]*' app/src-tauri/gaze-page.js`. **Executed; output above.**

**COST** This is the constitution. A session reading §10g will believe the shipped value is
0.20 and that the dial cannot travel — and will therefore not use the one lever that can
roll 1090 back, or push it toward E5's optimum, without an install he has said he does not
want.

---

### E10 — SCOPE — the range appends a second `10g` and a second `10h`, colliding with existing sections, one of which the ledger records as retracted (EXECUTED — open)

**WHERE** `docs/engine-findings.md` — `### 10g.` at 606 and `## 10g.` at 2489;
`### 10h.` at 664 and `## 10h.` at 2551. Cited as bare "10g" from
`app/gaze/src/person-track.mjs:29`, `app/gaze/src/tuning.mjs`, `app/gaze/bench/iou-ab.mjs`.

**CLAIM** `docs/critic/ledger.md` row A1 resolves as *"10g retracted wholesale"* — that is
the line-606 section. Shipped source now cites "findings 10g" for a live exposure-relevant
constant. A reader following either citation lands on the wrong one, and the older is
retracted. Both 10h's are about CUT_DELTA, which makes them maximally confusable.

**FALSIFIER** `grep -n '^#\{2,4\} *1[0-9][a-z]\?\.' docs/engine-findings.md`. **Executed:
10g and 10h each appear twice; no other id does.**

**COST** No exposure. It defeats every cross-reference this range added to source comments,
in a document whose whole value is that a citation resolves.

---

### E11 — WRONG-NUMBER — the constitution now says both "75 is the next step, one OTA push" and "75 is REFUSED" (EXECUTED — open)

**WHERE** `docs/engine-findings.md:648` against §10h at 2551

**CLAIM** The older text reads *"75 is the next step if his rings say phantom did not move,
and that is one OTA push, not a release."* The new §10h refuses 75 because his motion p95
is 54.9 and a gate at 75 starts missing real cuts. Same dial, same document, opposite
instructions, neither annotated against the other. The older passage also still quotes
corpus numbers ("man exposure 71.0 -> 67.0 ... births 310 -> 270") from the pre-regime-fix
instrument, unbannered, in a section that survived the retraction sweep.

**FALSIFIER** `grep -n "75 is the next step" -B4 -A2 docs/engine-findings.md` and compare
against §10h. **Executed.**

**COST** `CUT_DELTA` is OTA-tunable with a ceiling of exactly 75. A session following the
older sentence pushes it; §10h's argument is that doing so costs real cuts, and a missed
cut is loop 39's traced mechanism for this corpus's single largest exposure.

---

### E12 — WRONG-NUMBER — §16c quotes geometry from the pass it declares worthless, and the committed probe cannot produce the census it quotes (reasoned + source-read, not executed on a device)

**WHERE** `docs/engine-findings.md:2423-2437`; `spikes/gauntlet/probe_player_hosts.py`

**CLAIM** Two problems, both structural.

1. Three paragraphs above a HONEST-LIMITS bullet stating *"every width and rect in that pass
   is worthless"*, the section says `shreddit-media-ui` is **"sized exactly to the video
   box"**. That is a rect claim from the locked-screen pass, and it is the load-bearing half
   of "the model is already in that root".
2. The committed probe **cannot produce that observation**. `chain(v)` walks `parentNode`
   upward; `shreddit-media-ui` is a SIBLING inside the shadow root, never an ancestor. The
   claim *"the shadow root's children are exactly `video`, `shreddit-media-ui`, two `slot`s
   and our own style"* likewise needs the root's children enumerated, which the probe never
   does. No `probe_player_hosts` output is committed anywhere.

The parts that ARE reproducible from the committed probe — `closest()` null, `inShadowRoot
1`, `video.parentElement === null`, the ancestor chain's computed styles — are sound and are
what the conclusion actually needs.

**FALSIFIER** Read the probe's `JS` block: it emits `nVideos`, `movie`, and per-video
`chain(v)` only. Re-run on `/r/aww/` with the screen unlocked and confirm it never prints
`shreddit-media-ui`. To get the claim it needs `[...v.getRootNode().children]`.

**COST** No exposure. The Reddit architecture round is specified against an observation not
in evidence, which 16c's own honest-limits bullet already forbids trusting.

---

### E13 — NIT — `stretch-arm.js`'s two parity claims are both false in the same way (EXECUTED — source read)

**WHERE** `app/gaze/bench/stretch-arm.js:71-79` (*"ARM A: exactly the shipped line"*,
*"this arm IS init-entry's whole-frame path"*)

**CLAIM** Both arms set `g.imageSmoothingQuality = 'high'`. `init-entry.js` sets no
smoothing quality anywhere (`grep -n imageSmoothing app/gaze/src/init-entry.js` → no hits)
and prefers `OffscreenCanvas`; the shipped path also draws from a `<video>`, not a decoded
PNG `<img>`. The confound is common to both arms so the DIRECTION of 16a is safe — but the
letterbox reduces 360 -> 144 vertically (2.5x) where the squash reduced 360 -> 256 (1.4x),
and Chrome's default filter aliases far harder at 2.5x than the 'high' filter the bench
used, so the absolute `nm` magnitudes are not the shipped ones.

**FALSIFIER** Re-run `stretch-arm.js` with both `imageSmoothingQuality` lines removed and
compare the sign test (published 17 of 18, p = 1.45e-4) and the `NULL_MINT_NM_FLOOR`
crossings.

**COST** No exposure. "Verified R15-style against the shipping functions" is one step weaker
than stated, on the change that reaches four platforms.

---

### E14 — NIT — 16a says four faces cross `NULL_MINT_NM_FLOOR`; the banked raw has three (EXECUTED)

**WHERE** `docs/engine-findings.md` §16a, `app/gaze/src/crop-geometry.mjs:79`, `CLAUDE.md`;
raw `spikes/gauntlet/stretch-arms.json`

**CLAIM** `NULL_MINT_NM_FLOOR` is 5. Of the 18 matched pairs in the banked raw, exactly
**three** cross it: `2.68 -> 5.13`, `4.79 -> 5.59`, `4.97 -> 6.05`. Everything else in the
sentence checks out — 17 of 18 higher, sign test p = 1.450e-4, 2 of 13 solid-signal pairs
flip label, raw |diff| max 0.2236.

**FALSIFIER**
`python -c "import json;p=[x for f in json.load(open('spikes/gauntlet/stretch-arms.json'))['frames'] for x in f['pairs']];print(sum(1 for q in p if (q['A']['nm']<5)!=(q['B']['nm']<5)))"`
**Executed → 3.**

**COST** None. Filed because the sentence is copied into shipped source and the handoff, so
it propagates.

---

## CHECKED AND CLEAN

All EXECUTED.

- **C4 on the RELEASE artifact, not the tree.** `app-arm64-debug.apk` sha256
  `9d1483a291026fb0a98156456543bb407e3bea02a898045fb035ea558fae5aa4` — **matches
  `updates/app-manifest.json` exactly**. Inside `lib/arm64-v8a/libapp_lib.so`: `wv=.15`,
  `fillRect(0,0,un,un)` + `drawImage(R,wp.dx,wp.dy,wp.dw,wp.dh)`,
  `PTRACK_IOU_MIN:[.1,.35,function(t)`, `"PTRACK_IOU_MIN": 0.15`,
  `__TS_GAZE_BUNDLE__="8026164-dirty"`. Nothing shipped dead.
- **The constant is READ, not merely emitted.** `wv` appears at three live sites — the
  association test `!(m<wv)`, the null-mint held-box test `>=wv`, the birth classifier
  `u[c]<wv` — and `setIouMin` writes the same binding (`function yX(t){wv=t}`).
- **Only two four-argument square `drawImage`s remain and both are the ones claimed.**
  `drawImage(R,0,0,Ia,Ia)` is the luma scene gate (a delta between two identically squashed
  frames — aspect cancels) and `drawImage(R,0,0,Sa,Sa)` is the MoveNet canvas fallback
  (16b's declared open question). Confirmed by reading surrounding minified context.
- **Nothing downstream reads a box out of the letterboxed buffer.** `wholeFrameFlagged`
  (`init-entry.js:1920`) returns one boolean on both the worker and in-page branches; gender
  crops come from the same 256 buffer, so `squareBox` now squares in true aspect. The
  init-entry comment is accurate.
- **The canvas is 256x256 and the bars are painted before the draw.** `ensureVideoCanvas()`
  sizes to `detector.INPUT_SIZE`; emitted order is
  `fitBox -> fillStyle -> fillRect -> drawImage -> getImageData`.
- **The OTA channel is still numbers-only.** `rules/tuning.json` sha256 matches
  `rules/manifest.json` (LF-normalised and raw agree). `lib.rs` hands it over via
  `serde_json::to_string(...)` and the Rust test asserts `__TS_GAZE_TUNING__ = "` and
  rejects `= {`.
- **The tuning.json == shipped-constants pin covers the new key.** `test/tuning.test.mjs`
  adds `PTRACK_IOU_MIN` to `SHIPPED`, and the completeness loop asserts every
  `tunableNames()` entry appears in BOTH the file and the map — so this dial cannot silently
  revert on his device when an OTA lands. Clamp behaviour tested at both edges.
- **The per-window trace reproduces exactly.** `IOU=0.20 node iou-where.mjs`: man exposure
  moves in 2 of 18 windows (`4u3jS_cTHH0_w252`, `8R1hy3uHds0_w1052`, ±0.5s each) against
  -9.5s of false cover in a single window. Every number §10g publishes for the per-window
  trace is right, and the "trace it per window rather than quoting a total" method is the
  right answer to the exposure question it asks.
- **16b's headline stats reproduce from its own raw.** admitted 219 -> 269 (+22.8%), blind
  67 -> 36, 35 vs 4 blind-flips, 53 vs 11 frames admitting more, per-video blind split
  12/3, 5/1, 2/0, 9/0, 7/0 — one-way in all five videos.
- **16a's descriptor result reproduces from its raw.** 18 pairs, 17 of 18 higher
  undistorted, sign test p = 1.450e-4, 2 of 13 solid-signal pairs flip label (one
  `raw 0.601 -> 0.377`), raw |diff| max 0.2236. The three detections the letterbox misses in
  THAT run are all null reads (nm 2.28 / 3.28 / 3.40). The honest limit is the sample size,
  which is E3.
- **Version lockstep.** `appupdate.rs` 1090, `tauri.properties` 1090, `tauri.conf.json`
  0.1.90, `updates/app-manifest.json` 1090.
- **Test suites.** `node --test` 548/548 at HEAD; `cargo test` 60/60 in the packet.
- **The `.cache` freshness guard works.** `_build.mjs` threw *"was stale — src/ has changed
  since it was built"* on my first bench run and refused to report a number. It fired in the
  scratch copy too. A bench cannot silently score an old bundle.
- **`iou-ab.mjs`'s phase-D fixes are real.** `readConst`/`patchConsts` by NAME (the literal
  `/var PTRACK_IOU_MIN = 0\.2;/` would have thrown at HEAD), the absolute-path
  `writeFileSync`/`import()` fix, and the shared `thinFrames` — all exercised by my runs from
  two different working directories.
- **§9 owner-rules walk.** Patches SOLID: nothing in the range touches patch geometry,
  splitting or masking. BLOCK-ONLY: no page mutation added. Blur-first: the IOU change is
  association-only and its null-mint effect is monotone toward covering; the fitBox change is
  caveated in E3. Code-never-over-OTA: clean. Emitted-bundle verification: done on the APK.
- **C7 counters.** No new counter names in the range; nothing rebased by a rename.
  `birthNearMiss` is defined as `bestIou < PTRACK_IOU_MIN`, so its MEANING now moves with an
  OTA push — noted, not filed, because the definition is internally consistent and no prior
  reading is quoted as a fixed constant.
- **C8 scope.** Nothing under `.env*`, `**/auth/**`, `**/payment*/**`, `**/migrations/**`,
  `*.sql`, `.github/workflows/**`, `src-tauri/capabilities/**`, and no filename containing
  key/secret/token/credential. Tree clean at HEAD.
- **C11 stale harness.** No number in the range other than E12's two 16c claims depends on
  the locked-screen pass. Both corpus benches are offline replays and touch no device.

---

## C13 — PRE-MORTEM: he installs 1090 and says it is worse

1. **"It blurs the wrong person / the blur jumps between people."** Ranked first because
   1090 LOOSENED association by 25%. `PTRACK_IOU_MIN` 0.15 lets an observation land on a
   track that is not its person; when that track is a man's CLEARED one, she goes sharp —
   10g's own conceded mechanism. Counter: `birthNearMiss` (67 -> 42 on the packet corpus,
   43 at HEAD) read against `birthCleared` in `player.life`; file
   `app/gaze/src/person-track.mjs:696`. **Needs no install:** push `rules/tuning.json` with
   `PTRACK_IOU_MIN` at 0.20 — or toward 0.30, which the HEAD ladder measures at 5.5s better
   on man exposure than what shipped.
2. **"Some videos never blur now"** — Reddit / X / Instagram / Facebook, or a YouTube feed
   preview. E3: the letterbox blinds 3 of 241 frames where the squash blinded none, and 79%
   of the detections it loses are under 64px. On those platforms `wholeFrameFlagged` is the
   only evidence, and four clean samples call `clearEl`. File
   `app/gaze/src/init-entry.js:4376-4383`; **there is no counter on that branch**, which is
   the actual problem — add one before diagnosing.
3. **"More random blur marks."** 1090 loosened the null-mint hold, which uses the same
   threshold (`person-track.mjs:808`): a tagged null read now matches its held box more
   easily and mints on the second sighting where it previously did not. Counters
   `nullDropped` and `nullMintedHeld` already reach the report. Corpus says phantom FELL, so
   this ranks third — but the corpus is not his footage, and phantom is the complaint he
   repeats most.
