# Phase M critic — the loop-death fix, the pending-clear lookahead, the cut key, and the classifier that scored them (f3bf849..46dfe4e against f3bf849^)

Seven findings, most severe first. Everything below was **RUN**, never argued:
the shipped source imported directly (never a copy of a rule), the pre-change
classifier extracted with `git show 0e3305e:spikes/gauntlet/events_reclass.py`
into a scratch dir outside the repo, the four banked device runs
(`events-v1096c..f.json`, Redmi, NWoT1ZVd1Lo seek 55, 180s, man mode,
DELAY_MS 1500) **copied to scratch first** because `events_reclass.py` writes
its result back into the file it reads, and `npm test` in `app/gaze`
(**748/748 green, nothing in the repo edited, nothing run on the device**).

**Claim 6 SURVIVES.** All three symbols are read at their call sites in the
emitted `app/src-tauri/gaze-page.js`, not merely emitted:

```
FY(t){var e=yp.get(t);if(e){$t.raf++;try{...DY(e,performance.now())}catch{$t.repositionErrors++}finally{e.raf=requestAnimationFrame(...)}}}
if((s.mediaTime-e.mediaTime)*1e3>U0e||Sl(t,o.mediaTime,s.mediaTime))return r.state;      // U0e=3e3
function kl(){var ue=St?St.newestMediaTime():null;return typeof ue=="number"?Math.min($.currentTime,ue):$.currentTime}   ...   St&&f7(Wo,kl())
$t.timelineFallback++,Jk(t,t.tracks)                                                     // reconcileOverlays(entry, entry.tracks)
```

**The loop-alive claim SURVIVES, on an instrument that can see it.**
`stale_target.py` over the four runs: v1096c **staleFrac 0.9073** (163,377 of
180,073ms with the renderer's target frozen), v1096d **0.0**, v1096e
**0.0018** (one 328ms run), v1096f **0.0**. f3bf849 did what it says.

**Rule 3''s walk fires, and reaches further than one snapshot.** Replaying
`stateAt` over the banked snapshots with the correct `clearPending` predicate
(`state === 'blurred' && lastVerdict === 'clear-certain'`; `flagEvidence` is
false by construction whenever `lastVerdict` is `clear-certain`, both being
written in the same object literal at `person-track.mjs:1637-1644`):
pending entries **8 / 12 / 7** in d/e/f, resolved to cleared by the
one-snapshot rule **1 / 4 / 1** and by the walk **3 / 7 / 3**, reaching
**1.968s / 3 hops** at most (v1096d track 28, the round's own example).

| id | date | trigger | severity | claim | falsifier | verdict | note | artifact |
|---|---|---|---|---|---|---|---|---|
| M1 | 2026-09-02 | phase-m (1) | WRONG-NUMBER | **The exposure classifier never looks at the presented picture, and returns the same answer on the run whose renderer was dead for 90.7% of the wall clock as on the healthy ones.** `events_reclass.py`'s EXPOSURE block reads only snapshot arrival times (`arrival_pm = s["vt"] - delay`) against `s["lm"]`; `frames[].p` — the visible patches — is touched exactly once in the whole block, for the unrelated `lateFramesFrac`. Run it on `events-v1096c` (build 4, `stale_target.py` staleFrac **0.9073**, every patch parked where it stood) and it prints `exposureLowerMs {"nPositive": 0}`, `exposureUpperMs {"max": 0, "nOver300": 0}` — identical to v1096f. So "exposure nPositive 0 and upper max 0ms over 300ms windows in every run" is a statement about verdict-arrival timing, and is structurally incapable of reporting a frozen patch, a mispositioned patch, a subject never tracked, or a hindsight rule presenting a covered woman as cleared. | `python events_reclass.py events-v1096c.json` in a scratch copy, beside `python stale_target.py events-v1096c.json`. | OPEN | The FALSE COVER block is NOT blind this way — it joins to `frames[].p`, and `probe_events.py`'s `vis()` correctly skips `display:none` and sub-1px overlays, so the two historic blindness classes are handled there. The exposure metric needs the same join: an opposite-gender read with no presented patch containing its face box, over the frames at that media time. | `events_reclass.py:76-119`, `stale_target.py`, `events-v1096c.json` |
| M2 | 2026-09-02 | phase-m (1) | WRONG-NUMBER | **The false-cover series 23/87 -> 13/81 -> 14/82 -> 16/82 mixes two classifier versions, and the only run left on the old one is the baseline the improvement is measured from.** The `pc >= 0.25` and across-a-cut exclusions landed in 27e6595; v1096d and v1096e were re-scored with them (their in-file `reclass` blocks were rewritten), v1096c was not. Same instrument throughout: **OLD 23/87 -> 19/84 -> 17/85 -> 21/87**, **NEW 20/82 -> 13/81 -> 14/82 -> 16/82**. Under the old classifier the shipped build (f) is **worse** than both d and e; under the new one it is worse than d. The published first step (23 -> 13, ten rows) is ~4 rows of code and ~6 rows of instrument. | `git show 0e3305e:spikes/gauntlet/events_reclass.py` into scratch, run both versions over all four banked files; and read the `reclass` key already inside each committed json (`c: 23/87`, `d: 13/81`, `e: 14/82`, `f: 16/82`). | OPEN | Decomposed per exclusion (covered/population): `c` neither 23/87, pcOnly 20/82, cutOnly 23/87, both 20/82; `d` 19/84, 16/81, 16/84, 13/81; `e` 17/85, 15/82, 16/85, 14/82; `f` 21/87, 17/82, 20/87, 16/82. Re-score v1096c with the shipped classifier and quote one series, or quote both. | `spikes/gauntlet/events-v1096{c,d,e,f}.json` `reclass`, `events_reclass.py` |
| M3 | 2026-09-02 | phase-m (2) | EXPOSURE | **The round guarded `reposition` inside `loop()` and left the sibling call at `setTracks` unguarded — where a throw is fatal in exactly the way the round just fixed, and where `repositionErrors` cannot see it.** `video-region.mjs:1445` calls `reposition(entry, entry.at)` OUTSIDE any try, one line before `if (!entry.raf) loop(video)`. On a freshly created entry (`raf: 0`) a throw there propagates out of `setTracks`, the restart line is never reached, the render loop **never starts**, and every later verdict repeats the throw before reaching that line again. Reproduced (`scratchpad/m2repro.mjs`, the shipped module plus the repo's own DOM stub and a `boxesFn` that throws): `setTracks #1 threw`, rAF queued **0**; `setTracks #2 threw`, rAF queued **0**, `raf 0`, **`repositionErrors 0`**; only when the throw stops does the loop start. The counter added to detect this failure reads 0 through the whole outage. Not a rare path: `init-entry.js:4655` calls `videoRegion.clear(video)` on every pass with no blurred track (**118-120 of ~300 passes per run**), so the entry is re-created **13-19 times per 180s run**. | `node scratchpad/m2repro.mjs`. | OPEN | Additionally: `repositionErrors` is banked **nowhere**. `probe_events.py` copies `renderStats.timelineFallback` into each frame as `tf` and nothing else; it does not appear in any of the four `events-v1096*.json`. It DOES reach the diagnostics report (`diag-report.mjs:450` is a shape-checked pass-through of `__TS_GAZE_RENDER`), so the commit message is accurate there — but no device evidence in this round rests on it. Fix is one line: wrap the `setTracks` call the same way, count it, and reach the restart unconditionally. | `scratchpad/m2repro.mjs`, `video-region.mjs:1445`, `init-entry.js:4655`, `probe_events.py:90-91` |
| M4 | 2026-09-02 | phase-m (4) | EXPOSURE | **`cutMediaTime` fixes the clock-vs-ring skew and leaves the systematic one: the cut is still keyed at the gate SAMPLE, up to a full `GATE_INTERVAL_MS` after the frame that carried it.** `gateTick` runs at **100ms** (`init-entry.js:2379`) and compares this sample's luma grid against the previous sample's, so the true cut frame lies anywhere in the 100ms ending at the sample; `cutMediaTime()` keys it at `min(currentTime, newestRingFrame)` **at the sample**, i.e. up to ~100ms late. `cutBetween` tests that raw value, so up to 100ms (**3-4 presented frames at 30-40Hz**) of the NEW shot is still resolved against the OLD shot's snapshot by `boxesAt` rules 3/4 — carrying the old shot's `cleared` states onto whoever entered on the cut. The author's own classifier encodes this exact fact and compensates; `boxesAt` does not: `events_reclass.py:91-94` says *"the luma sampler records a cut up to ~0.15s AFTER the frame that carried it"* and floors with `c - 0.15`. Per run, **145-165 presented frames** fall in the 100ms-before-a-recorded-cut window (74-134 of them carrying a patch). | Sweep `frames[].pm` against `cuts[].vt` in each banked file for `c-0.100 < pm <= c`; read `GATE_INTERVAL_MS` and the `c - 0.15` constant side by side. | OPEN | The ordering question the brief asks — a cut keyed BEFORE a pre-cut verdict's frame — is **protected**: `newest <= currentTime` always, and a pass in flight when the gate fires is dropped by `passEpoch` (bumped at `init-entry.js:2466`, 34 lines after `pushCut`, with no `await` between), `passDropped` 23-79 per run. The residual is the ring-empty fallback (`passMediaTime = video.currentTime` at `:2293`/`:2346`) inside one displayed-frame interval, which I could not reach in the banked data. Remedy for the systematic half: key the cut at the PREVIOUS gate sample's frame time, or subtract `GATE_INTERVAL_MS`, so `cutBetween` errs toward the new shot. | `init-entry.js:2379`, `:2432`, `:2466`, `events_reclass.py:91-94`, all four banked files |
| M5 | 2026-09-02 | phase-m (5) | WRONG-NUMBER | **Claim 5 is a field mix-up: `cf` in the tracks ring is `coreFresh`, not `flagCertain`, and neither cited row is pinned by a certain flag at all.** `init-entry.js:4618` banks `cf: tk.coreFresh ? 1 : 0` (an R27 clamp input); the genuine `flagCertain` is banked as **`fc`**, and only inside `frames[].te` (`probe_events.py:75`). Reading the right field for v1096f: at the presented frames covering **pm 59.159 / 59.226 / 111.111** every timeline entry reads **`fc: 0`**, and the tracks-ring rows at lm 59.193 and 111.111 carry `fs: 0, lv: 'uncertain'` (id 6 also `f: 1`, a face-derived body never read either way). So rule 3''s `ta.flagCertain` guard is not what holds those intervals blurred, and the proposed "a weak flag does not pin (A,B]" option would not change either row. The read the claim rests on is real (`vt 57.277, g female, s 0.28, px 402, nm 11.68, pc 0.17`) but it is not what pinned them. | Print `frames[].te[].fc` for frames with `abs(pm - 59.193) < 0.06` and `abs(pm - 111.111) < 0.06` in `events-v1096f.json`. | OPEN | Two consequences. (1) **0.28 IS certain by this codebase's own definition**: the flag direction's bar is `f.score >= GENDER_MIN_SCORE` = **0.25** (`gender-verdict.mjs:806`), deliberately asymmetric to `GENDER_CLEAR_SCORE` 0.45 — the option imports the clear bar into the flag direction and would strip pinning from **20 of the 26** certain female flags in v1096f (scores 0.25-0.40). (2) The ambiguity is not hypothetical: my own first replay of the lookahead read the tracks-ring `cf` as `flagCertain` and reported it firing **0 / 1 / 0** times in d/e/f; corrected, it fires **3 / 7 / 3**. Rename one of the two, or bank `flagEvidence` explicitly. | `init-entry.js:4618`, `probe_events.py:75,88`, `events-v1096f.json`, `gender-verdict.mjs:806` |
| M6 | 2026-09-02 | phase-m (3) | NIT | **The lookahead's only continuity test is the track id, over a window ten times longer than the one it replaced.** `stateAt` walks up to `LOOKAHEAD_MS` **3000** past B and accepts C's `cleared` for B on id equality alone. Every intermediate snapshot may be a POSITION pass, which moves the track's box through `updatePersonTracks` (Hungarian, `PTRACK_IOU_MIN` **0.15**) without touching `lastVerdict` — that is exactly why the walk was needed — so a subject substituted into the id between B and C is invisible to it, and a MISSED cut inside the window (recall 92.8-95.9% at `CUT_DELTA` 60) now costs up to 3s of hindsight where it used to cost one snapshot. | Print `IoU(B.box, C.box)` for every chain the walk resolves in d/e/f. | OPEN | **NOT OBSERVED in this data, and I say so**: all 13 resolved chains hold IoU 0.686-1.000 end to end (v1096d id 28 `0.833 / 0.789 / 0.746`; v1096f id 36 `0.699 / 0.726 / 0.686`), reach at most 1.968s and 3 hops, and none crosses a recorded cut. A bound, not a measurement. Cheap remedy that keeps the whole measured win: an IoU floor per hop (every observed chain clears 0.68), or a hop bound of 3 instead of a 3s clock. | `track-timeline.mjs:204-233`, `assign.mjs`, `events-v1096{d,e,f}.json` |
| M7 | 2026-09-02 | phase-m (1) | NIT | **Both classifier exclusions are justified by shipped code, and the published figure is now a different quantity than its name.** `pc >= 0.25`: a read with `childP >= GENDER_CHILD_MASS` returns `{flagged: true, certain: false, abstained: true, childAbstain: true}` at `gender-verdict.mjs:751-762` and can never clear — those rows are the child gate working, not a defect. Across-a-cut: the app DEMOTES at a cut and `boxesAt`/`cutBetween` refuse to carry patches across one, so scoring a read against frames in the other shot is a wrong join. Both are right. What is wrong is the label: they remove **3-4** and **0-3** rows per run, and `gender-verdict.mjs:371-383` records that `GENDER_CHILD_MASS` orders this project's two reference faces **backwards** (a 21-year-old at childP 0.49-0.94, a known 12-year-old at 0.146-0.194) — the commit message itself says the excluded reads are "ages 21-23". Those are adult men the owner still sees covered. | The four-way decomposition in M2's note. | OPEN | Quote the number as "false cover on certain same-gender reads, excluding child-gated reads and cross-cut frames", with the excluded count beside it, so a future round cannot read a shrinking figure as a shrinking complaint. | `events_reclass.py:131,133,171`, `cover_source.py:57-59`, `gender-verdict.mjs:751-762`, `:371-392` |

---

## M1 — the exposure metric cannot see a dead renderer

`events_reclass.py`'s exposure block, in full, is arrival arithmetic:

```
arrival_pm = s["vt"] - delay
lower = max(0.0, arrival_pm - m0)
upper = max(0.0, arrival_pm - floor)      # floor = previous snapshot, or cut - 0.15
```

`frames` appears in the block once, as `lateFramesFrac`. The drawn picture —
`frames[].p`, which `probe_events.py` collects correctly from the DOM with a
`display:none` and a sub-1px guard — is never consulted.

The consequence is testable because the round banked the perfect control. In
`events-v1096c` the rAF loop was dead:

```
$ python stale_target.py events-v1096c.json
{"frames": 7491, "spanMs": 180073, "staleRuns": 129, "staleMs": 163377, "staleFrac": 0.9073, "longestMs": [10347, 11789, 13769]}
$ python stale_target.py events-v1096f.json
{"frames": 6879, "spanMs": 180107, "staleRuns": 0, "staleMs": 0, "staleFrac": 0.0, "longestMs": []}
```

and the exposure summary is the same on both:

```
c  EXPOSURE {... "exposureLowerMs": {"nPositive": 0, "values": []}, "exposureUpperMs": {"p50": 0, "p90": 0, "max": 0, "nOver300": 0} ...}
f  EXPOSURE {... "exposureLowerMs": {"nPositive": 0, "values": []}, "exposureUpperMs": {"p50": 0, "p90": 0, "max": 0, "nOver300": 0} ...}
```

The commit's own words for what v1096c looked like are *"every patch frozen at
its last position — covering whoever walked into it and following nobody"*.
`nPositive 0, max 0` is a true statement about the delay line's verdict
scheduling, and it is not evidence that nobody was sharp.

One caution for whoever builds the replacement: the naive join (a blurred
track's box against the patches at the same media time) reads **6.2%
uncovered on v1096c and 8.0% on v1096f** — the frozen run scores *better*,
because 90% of its frames carried a large stale patch. The join has to be to
the READS (an opposite-gender read with no patch over its face box), never to
the tracker's own boxes.

## M3 — the sibling call site

```
$ node scratchpad/m2repro.mjs
setTracks #1 threw   : boom from boxesAt
rAF callbacks queued : 0
setTracks #2 threw   : boom from boxesAt
rAF callbacks queued : 0 (0 = the render loop never started)
render raf counter   : 0
repositionErrors     : 0
after recovery, rAF  : 1  raf 1
```

The throw source in the repro is `boxesFn`, which in production is the closure
at `init-entry.js:1906` — `presenter.presentedMediaTime()`, `boxesAt`,
`latestSnapshot`, `mergePresented`. `mergePresented` is the phase-L
presentation re-merge and re-clamp, the newest geometry code in the player.
The round's whole premise is that an uncaught throw on this exact path really
happened on the device, so leaving the sibling call site bare is the same bet
twice.

The entry-creation path is hot, not exceptional — per 180s run:

```
       passes with no blurred track (clear -> entry torn down)   entry re-creations (setTracks on raf 0)
c                    120                                                    16
d                    120                                                    13
e                    118                                                    19
f                    120                                                    15
```

## M4 — the cut is 100ms wide and the timeline treats it as a point

```
init-entry.js:2379   var GATE_INTERVAL_MS = 100;
init-entry.js:2400   sceneState = sceneGate.classifyScene(meanAbsDelta(prevLuma, cur));
init-entry.js:2432   if (presenter) pushCut(timeline, cutMediaTime());
events_reclass.py:91 # (the luma sampler records a cut up to ~0.15s AFTER the frame that carried it)
events_reclass.py:94 if floor < c - 0.15 <= m0: floor = c - 0.15
```

`cutMediaTime()` removes the difference between the wall clock and the ring;
it cannot remove the 100ms the gate itself spans, because the gate only knows
that the delta between two samples fired. Frames in `(c - 0.100, c]`:

```
       recorded cuts   presented frames in the window   of those carrying a patch
c            41                     165                            134
d            42                     157                            100
e            42                     162                            122
f            41                     145                             74
```

That is ~2.2% of presented frames per run in which `cutBetween` says "old
shot" about a frame that may already be the new one — the direction that
carries a cleared state onto an entrant.

## M5 — `cf` is `coreFresh`

```
init-entry.js:4614   // R27 directional margin: the clamp's three inputs.
init-entry.js:4618   cf: tk.coreFresh ? 1 : 0,
probe_events.py:75   te = ... {id, st, b, co, hd, fa, hw, fc: e.flagCertain ? 1 : 0}
probe_events.py:88   tr = ... {id, st, cs, fs, cm, lv, mm, f, b, as, co, cf, hf}
```

Two rings, two meanings, one letter apart. Reading the right one for the two
cited rows in `events-v1096f`:

```
pm 59.159   te [{id 5, st blurred, fc 0}, {id 6, st blurred, fc 0}]
pm 59.226   te [{id 6, st blurred, fc 0}, {id 5, st cleared, fc 0}]
pm 111.111  te [{id 15, st blurred, fc 0}, {id 13, st cleared, fc 0}]
```

and the tracks-ring rows behind them:

```
lm 59.193   {id 6, st blurred, cs 0, fs 0, cm 0, lv 'uncertain', cf 1, mm 0, f 1}
lm 111.111  {id 15, st blurred, cs 0, fs 0, cm 0, lv 'uncertain', cf 1, mm 0, f 0}
```

`flagCertain` is 0 on every entry the renderer was handed; the `cf: 1` is the
clamp's core-freshness flag. Both blurred tracks have `fs: 0` and
`lv: 'uncertain'` — they have never had a certain read in either direction, so
they are covered fail-closed, which is not what the proposed option touches.

The option itself, priced on the same file: **26** certain female flags, of
which **20** score below `GENDER_CLEAR_SCORE` 0.45 —
`0.25 0.25 0.26 0.26 0.26 0.27 0.28 0.28 0.28 0.30 0.30 0.30 0.33 0.34 0.34
0.36 0.37 0.38 0.38 0.40`. The flag bar is 0.25 on purpose;
`gender-verdict.mjs` states the asymmetry directly ("the clear direction pays
the high bar... flag stays 0.25"). So the option is not a narrow hindsight
tweak — it retires three quarters of the run's opposite-gender evidence from
pinning duty, and if the owner is offered it, it should be offered with that
number.
