# Phase K critic — the post-1093 clock round (commit 2d3f3ff against 3979e42)

Six claims attacked, ten findings, most severe first. Everything below was
run or read, never argued: the banked JSON under `spikes/gauntlet/`, the
shipped source, `node bench/native-body-vs-synth.mjs`, and `npm test` in
`app/gaze` (697/697, nothing edited).

| id | date | trigger | severity | claim | falsifier | verdict | note | artifact |
|---|---|---|---|---|---|---|---|---|
| K1 | 2026-09-02 | phase-k (3) | EXPOSURE | Per-model fp16 shipped on BlazeFace, and on the one frame of the parity corpus where MoveNet admits nobody AND a face exists, fp16 LOSES the face. t=90: fp32 native 1 face (conf 0.455), worker 1 face (conf 0.459), fp16 native **0 faces**, `persons: []` in both arms. That face is the frame's entire cover — the new bench scores t=90 at worker 0.686 / native 0.686 from ONE synthetic body — so on fp16 a close-up filling 0.60 x 0.60 of the frame has no patch at all. The round's claim answers the GENDER labels (22/24) and never mentions the lost DETECTION; the summary records it only as `faceCountMismatchFrames: 1`. | Re-dump parity 3x per arm and read t=90's `native.faces` length. If fp16 finds the face on any repeat, this is the known non-determinism (findings 16a) — and then the parity dump cannot establish fp16 face parity at all, which is the same problem. | OPEN | 2 of 16 frames (t=90, t=300) are face-only; fp16 loses one of them. Cheapest fix if it reproduces: keep BlazeFace (model id 1) in fp32 and leave only faceres at fp16 — the measured gender saving is 220 -> 182ms, the frame saving only 359 -> 345ms. | `native-parity-1788347487.json`, `native-parity-1788351287.json` |
| K2 | 2026-09-02 | phase-k (5) | WRONG-NUMBER | Findings 26's snapshot table reverses under time weighting, and the reversed version reproduces the coverage drop it was written to explain away. The table is UNWEIGHTED per-verdict counts, but the two arms sample at snapshot gap p50 **0.801s (native)** against **2.034s (worker)** — 2.5x apart. Weighting each snapshot by the media time to the next: native has a blurred track **0.643** of the time, worker **0.673**. Native covers LESS, not more, by 0.030 — against the frame-level `coverage` difference of 0.021 (0.583 vs 0.604) in the same two files. So "At verdict time native covers more often" is a sampling artifact and "the frame-level drop lives BETWEEN verdicts" does not follow from it. | Recompute the table weighting each snapshot by `mt[i+1] - mt[i]`; if the sign holds, this is refuted. | OPEN | The unweighted numbers reproduce exactly (0.363 / 0.769 / 0.328 vs 0.421 / 0.724 / 0.282), so the arithmetic is right and the inference is not. The exit-hang half of findings 26 (native p50 3, worker p50 58) is untouched by this and still supports the phantom story — it just no longer has a second instrument agreeing with it. | `latency-ab-native-fp16.json`, `latency-ab-native-fp16-off.json` `delayArm.snaps` |
| K3 | 2026-09-02 | phase-k (1) | WRONG-NUMBER | The yield gate's SHIPPED comment claims a number the round's own data refutes, and findings 26 says the opposite thirty lines away. `init-entry.js`: "One position pass of tracking traded for ~250ms off every verdict gap". Measured, yield-only arms against the 1093 baseline: gap p50 1213 -> **1189 / 1192**, i.e. **24ms (1.9%)**, while positions fell **78 -> 53 / 58 (-26 to -32%)**. Findings 26 states this correctly ("did not move the gap (1189) ... the slot was the loss, not the collision") and the source comment was not updated. `test/position-yield.test.mjs` repeats the same wrong rationale in its header. | `python` over the four banked runs' `verdictGapP50` and `positions`. | OPEN | The gate still ships. It is not harmful in the shipped config (verdicts + positions per 150s: 1093 180, clock 202-211), but a shipped comment quoting 10x the measured benefit is how the next round re-derives a wrong trade. | `latency-ab-native1093.json`, `-yield.json`, `-yield2.json` |
| K4 | 2026-09-02 | phase-k (4) | SCOPE | `CUT_PERSON_LOOK` 1 was priced on a cadence that no longer ships. `latency-ab-native-cutlook.json` carries `bundle 75cddef` — the 1093 release, BEFORE the clock hoist in this same commit. On that build the +15% (gap 1213 -> 1399) is right. The build the default now ships in reads gap 800, verdicts 148-152 against 102, and MoveNet skipped on **31-33% of passes (63-69 of 202-211)** against **20% (36 of 180)**. The forced look fires once per cut (30-31 cuts / 150s) against a back-off that is engaged on a third of passes instead of a fifth, so its cost on the shipping clock is unmeasured. | Re-run `probe_latency_ab.py --delay` with `CUT_PERSON_LOOK` 0 and 1 on the hoisted build and compare the gap. | OPEN | The `~5s` exposure argument HOLDS at both cadences (see the clean list). What does not carry is the price. Also: the comment's "coverage 0.55 -> 0.616" is inside same-config run-to-run spread — `native-yield` 0.651 vs `native-yield2` 0.592 is 0.059 on identical settings. | `latency-ab-native-cutlook.json` (`bundle`, `tuning`), `latency-ab-native-clock2.json` |
| K5 | 2026-09-02 | phase-k (6) | WRONG-NUMBER | Ledger J10 is closed citing the artifact whose OWN verdict field says the probe FAILED, and the coverage numbers it quotes reverse on the corrected run. `native-failsafe-1788348270.json` `verdict` = **"nativePasses kept rising after the kill (82 -> 83)"**, and J10 quotes "covered samples 15/20 -> 12/20" from that file. The corrected run `native-failsafe-1788352884.json` reads **"FAIL-SAFE HOLDS ... covered samples 12/20 -> 16/20"** — opposite direction, same n=20. And the "+1 is the in-flight pass resolving" argument does not survive it: in the corrected run `nativePasses` crosses the kill **85 -> 90 (+5)** with replies 288 -> 294, because the kill lands between two 5s samples. | Read `verdict` and `before.rows[-1]` / `after.rows[0]` in both failsafe files. | OPEN | THE FAIL-SAFE ITSELF HOLDS and I am not disputing it: both after-windows are flat (`nativePasses` 83 x 20 and 90 x 20, `nativeReplies` 240 x 20 and 294 x 20), `workerDead` false throughout, patches return within one sample. What is wrong is the closure's evidence pointer and the +1 reasoning. Cite 1788352884 and drop the +1 sentence. | `native-failsafe-1788348270.json`, `native-failsafe-1788352884.json` |
| K6 | 2026-09-02 | phase-k (1/2) | NIT | The hoist roughly DOUBLES the share of verdict passes thrown away, and no row records it. `passDropped` 9 -> **18 / 19**; dropped verdicts 5 of 102 (4.7%) -> **14 of 148 (9.5%)** and **17 of 152 (10.1%)**. A verdict that may start on any 120ms tick is likelier to be in flight when a cut lands, and `myEpoch !== passEpoch` discards it. | Compare `verdictsDropped / verdicts` and `lifeDelta.passDropped` across the arms. | OPEN | Net still a large win (`secsPerVerdictUseful` 1.47 -> 1.01), which is why this is a NIT and not a number that changes the decision — but the round's table quotes only the p50 gap, and a doubled waste rate is GPU spend on the phone the whole project is cadence-bound on. | `latency-ab-native1093.json`, `-clock.json`, `-clock2.json` |
| K7 | 2026-09-02 | phase-k (2) | NIT | "1213 -> 800" is not all scheduling, and 800 is the duty dial. Verdict cost p50 fell **474 -> 381 / 355** between the arms, so `effZoom = max(400, cost * VERDICT_DUTY)` fell 948 -> 762 / 710 on its own. Slack above effZoom: **265ms at 1093, 40ms at clock** — so ~225ms of the 413ms is the hoist and ~186ms is the cheaper verdict, itself downstream of MoveNet being skipped on a third of passes instead of a fifth (K4). The new p50 gap now tracks effZoom within 40-90ms: **the binding constraint is `VERDICT_DUTY`, not the scheduler.** | Bank `lastVerdictMs` per verdict and regress the gap on it; or run `VERDICT_DUTY` 1.5 on the hoisted build (`duty15` was run on 75cddef, the old clock). | OPEN | Consequence, and it is a free win nobody has taken: on the hoisted clock `VERDICT_DUTY` 1.5 should read a gap near 600, over OTA, no install. It is also ~25% more `nativePasses` of GPU. | `latency-ab-native*.json` `verdictMsP50` / `verdictGapP50`, `latency-ab-native-duty15.json` `bundle` |
| K8 | 2026-09-02 | phase-k (1) | NIT | The rewind the new test calls "the line that matters" cannot do what its comment says. `lastSample = now + verdictDueIn - effInterval` is defended as "without it the yield would push the verdict out by a whole effInterval instead of pulling it in" — but the gate added in the SAME commit is `if (now - lastSample < effInterval && !verdictDue) return;`, so a due verdict passes it whatever `lastSample` holds. The rewind cannot move the verdict, and the verdict overwrites `lastSample = now` when it fires. Its only reachable effect is when the verdict is BLOCKED (`overBudget`, `inputPending`, `verdictBusy`): there it lets a POSITION pass run earlier than `effInterval` — the opposite of yielding. | Delete the rewind line and re-run the A/B; the gap must not move. | OPEN | The regex in `position-yield.test.mjs` is not vacuous (deleting the block fails it) but it pins the rewind on a rationale that is false, which is the shape that produced G1/G5/G9. | `app/gaze/src/init-entry.js` (the `verdictDueIn` block), `app/gaze/test/position-yield.test.mjs` |
| K9 | 2026-09-02 | phase-k (4) | NIT | `person-skip.test.mjs` cites a test file that does not exist: "rules/tuning.json must agree (tuning-json.test.mjs pins that)". There is no `test/tuning-json.test.mjs`. | `ls app/gaze/test/` and grep for `tun`. | OPEN | The pin is REAL, only misnamed: `test/tuning.test.mjs:174` "the shipped tuning.json equals the shipped constants exactly" reads the VALUE (`assert.equal` of `obj[k]` against the module constant), not the key, and `rules/manifest.json` was regenerated correctly (tuning.json sha256 `af9eb399...` matches the LF-normalised file). Fix the citation. | `app/gaze/test/tuning.test.mjs:174`, `rules/manifest.json` |
| K10 | 2026-09-02 | phase-k (1) | NIT | `delayVerdictLate` read **214** on `native-clock` and **0** on `native-clock2` — identical config, same video, same seek. The handoff already carries this counter as an unexplained open instrument; the round did not record that it went from 0 on every 1093 arm to 214 on one arm of the shipping change. | Bank it per verdict with the presented media time and the `boxesAt` inputs. | OPEN | `delayVerdictLateFrac` reads 0.0 in every `delayArm` block, so the two halves of the same instrument disagree. Diagnostic only, not user-visible; do not quote either number until it is explained. | `latency-ab-native-clock.json` `lifeDelta`, `latency-ab-native-clock2.json` |

---

## K1 — fp16 BlazeFace loses the only face on a MoveNet-blind frame

Read out of the two parity dumps, matched frame by frame (`ts match: True`,
16 frames each, same `t` values):

```
t=90  fp32: native.faces 1  worker.faces 1  native.persons []
      fp16: native.faces 0  worker.faces 1  native.persons []
fp32 face:   conf 0.4551, box [0.2198, 0.3297, 0.8163, 0.9261]  (0.596 x 0.596 of frame)
worker face: conf 0.4593, box [0.2143, 0.3250, 0.8166, 0.9273]
readsNative t=90: gender female, raw 0.4855, score 0.029  -> fail-closed = covered
fp16 t=90: native.faces []   cropFacesNative []   boxesFrom "worker"
```

`native-body-vs-synth.mjs` scores that frame at `worker 0.686 / native 0.686 /
uncovered 0.000` — the whole cover is the one synthetic body over that one
face. Summaries: fp32 `faceCountMismatchFrames 0`, fp16 `faceCountMismatchFrames 1`,
`faceIou n` 24 -> 23. Only two of 16 frames (t=90, t=300) hold a face with
`persons: []`; fp16 loses one of the two.

## K2 — the snapshot table reverses under time weighting

Reproduced the published table exactly, then weighted it:

```
latency-ab-native-fp16.json      n 182  states {'blurred': 140, 'cleared': 111}
   noBlurFrac 0.363  blurredPerSnap 0.769  areaP50 0.328
latency-ab-native-fp16-off.json  n 76   states {'blurred': 55, 'cleared': 34}
   noBlurFrac 0.421  blurredPerSnap 0.724  areaP50 0.282

time-weighted (weight = mt[i+1] - mt[i], gaps > 10s dropped):
   native  span 147.1s  blurred 0.643   snapGap p50 0.801  mean 0.813
   worker  span 145.6s  blurred 0.673   snapGap p50 2.034  mean 1.942
frame-level coverage in the same two files: native 0.583, worker 0.604
```

The state vocabulary IS the whole set — `{blurred, cleared}` and nothing else
appears in either arm's `tr[].state`, so that half of the attack refutes.

## K3 — the yield bought 24ms, not 250

```
arm                 bundle            gap p50   positions  verdicts
native1093          75cddef            1213        78        102
native-yield        3979e42-dirty      1189        53        115
native-yield2       3979e42-dirty      1192        58        115
native-clock        3979e42-dirty       802        54        148
native-clock2       3979e42-dirty       800        59        152
```

`positionYieldVerdict` is ABSENT from the `lifeDelta` of both yield runs (the
probe key was added later in the same commit) and reads 31 / 28 in the clock
runs — so how often the gate fired in the two runs that priced it is not
banked at all.

## K4 — cutlook was priced on the pre-hoist bundle

```
latency-ab-native-cutlook.json  bundle 75cddef        tuning {"CUT_PERSON_LOOK": 1}
latency-ab-native-duty15.json   bundle 75cddef        tuning {"VERDICT_DUTY": 1.5}
latency-ab-native-clock2.json   bundle 3979e42-dirty

personPassSkipped / (verdicts + positions):
   1093     36 / 180 = 0.20
   cutlook  23 / 183 = 0.13
   clock    63 / 202 = 0.31      clock2  69 / 211 = 0.33
coverage on identical config: native-yield 0.651, native-yield2 0.592
```

## K5 — J10's artifact says FAIL

```
native-failsafe-1788348270.json
  last before  nativePasses 82  nativeReplies 239  t 263
  first after  nativePasses 83  nativeReplies 240  t 269   nativeDead 1
  verdict: "nativePasses kept rising after the kill (82 -> 83)"
  covered 15/20 -> 12/20            <-- the numbers J10 quotes

native-failsafe-1788352884.json
  last before  nativePasses 85  nativeReplies 288  t 263
  first after  nativePasses 90  nativeReplies 294  t 268   nativeDead 1
  verdict: "FAIL-SAFE HOLDS: worker took over, passes 52 -> 28, covered samples 12/20 -> 16/20"
  after-window nativePasses [90 x 20], nativeReplies [294 x 20]
```

## K6 / K7 — the cost side of the hoist

```
arm            verdicts  dropped  drop%   costP50  effZoom  gapP50  slack  gapP95
native1093        102       5      4.7%    474      948     1213     265    2411
native-yield      115      11      8.7%    431      862     1189     327    2244
native-clock      148      14      8.6%    381      762      802      40    2013
native-clock2     152      17     10.1%    355      710      800      90    2116

passDropped: 9 -> 13 / 12 (yield) -> 18 / 19 (clock)
gap deciles, clock: p10 400  p25 442  p50 802  p75 1405  p90 1847
```

The p10/p25 cluster at ~400 is `ZOOM_INTERVAL_MS`, newly reachable now that the
position slot no longer quantizes the clock. p95 improved 12-16% where p50
improved 34%.

## K8 — the rewind

`init-entry.js`, the three lines that decide it, in the same function:

```
if (now - lastSample < effInterval && !verdictDue) return;      // gate
...
lastSample = now;                                               // every pass
...
lastSample = now + verdictDueIn - effInterval;                  // the "rewind"
```

`verdictDue` is `isPlayer && !verdictBusy && now - lastZoomAt >= effZoom` and
reads nothing from `lastSample`. Since `effInterval >= lastPassMs * POSITION_DUTY`
(POSITION_DUTY 2) and the gate only fires when `verdictDueIn < lastPassMs`, the
rewind always lands `lastSample` strictly before `now` — it can only ever let a
position pass through EARLIER, never delay a verdict.

---

## Attacked, holds

- **The scroll clamp on `effZoom` becoming `isPlayer`-gated is inert.**
  `useRegionVideo = isPlayer && regionBlur && videoRegion.canRegionVideo(video)`
  (`init-entry.js:1824`), and the old `effZoom` lived inside
  `if (useRegionVideo && (workerVideo() || personModel))` — so it was already
  unreachable when `isPlayer` is false. No feed-preview or non-player path
  changes behaviour.
- **A verdict cannot start while a position pass is in flight.** `verdictDue`
  bypasses only the interval gate; `if (sampling) return;` sits below it and
  above every launch, and `sampling` is cleared in the pass's own `finally`.
  `verdictBusy` is a second, independent guard.
- **`effZoom` is declared exactly once and read identically at both sites.**
  One `var effZoom` in the file; `wasVerdict` computes the same predicate from
  the same `now`, and nothing between them can change `verdictBusy`
  synchronously.
- **The `lastZoomAt = 0` drop path is improved, not broken, by the hoist.** A
  pass discarded on `myEpoch !== passEpoch` sets `lastZoomAt = 0` with
  `verdictBusy` already false, so the replacement verdict now starts on the next
  120ms tick instead of waiting for a position slot.
- **The fp16 gender misses ARE coin flips.** Both label disagreements, native
  against worker: t=330 raw 0.5029 / 0.4974 (scores 0.006 / 0.005) and t=360 raw
  0.5132 / 0.4998 (scores 0.026 / 0.000). `GENDER_MIN_SCORE` is 0.25, so neither
  read can clear anybody either way. The fp32 arm carries one of the same two
  (23/24), so fp16 adds exactly one coin flip.
- **`native-body-vs-synth.mjs` does not re-derive a shipped rule.** It imports
  `personFromFace` and `synthFaceIndices` from `bench/.cache/shipped.mjs` (the
  emitted bundle) — the G1 remedy applied correctly. Its output refutes the
  tighter-body hypothesis cleanly: `native/worker 1.098`, uncovered 0.038 of
  frame with **0.0000** of it inside a face box, `faces with any sharp pixel on
  native: 0 of 24`.
- **The `~5s` exposure window in the CUT_PERSON_LOOK comment holds at both
  cadences.** `PERSON_EMPTY_STREAK` 3 + `PERSON_SKIP_EVERY` 4 - 1 = 6 passes;
  passes per 150s are 180 (1093) and 202-211 (clock), so 6 passes is 5.0s and
  4.3-4.5s. Both longer than the 1000ms delay line.
- **The OTA flip is safe on 1093 phones.** `tuning.mjs:281` clamps
  `CUT_PERSON_LOOK` to `[0, 1]`, `rules/manifest.json` carries the regenerated
  sha256 `af9eb399...` (verified against the LF-normalised file), and
  `test/tuning.test.mjs:174` asserts the JSON VALUE equals the module constant —
  not merely that the key exists.
- **Nothing was edited and the suite is green:** `npm test` in `app/gaze`
  reports `pass 697, fail 0`.
