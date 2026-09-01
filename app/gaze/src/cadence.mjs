// THE VERDICT CLOCK, WHICH IS THE BIGGEST LEVER THIS SYSTEM HAS.
//
// The labelled corpus prices it far above any threshold: man exposure is
// 24.5s at 1.5s per verdict and 5.5s at 0.5s, where every gender,
// clear-bar, cut and birth constant swept this month moves 1-3s. So how
// often a verdict lands matters more than what the verdict decides.
//
// (Those were 81.0s and 8.0s until 2026-09-02. The arm told the tracker
// a 500ms cadence in every k arm, so its coast windows were sized for a
// clock three times faster than the one it was running and tracks
// expired between every pair of verdicts -- engine-findings 13. The
// clock is still the biggest lever by a wide margin; it is a quarter of
// the advertised size.)
//
// AND CORRECTED, THE DIAL HAS NO TRADE. Exposure, false cover AND
// phantom all improve as the clock speeds up (13a) -- the cliff that
// used to sit at 2.0s was the same instrument defect. The only cost of
// lowering this number is GPU duty, which is why the table below is
// about duty and nothing else.
//
// AND ON A DEVICE IT IS SET BY A CONSTANT, NOT BY COST. init-entry
// computes
//
//     effZoom = min(VERDICT_MAX_INTERVAL_MS,
//                   max(ZOOM_INTERVAL_MS, lastVerdictMs * VERDICT_DUTY))
//
// which has three regimes, and only two of them respond to making a pass
// cheaper:
//
//     cost <  500ms    duty-limited   cadence = cost * 4   cheaper helps
//     500..2000ms      CAP-limited    cadence = the cap    cheaper does NOTHING
//     cost > 2000ms    busy-limited   cadence ~= cost      cheaper helps
//
// MEASURED ON HIS REDMI (spikes/gauntlet/probe_pass_cost.py, 90s windows
// on his own watch page). Verdict pass p50 cost, decomposed:
//
//                     PERSON_SKIP_EVERY 1     3
//     whole pass            1250 ms        728 ms
//       persons (MoveNet)    814  (65%)     300  (41%)
//       crops (face+gender)  362  (29%)     358  (49%)
//     verdict passes           58            62
//     position passes          42            97
//     effZoom            min(2000, 5000)  min(2000, 2912)
//                          = 2000           = 2000
//
// BOTH ARMS ARE CAP-LIMITED, and that is the complete explanation for
// engine-findings 10i: halving the pass cost bought FOUR extra verdicts
// in ninety seconds, because 2000 was the binding constraint in both
// arms. Nothing downstream of cost can move the clock while that holds.
//
// THE CAP IS A FLOOR ON THE GAP, NOT THE GAP ITSELF, and reading it as
// the gap overstates what lowering it buys. A scene cut sets
// `lastSample = 0`, dragging the next verdict forward -- so the SAME
// 90s window that computes effZoom 2000 shows 58 verdicts, i.e. one
// every **1.55s**. The scene gate is an unpriced cadence mechanism
// (engine-findings 10n). So 2000 -> 1200 cannot buy 1.67x; the ceiling
// is 1.55/1.2 = **1.29x**, and less on footage that cuts less often
// than that window did.
//
// SO THE CONSTANT TRAVELS. It used to live in a per-video closure, where
// it could only change with a 56MB install -- and he has said plainly
// that he is tired of installing versions. It ships at exactly the value
// it had, so this changes nothing until a number is deliberately pushed.
//
// THE RANGE IS A DUTY-CYCLE DECISION, and it is why the floor is 1200
// rather than something rounder. Duty is cost/interval, and starving the
// main thread is his "the page loads a lot ... just the loading icon"
// complaint:
//
//     interval   duty at 1250ms (no skip)   duty at 728ms (skip 3)
//       2000          62%  <- today                36%
//       1500          83%                          49%
//       1200         104%  saturated               61%  <- today's duty
//
// At 1200 with no skip the pass is longer than its own interval. That
// cannot build a backlog -- `verdictBusy` forbids a second pass while one
// runs, so the cadence simply becomes the cost -- but it does leave the
// page almost nothing. **Pushing below ~1500 is only safe with
// PERSON_SKIP_EVERY above 1**, and the table above is how to check that
// on whatever his pass costs on the day. The ceiling of 4000 exists for
// the opposite case: a device that needs to hand the page more room.
//
// The floor is NOT below 1200 for a second reason: a track blurred at
// one verdict coasts on interpolation until the next, and the coast
// windows in person-track are derived from this number.
export var VERDICT_MAX_INTERVAL_MS = 2000;

/** OTA tuning entry point; the whitelist clamps before this is called. */
export function setVerdictMaxInterval(ms) {
  VERDICT_MAX_INTERVAL_MS = ms;
}
