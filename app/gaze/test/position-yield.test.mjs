import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A POSITION PASS YIELDS TO AN IMMINENT VERDICT (2026-09-02, after 1093).
// Verdicts only START at position-pass slots, so a position pass launched
// just before the verdict falls due holds the GPU queue and the verdict
// takes the NEXT slot: on the Redmi the gap read 1213ms at effZoom 948
// and 1180 at effZoom 711 -- the duty dial moved it 3%. The gate below
// refuses the position pass when the verdict is due before it would
// finish, and REWINDS the sample clock so the next slot lands at the
// due time. The rewind is the line that matters: `lastSample = now` was
// already written above, so without it the yield would push the verdict
// out by a whole effInterval instead of pulling it in. Structural, on
// the shipped entry, comments stripped (the G9 shape), whole block in
// order, same anchors as person-skip-live.test.mjs.
test('init-entry.js yields a position pass to an imminent verdict and rewinds the sample clock', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const wasVerdictDecl = src.indexOf('var wasVerdict = !verdictBusy');
  assert.ok(wasVerdictDecl > 0, 'the wasVerdict declaration moved -- re-anchor this test');
  const verdictBusyBlock = src.indexOf('if (wasVerdict) {', wasVerdictDecl);
  assert.ok(verdictBusyBlock > wasVerdictDecl, 'the verdictBusy block moved -- re-anchor this test');
  const region = src.slice(wasVerdictDecl, verdictBusyBlock)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(
    region,
    /if\s*\(isPlayer\s*&&\s*!wasVerdict\s*&&\s*!verdictBusy\s*&&\s*lastPassMs\s*>\s*0\)\s*\{\s*var verdictDueIn\s*=\s*lastZoomAt\s*\+\s*effZoom\s*-\s*now;\s*if\s*\(verdictDueIn\s*>\s*0\s*&&\s*verdictDueIn\s*<\s*lastPassMs\)\s*\{\s*bumpLife\('positionYieldVerdict'\);\s*lastSample\s*=\s*now\s*\+\s*verdictDueIn\s*-\s*effInterval;\s*sampling\s*=\s*false;\s*return;\s*\}\s*\}/,
    'the yield gate must exist in order: due-in from lastZoomAt + effZoom, ' +
    'bump, REWIND lastSample to the due time, `sampling = false`, return',
  );
  // The yield sits AFTER the personsLive() skip: a dead MoveNet never
  // reaches it (there is no position pass to yield), and the two counters
  // stay two populations.
  const skip = region.indexOf("bumpLife('positionPassSkipped')");
  const yld = region.indexOf("bumpLife('positionYieldVerdict')");
  assert.ok(skip > 0 && yld > skip, 'the yield must follow the personsLive() skip');
});

// THE VERDICT CLOCK IS NOT QUANTIZED TO THE POSITION SLOT (2026-09-02).
// effZoom is computed ABOVE the `now - lastSample < effInterval` gate
// and a due verdict passes that gate on any sampler tick. Measured on the
// Redmi: with the clock below the gate the verdict gap read 1189-1213ms
// against an effZoom of 862-948, and VERDICT_DUTY could not move it.
// Pinned in order: effZoom declared before the interval gate, the gate
// carries `&& !verdictDue`, and the later wasVerdict reads the same
// effZoom (no second declaration).
test('init-entry.js lets a due verdict start on any tick, not only at a position slot', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  const effZoomDecl = src.indexOf('var effZoom = Math.min(cadence.VERDICT_MAX_INTERVAL_MS');
  assert.ok(effZoomDecl > 0, 'effZoom declaration missing');
  assert.equal(src.indexOf('var effZoom = ', effZoomDecl + 1), -1, 'effZoom must be declared exactly once');
  const gate = src.indexOf('if (now - lastSample < effInterval && !verdictDue) return;');
  assert.ok(gate > effZoomDecl, 'the position-slot gate must come AFTER effZoom and carry `&& !verdictDue`');
  const due = src.indexOf('var verdictDue = isPlayer && !verdictBusy && now - lastZoomAt >= effZoom;');
  assert.ok(due > effZoomDecl && due < gate, 'verdictDue must be derived from effZoom between the declaration and the gate');
  const wasVerdict = src.indexOf('var wasVerdict = !verdictBusy && now - lastZoomAt >= effZoom;');
  assert.ok(wasVerdict > gate, 'wasVerdict must read the hoisted effZoom after the gate');
});
