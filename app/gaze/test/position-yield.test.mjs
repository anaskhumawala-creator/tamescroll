import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// THE YIELD GATE THAT LIVED HERE WAS REMOVED (phase-k K3/K8): a position
// pass yielding to an imminent verdict bought 24ms of gap (1.9%) for
// 26-32% of the position passes, and its lastSample rewind could not do
// what its comment claimed once the clock below was hoisted. The hoist
// is the whole fix.
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
