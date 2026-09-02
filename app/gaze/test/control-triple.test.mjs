// THE SELF-CHECK, MADE SELF-DETECTING.
//
// Every sweep in bench/ prints a control row -- the shipped arm,
// unpatched, in his regime -- and the reader is invited to check it
// against a triple written in prose. At phase E there were THREE triples
// in circulation across CLAUDE.md, person-track.mjs and arch-arms.mjs,
// and the published one reproduced nowhere: 1090 and 1091 each moved the
// arm and neither updated the detector. A staleness detector that cannot
// detect its own staleness is worse than none, because it reads as
// corroboration.
//
// So run the arm. This is the only assertion in the suite that scores the
// whole corpus, and it is worth its seconds.
//
// WHAT IT COVERS, STATED NARROWLY, because the first version of this
// comment claimed "ANY shipped constant in the decision layer" and the
// phase-F critic falsified that in three moves (F3): `PATCH_MARGIN`
// 0.045 -> 0.500, `PERSON_MIN_SCORE` -> 0.99 and `HEAD_ANCHOR_UP` -> 0.0
// all leave it green with the cache verifiably rebuilt.
//
// The reason is the instrument, not the test. **The corpus banks PARSED
// PERSONS -- boxes -- so it sits DOWNSTREAM of `parsePersons`.** Every
// constant whose only effect is inside that function (the anchor gate,
// the score floor, the head anchor, the keypoint union) is invisible
// here because the function never runs; the arm replays boxes it already
// has. `PATCH_MARGIN` is the same story one step further on: the arm
// only reaches `personFromFace` where a banked observation has NO box,
// which on this corpus is nowhere in the control arm.
//
// So: this fails when a constant in the ASSOCIATION AND DECISION layer
// moves -- `PTRACK_*`, the clear bars, the coast, `CUT_DELTA`, the
// assignment, the clamp -- and it is blind to the EXTENT layer above it.
// Proven: it goes red on `PTRACK_ASSIGN`. Anything that changes what
// MoveNet is handed or how its output is parsed needs the frame-level
// benches (`bench/movenet-gated.mjs`, `bench/movenet-held.mjs`), which
// decode video rather than replaying a bank.
//
// The corpus and the built bundle are both artifacts, so an absent one
// SKIPS -- a stale checkout is not a regression.
import { test, skip } from 'node:test';
import assert from 'node:assert/strict';
import { loadWin, makeArms, thinFrames, hisRegimeOpts, K_HIS, CONTROL } from '../bench/arch-arms.mjs';
import { winFiles } from '../bench/corpus-lib.mjs';
import { score } from '../bench/corpus-score.mjs';
import * as SHIPPED from '../bench/.cache/shipped.mjs';
import fs from 'node:fs';
import { ROOT } from '../bench/corpus-lib.mjs';

function corpus() {
  try {
    const files = winFiles();
    if (!files.length) return null;
    const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
    const cropLabel = new Map();
    for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
      if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
    return { wins: files.map(loadWin), cropLabel };
  } catch { return null; }
}

function runArm(g, c) {
  const arm = makeArms(SHIPPED)(hisRegimeOpts(g));
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const w of c.wins) {
    const s = score(arm(thinFrames(w, K_HIS), g), g, (crop) => c.cropLabel.get(crop));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return agg;
}

for (const g of ['man', 'woman']) {
  test(`the shipped arm reproduces the published control triple (${g})`, () => {
    const c = corpus();
    if (!c) return skip('corpus not present in this checkout');
    const got = runArm(g, c);
    const want = CONTROL[g];
    for (const k of Object.keys(want)) {
      assert.equal(got[k], want[k],
        `${g} ${k}: the shipped arm reads ${got[k]}, arch-arms.CONTROL says ${want[k]}. `
        + `A decision-layer constant moved. Update CONTROL (config: ${CONTROL.config}) `
        + 'and every table that quotes the old triple -- do not just widen this assertion.');
    }
  });
}
