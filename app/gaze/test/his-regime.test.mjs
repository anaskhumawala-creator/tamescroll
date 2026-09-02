// PHASE-I I1: `HIS_EFFZOOM`/`K_HIS` stopped being literals and are now
// derived from `bench/his-regime.json`, a banked device measurement
// (`spikes/gauntlet/latency-ab-stageA.json`). A derivation with no test
// is exactly the shape phase-g's own rule warns about -- "an instrument
// that re-derives a shipped rule is a check that cannot fail" -- except
// here it is a CONSTANT re-deriving a MEASUREMENT, and the failure mode
// is the same: nothing would notice a re-bank drifting the device numbers
// away from what arch-arms.mjs still assumes.
//
// Three things pinned: (a) the derived `HIS_EFFZOOM` stays within 5% of
// the banked `toldMsP50` -- the whole point of picking `HIS_VERDICT_MS`
// the way the comment in arch-arms.mjs says; (b) `K_HIS` is exactly the
// banked `verdictGapP50` rounded to the 500ms bank grid; (c) the source
// file `his-regime.json` names still exists and still agrees with the
// numbers copied into it, so a future re-bank that drifts goes red here
// instead of silently invalidating every corpus number again (I1's own
// failure mode).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HIS_EFFZOOM, K_HIS } from '../bench/arch-arms.mjs';

const HIS_REGIME = JSON.parse(
  fs.readFileSync(new URL('../bench/his-regime.json', import.meta.url), 'utf8'));

test('the derived HIS_EFFZOOM is within 5% of the banked toldMsP50', () => {
  const want = HIS_REGIME.toldMsP50;
  const diff = Math.abs(HIS_EFFZOOM - want) / want;
  assert.ok(diff <= 0.05,
    `HIS_EFFZOOM ${HIS_EFFZOOM} is ${(diff * 100).toFixed(1)}% off the banked `
    + `toldMsP50 ${want} -- re-derive HIS_VERDICT_MS in arch-arms.mjs`);
});

test('K_HIS is the banked verdictGapP50 rounded to the 500ms bank grid', () => {
  const want = Math.max(1, Math.round(HIS_REGIME.verdictGapP50 / 500));
  assert.equal(K_HIS, want,
    `K_HIS ${K_HIS} does not match verdictGapP50 ${HIS_REGIME.verdictGapP50} `
    + `rounded to the 500ms grid (${want})`);
});

test("his-regime.json's source file exists and still agrees with it", () => {
  // his-regime.json's own "source" field is repo-root-relative; this
  // file lives at app/gaze/test/, three levels below the repo root.
  const srcUrl = new URL(`../../../${HIS_REGIME.source}`, import.meta.url);
  assert.ok(fs.existsSync(srcUrl),
    `${HIS_REGIME.source} is missing -- his-regime.json points at a file `
    + 'that no longer exists; re-bank or fix the "source" field');
  const src = JSON.parse(fs.readFileSync(srcUrl, 'utf8'));
  assert.ok(Math.abs(src.verdictGapP50 - HIS_REGIME.verdictGapP50) <= 1,
    `${HIS_REGIME.source}'s verdictGapP50 (${src.verdictGapP50}) has drifted `
    + `from his-regime.json's banked ${HIS_REGIME.verdictGapP50} -- re-bank `
    + 'his-regime.json from the source file');
  assert.ok(Math.abs(src.toldMs - HIS_REGIME.toldMsP50) <= 1,
    `${HIS_REGIME.source}'s toldMs (${src.toldMs}) has drifted from `
    + `his-regime.json's banked toldMsP50 ${HIS_REGIME.toldMsP50} -- re-bank `
    + 'his-regime.json from the source file');
});
