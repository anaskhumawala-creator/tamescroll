# Phase L critic — presented geometry, the head floor, coasting hulls, the hindsight rules (commit 9cc6cb8 against 9e0b6af)

Six claims attacked, nine findings, most severe first. Everything below was
RUN, never argued: the shipped source imported directly (never a copy of a
rule), the pre-change source extracted with `git archive 9e0b6af app/gaze/src`
into a scratch dir outside the repo, the banked device run
`spikes/gauntlet/events-linus55c.json` (Redmi, 1094, NWoT1ZVd1Lo seek 55,
180s, 323 snapshots / 245 reads / 40 cuts), and `npm test` in `app/gaze`
(**725/725 green, nothing in the repo edited**).

Three of the round's numbers were attacked and **survive**: the replay
summary reproduces byte for byte (`{"raw":31,"shipped":21,"headFloor":10,"headFloorStale":6}`),
"83 of 255 blurred track-passes were coasting, p50 946ms" reproduces exactly,
and the "4 of the 10 sat under a neighbour coasting 306-427ms" claim survives
re-running the replay with the hull and head DISPLACED the way 9cc6cb8
actually ships them (see L8).

**Rule 6 was attacked on the banked run for the exposure the brief named and
NOTHING WAS FOUND**: 4 dead runs / 8 dead track-passes / 4.97s of presented
time, and **zero** opposite-gender (female, man mode) reads land inside any
dead run's box within 2s of it, and **zero** non-touching new blurred tracks
are born within 0.15 of a dead run's centre in its expiry snapshot. The
detector-miss-then-re-mint exposure the brief asked about does not occur in
this run. Its cut-crossing sibling does — L5.

| id | date | trigger | severity | claim | falsifier | verdict | note | artifact |
|---|---|---|---|---|---|---|---|---|
| L1 | 2026-09-02 | phase-l (2) | EXPOSURE | **A merged patch covers TWO subjects and the head floor is ONE of their heads, so the clamp can shave the edge past the other subject's hull and into her own head box.** `person-track.mjs:2812` (`mergeTracks`, `head: head.head \|\| null`) picks the merged head by `mergedHead` — the larger `headW`, or, when only one track has a head, that one. `reclampMerged` then hands it to `clampPatchOffFaces` as the X floor for a union that also contains a subject whose head is somewhere else entirely. The R27 invariant the same file states 40 lines above — "the patch after the clamp still contains every pixel the models actually reported for this subject" — is false for every merged patch. Fixture A (`scratchpad/merge_head3.mjs`): P blurred, hull 0.32-0.88, **no head anchor**; Q blurred, contained in P, head 0.628-0.772; a cleared man, face 0.32-0.44, centre 0.38 INSIDE P's hull. `blurredTracks` returns one merged patch with **x1 = 0.44** where 9e0b6af returns **x1 = 0.276** — 0.164 of frame width removed, 0.12 of it P's own measured hull, on a subject the head floor has no head for. Fixture B (`scratchpad/order2.mjs`): P blurred with a small head 0.324-0.396 (the bank's p05 blurred head-box width is 0.046), Q blurred with a bigger head, cleared face 0.24-0.36. `blurredTracks` returns **x1 = 0.36 — INSIDE P's own head box** — where 9e0b6af returns 0.32, outside it. "Never inside the head" holds only for an unmerged track. | Run both fixtures against `app/gaze/src/person-track.mjs` and against `git archive 9e0b6af app/gaze/src`. Pre-change: 0.276 / 0.32. Shipped: 0.44 / 0.36. | OPEN | Frequency in his own footage: **26 blurred pairs would pass `overlaps` (IoU>=0.5 or containment>=0.6) in 180s, 6 of them with a cleared face centre inside the union**, and **19 of 243 blurred track-passes carry no head box at all** (`hf: null`) — the fixture-A shape. It reaches the birth-backdate branch too: `padBoxTowardBirth` widens the box and the presentation re-clamp pulls it back to the same floor. Cheapest bound that keeps the round's win: floor a merged clamp at `max(unionCore.x1, min(head.x1 over every merged member))`, or refuse the head floor on a merged entry and keep the per-track clamp's result. | `scratchpad/merge_head3.mjs`, `scratchpad/order2.mjs`, `events-linus55c.json` |
| L2 | 2026-09-02 | phase-l (1) | EXPOSURE | **`mergePresented` drops `headX`/`headW`, so on the presentation path `mergedHead` always returns the FIRST entry: the presented merged geometry is ORDER-DEPENDENT and differs from what the render path draws.** `person-track.mjs:2600` builds merge inputs as `{key, box, core, head, vx, vy, vw, vh}` — no `headX`, no `headW`. `mergedHead(a,b)` tests exactly those two fields, so `aOk` and `bOk` are both false on every presented merge and it falls through to `return a`. The list order is whatever `boxesAt` emitted (A's tracks in snapshot order, then B-only births) and that array reorders as tracks are born and dropped — the same square wave `sortFaces` was added in this very commit to remove, reintroduced one function later. It also falsifies the round's headline claim that a presented patch is what `blurredTracks` would have drawn. Fixture (`scratchpad/order2.mjs`): render `x1 = 0.36`; presented `[P,Q,M]` `x1 = 0.324`; presented `[Q,P,M]` `x1 = 0.36`. Fixture A of L1: render 0.44, presented 0.276. | `node scratchpad/order2.mjs` — three numbers, two of them from the same tracks in a different array order. | OPEN | The direction is not uniformly toward exposure (in fixture A the presented path is the SAFER one), which is worse than a consistent bias: the two paths disagree, and the delay path is the one on screen whenever `DELAY_MS > 0`. The fix is one line — carry `headX`/`headW`/`headY`/`headH` into the `entries.push` in `mergePresented` — but fix L1 first, or that line makes the presented path adopt the exposure. | `app/gaze/src/person-track.mjs:2600`, `scratchpad/order2.mjs` |
| L3 | 2026-09-02 | phase-l (2) | EXPOSURE | **The head floor is not "a shoulder or arm": on his own device data the head box is 0.305 of the hull's width at p50, so the X edge may now cross ~70% of the subject's measured extent, and nothing bounds it by her own body.** Over the 243 blurred track-passes in `events-linus55c`, `hf` width / `co` width reads **p05 0.153, p50 0.305, p95 0.503**; the narrowest banked blurred head box is **0.016** of frame width, and `person-gate.mjs` floors `headW` at **0.04** whenever no ear span, eye gap or shoulder span is computable — so the floor can be a 4.8%-wide strip round a keypoint mean that is itself biased toward the visible side of a profile head. Device instance, snapshot **lm 229.43, track 40** (a blurred track whose `lv` is `uncertain` — never read as either gender, covered fail-closed): padded patch x1 **0.29004**, hull **0.318-0.639**, own head box **0.507-0.595**, cleared track 39's face **0.300-0.424**, centre 0.362 INSIDE her hull. The R27 rule moves nothing (x1 stays 0.29004 — the face centre is inside the hull, so no X candidate is even generated); the head floor moves it to **0.424**: 0.134 of frame width, of which **0.106 is her own evidence hull — 33% of its width**. | `node scratchpad/t40.mjs` prints both arms off the banked geometry. Sweep: `hf`/`co` width ratio over every blurred track-pass in the file. | OPEN | This is the round's stated trade, so it is filed for a RULING rather than a revert — but the trade was written down as "shoulder or arm" and what it actually buys is a third of the hull at p50 on a track that was never read either way. Two bounds that keep most of the win: cap the travel at a fraction of the gap between hull edge and head edge, or refuse the head as a floor at all when `headW` is at or near its 0.04 person-gate floor. | `events-linus55c.json` lm 229.43, `scratchpad/t40.mjs`, `person-gate.mjs` (`headW = Math.max(headW, 0.04)`) |
| L4 | 2026-09-02 | phase-l (4a/4b) | EXPOSURE | **Rule 3''s `flagCertain` guard is nearly inert, and ONE intervening uncertain read defeats it.** `flagCertainOf` reads `t.lastVerdict === 'flag-certain'`, and `lastVerdict` is rewritten by EVERY read including an uncertain or abstained one (`person-track.mjs:1633`) and re-seeded to `'uncertain'` by `demoteTracks` on every scene cut (`:2081`). Measured on `events-linus55c`: **208 of 243 blurred track-passes (85.6%) carry `lv != 'flag-certain'`** — `Counter({'uncertain': 202, 'flag-certain': 35, 'clear-certain': 6})` — so the guard exempts 14% of covered passes, not "wherever there was evidence for it", and with 40 cuts in 180s the first snapshot after every cut is unconditionally eligible. Device instance, track **id 12**: `lv` is `flag-certain` at lm 109.04, 109.64 and 110.21 (`fs: 1` — three consecutive certain opposite-gender reads); ONE uncertain read at **110.54** drops it to `uncertain`; 111.11 clears her. Rule 3' then presents the **567ms** interval (110.54, 111.11) as CLEARED although the last CERTAIN evidence, 330ms earlier, was a certain female read. All **7** blurred->cleared transitions in the run fire rule 3'; three of them span an interval containing a female read (110.54: female 0.19 and 0.32; 124.56: female 0.24; 222.56: female 0.23). | `python` over the file: count blurred passes by `lv`; then print id 12's `lv`/`fs` history over lm 108.7-111.2 and every read whose face centre falls inside its box. | OPEN | The rule is defensible; the KEY is not. `flagStreak` (`fs`) already rides the track, is already clamped at 2, survives an abstention by design ("the streak survives a certain flag OR an abstention"), and is exactly the "was there evidence for covering" question rule 3' is asking. `fs > 0 \|\| lv === 'flag-certain'` closes the id-12 case without touching the never-read population the rule was built for. | `events-linus55c.json` id 12, `person-track.mjs:1633`, `:2081`, `:2569` |
| L5 | 2026-09-02 | phase-l (4c) | EXPOSURE | **`markDeadCoasts` walks the coasting run backwards with no cut check, so a coasted patch in the PREVIOUS shot is retro-deleted on an expiry that happened in the NEXT one.** `track-timeline.mjs:145` guards only the last interval (`if (cutBetween(tl, prev.mediaTime, snap.mediaTime)) return;`); the walk-back at `:160` breaks only on a missing or non-coasting entry. Repro (`scratchpad/cutrun.mjs`): observation 10.0, coast 11.0, **cut 11.5**, coast 12.0, expiry 13.0 — the 11.0 entry (shot A, before the cut) comes back `dead = true` and both `boxesAt(tl, 11.0)` and `boxesAt(tl, 11.2)` return **0 tracks**. The existing test only covers the case where the expiry snapshot itself follows the cut, which the first guard already handles. | `node scratchpad/cutrun.mjs`; contrast with `timeline-hindsight.test.mjs` "a coasting run that ended at a cut is not dead". | OPEN | Measured cost on the banked run is small and I say so: **2 of the 4 dead runs contain a cut** (187.586 inside 187.55-188.62; 190.349 inside 190.32-192.32) but the cut lands 29-36ms into each, so ~65ms of pre-cut presented time is wrongly dropped. **9 coasting runs of >=2 passes span a cut** in the same 180s, so the fixture's half-second case is one shot-change away. Fix is three lines: stop the walk-back at a cut. | `scratchpad/cutrun.mjs`, `events-linus55c.json` |
| L6 | 2026-09-02 | phase-l (1) | EXPOSURE | **A cleared snapshot entry carries the RAW tracker box, and `boxesAt` can turn it into a patch — so "no presented patch is smaller than what `blurredTracks` would have drawn" is false, in the direction that uncovers hair.** `presentTracks` gives every `cleared` entry `box: t.box` (unpadded, unclamped) on the reasoning that a cleared entry is never a patch — true of `mergePresented`, false of `boxesAt`, which lerps a track cleared at A and blurred at B and presents it BLURRED with `lerpBox(ta.box, tb.box, frac)`. At small `frac` the presented patch is essentially the raw box. Repro (`scratchpad/lerp_raw.mjs`): one track, cleared at 10.0 and blurred at 11.0, box `[0.30,0.20,0.70,0.95]`. `blurredTracks` draws `y1 = 0.155`; the presented patch reads `y1 = 0.1955` at m=10.1 and `0.1775` at m=10.5. That is **4.0 points of frame height of crown and hair presented sharp** across the interval right after a track flips to blurred — the owner's 2026-08-27 report, on the transition where covering has just been decided. **9** cleared->blurred same-id transitions occur in `events-linus55c`. The mirror exists too: A blurred with `flagCertain`, B cleared, state stays blurred and the box lerps TOWARD the raw cleared box. | `node scratchpad/lerp_raw.mjs` — three presented boxes against `blurredTracks`. | OPEN | **Not a regression** — before this commit every presented box was raw, so this is strictly better than 1094. What is wrong is the claim. Fix: give a cleared entry the same padded geometry a blurred one gets (it is never drawn while it stays cleared, so nothing else moves), or pin `frac` to 1 whenever the A-side entry is cleared and the B-side is blurred. | `scratchpad/lerp_raw.mjs`, `person-track.mjs` `presentTracks`, `track-timeline.mjs` `boxesAt` |
| L7 | 2026-09-02 | phase-l (4c) | NIT | **Rule 6's docblock quotes the POPULATION where a reader will take it for the YIELD.** `track-timeline.mjs:139`: "Run 3 on the Redmi: 83 of 255 blurred track-passes were coasting, p50 946ms -- the phantom he reports", sitting inside `markDeadCoasts`. The number is exactly right (verified: 83 / 255, p50 946ms over all snapshots; 74 / 243 and p50 931ms with the first-tick backlog dropped, which is the replay's own convention). What the rule actually removes on that run is **4 runs, 8 track-passes, 4.97s of presented time — 9.6% of the coasting passes**. | Simulate `markDeadCoasts` over the file's snapshot list (`scratchpad/rule6.py`) and count `dead` entries. | OPEN | The plan's Task 3 acceptance is "device: presented coasting passes fall", which 8/83 does satisfy. Put the yield next to the population so the next round does not price the rule at 83. | `scratchpad/rule6.py`, `track-timeline.mjs:139` |
| L8 | 2026-09-02 | phase-l (3/5) | NIT | **The "4 of the 10" number is right, and it does not support the change it is quoted for.** Both the `coastStep` comment and the `clamp-coasting.test.mjs` header cite "4 of the 10 certain-male reads still covered after the head floor sat under a neighbour coasting 306-427ms" as the reason the hull and head are now SHIFTED by `dx/dy`. Re-running the replay with a fifth arm that displaces the banked (frozen, 1094) hull and head by the box's own displacement since its last fresh core — which is what 9cc6cb8 ships — gives **`headFloorShifted: 6`, identical to the frozen-hull arm's 6**, and the displacements on those very passes are **(0.004, -0.035)** at lm 186.02 and **(0.000, 0.000)** at lm 229.863. So all 4 reads are bought by `coastedCoreUsable` PERMITTING a stale hull; `shiftBox` buys 0 of 4. The velocity also damps 0.7 per pass, so displacement is geometrically bounded at ~2.33x the first step and a coast at the measured p50 of 946ms is frozen for most of its life — the hull is "exactly as current as the box" only in the sense that both are equally stale. | `node scratchpad/replay2.mjs` prints `{"n":31,"shipped":21,"headFloor":10,"headFloorStale":6,"headFloorShifted":6}` plus the per-read displacements. | OPEN | Nothing to revert — the shift is harmless and cheap. What needs correcting is the attribution in the shipped comment and in the test header, so the next round does not defend `shiftBox` with a number that never measured it. | `scratchpad/replay2.mjs`, `person-track.mjs` `coastStep`, `test/clamp-coasting.test.mjs` |
| L9 | 2026-09-02 | phase-l (6) | NIT | **No new test exercises the head floor on the merge path, which is why L1 and L2 shipped.** None of the five new files is vacuous — each fails against 9e0b6af (`clamp-head-floor` passes a 4th argument the old signature ignores; `clamp-coasting` asserts the hull moved with the box, which the old `coastStep` freezes; `timeline-hindsight` and `track-timeline-fields` exercise fields and branches the old `pushSnapshot`/`boxesAt` do not have; `presented-geometry` imports two symbols that do not exist there). The gap is coverage, not vacuity: `clamp-head-floor.test.mjs` only ever tests ONE track, and the `mergePresented` fixture in `presented-geometry.test.mjs` builds its three entries with `core` and **no `head` field at all**, so `reclampMerged` runs with `head === null` on every assertion and neither `mergedHead`'s head selection nor the dropped `headX` can be seen. | Add `head` to the two blurred entries in that fixture with the heads at opposite ends and re-run: the asserted `out[0].box.x1 === 0.48` moves. | OPEN | The round's own global constraint is "tests red-proved"; they were, against the wrong axis. A merged-two-subjects-plus-one-cleared-face case belongs in `clamp-head-floor.test.mjs`, red-proved against L1's fixture. | `app/gaze/test/presented-geometry.test.mjs`, `app/gaze/test/clamp-head-floor.test.mjs` |

---

## L1 — the merged patch's floor is the wrong person's head

`mergeTracks` unions two blurred entries and asks `mergedHead` for one head
box to carry on the union. `reclampMerged` then uses it as the X floor for a
rectangle covering both subjects.

Fixture A, printed by `scratchpad/merge_head3.mjs`:

```
his face        {"x1":0.32,"y1":0.298,"x2":0.44,"y2":0.502}
P head          null            (P: hull 0.32-0.88, no head anchor)
Q head          {"x1":0.628,"y1":0.38,"x2":0.772,"y2":0.62}
9cc6cb8  blurredTracks -> [{"key":"1+2","box":{"x1":0.44,  ...}}]
9e0b6af  blurredTracks -> [{"key":"1+2","box":{"x1":0.276, ...}}]
```

The 0.164 of frame width between those two numbers is the union's left
portion, and 0.12 of it is inside P's own `core`. Fixture B pushes the same
mechanism one step further — the merged floor is subject Q's head, so the
edge lands at 0.36, **inside P's head box 0.324-0.396**:

```
9cc6cb8  RENDER merged x1 = 0.36   (P head starts at 0.324 -> inside P's own head: true)
9e0b6af  RENDER merged x1 = 0.32   (outside it)
```

Frequency, from the banked device run (raw tracker boxes, so an upper bound —
the per-track clamp can separate a pair before the merge is reached):

```
blurred pairs that would merge: 26   of which with a cleared face inside the union: 6
blurred track-passes 243   without a head box 19
```

## L3 — how far the floor moved, in his own numbers

```
head-box width / hull width, 243 blurred track-passes:  p05 0.153  p50 0.305  p95 0.503
narrowest banked blurred head box: 0.016 of frame width
person-gate floor:                 headW = Math.max(headW, 0.04)
```

and the device instance, `scratchpad/t40.mjs` over snapshot lm 229.43:

```
padded patch       {"x1":0.29004,"y1":0.01928,"x2":0.66696,"y2":0.85748}
R27 hull floor     x1 = 0.29004      (no move: his face centre 0.362 is inside her hull)
head floor         x1 = 0.424        (0.106 of her own hull removed, 33% of its width)
her hull is 0.318..0.639
```

## L4 — the guard, and the single read that defeats it

Track id 12, `events-linus55c`, `lv` and `fs` per snapshot:

```
lm 109.04  st blurred  lv flag-certain  fs 1
lm 109.64  st blurred  lv flag-certain  fs 1
lm 110.21  st blurred  lv flag-certain  fs 1   mm 560
lm 110.54  st blurred  lv uncertain     fs 0   <- one uncertain read
lm 111.11  st cleared  lv clear-certain cs 1
```

Rule 3' asks `flagCertain` of the 110.54 snapshot, gets `false`, and presents
(110.54, 111.11) — 567ms — as cleared. Reads whose face centre falls inside
her box at 110.54: `female 0.19`, `male 0.85`, `female 0.32`.

Population, same file:

```
lv of blurred track-passes: {'uncertain': 202, 'flag-certain': 35, 'clear-certain': 6}
eligible for a hindsight clear (lv != flag-certain): 208 of 243  (85.6%)
```

## L5 — the dead run crosses the cut

`scratchpad/cutrun.mjs`:

```
m=10.5 presented tracks: 1     (rule 4's grace after the last observation)
m=11   presented tracks: 0
m=11.2 presented tracks: 0     <- shot A, BEFORE the cut at 11.5
m=12.5 presented tracks: 0
snapshot 11.0 (shot A, before the cut) dead = true
```

On the device run: dead runs 135.34-136.80, 148.41-148.85, 187.55-188.62
(cut at 187.586), 190.32-192.32 (cut at 190.349).

## L6 — a cleared entry's raw box becomes a patch

`scratchpad/lerp_raw.mjs`, same track cleared at 10.0 and blurred at 11.0:

```
m=10.1  {"x1":0.2984,"y1":0.19550,"x2":0.7016,"y2":0.953}
m=10.5  {"x1":0.292, "y1":0.17750,"x2":0.708, "y2":0.965}
m=10.9  {"x1":0.2856,"y1":0.15950,"x2":0.7144,"y2":0.977}
DRAWN (blurredTracks)  {"x1":0.284,"y1":0.15500,"x2":0.716,"y2":0.980}
RAW tracker box        {"x1":0.30, "y1":0.20,   "x2":0.70, "y2":0.95}
```

## What was attacked and NOT found

- **Rule 6 causing exposure on the banked run.** `markDeadCoasts` simulated
  exactly as written over the 279 post-first-tick snapshots: 4 dead runs
  (ids 17, 18, 28, 29), 8 dead track-passes, 4.97s of presented time. For
  each run's union box, **no** non-abstained female read (the opposite
  gender in man mode) has its centre inside it within the run window + 2s,
  and **no** new blurred track is born in the expiry snapshot with a
  non-touching box whose centre is within 0.15 of the dead run's. All four
  runs end `lv: uncertain` — fail-closed covers with no gender evidence
  either way, which is the honest residual risk, not a measured exposure.
  The `taken` guard does real work too: at id 18's expiry a blurred
  successor touches the dead box.
- **`coastStep` dropping `demoted`.** It carries `demoted: !!t.demoted`, so
  `coastedCoreUsable`'s `!t.demoted` cannot be bypassed by coasting a
  cut-demoted track. `clamp-coasting.test.mjs`'s third test covers it and is
  not vacuous.
- **`coastStep` dropping `lastVerdict`.** It carries
  `lastVerdict: t.lastVerdict || 'uncertain'`, so a coasting track whose last
  read was flag-certain keeps `flagCertain` true through the coast, as the
  brief asked me to verify. The hole is L4's, and it is an intervening READ,
  not a coast.
- **The replay's own numbers.** `node spikes/gauntlet/replay_clamp.mjs
  spikes/gauntlet/events-linus55c.json` reproduces
  `{"raw":31,"shipped":21,"staleCore":19,"headFloor":10,"headFloorStale":6,"n":31,"ownCleared":25}`.
  The join (reads to the NEXT snapshot, first collector tick dropped) is the
  same one `events_reclass.py` uses.
- **`shiftBox` clamping a coasted hull to `[0,1]` per edge.** It can make a
  hull degenerate at a frame edge, but `clampPatchOffFaces` returns the box
  untouched when `core.x2 <= core.x1`, so the clamp stands down rather than
  misfiring.
- **The overlay key.** `mergePresented` returns `id: merged[k].key`, i.e.
  `mergedKey`, and `video-region.mjs:1113` keys overlays by
  `String(live[q].id)` — stable while the same pair merges, exactly as on the
  render path. No node churn.
- **`countLife`.** `presentTracks` passes `false`, so the second
  `drawnTracks` call per pass does not double `clampFired` / `clampNoCore` /
  `clampNoLegalEdge`. Every clamp counter any earlier round quoted keeps its
  meaning.
- **`npm test` in `app/gaze`: 725 pass, 0 fail.** Nothing in the repo was
  edited; every fixture above lives in the session scratchpad.
