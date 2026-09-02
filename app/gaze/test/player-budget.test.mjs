// THE PLAYER PASS WAS CHARGING THE MAIN-THREAD BUDGET FOR WORKER TIME.
//
// The image drain fixed this in 2026-08-28 (`mainMs`); the player pass
// kept charging its full wall clock. MEASURED on the owner's phone: a
// verdict pass is 795ms end to end, 785 of it the worker reply and 2 of
// it ours -- so a 25%-of-a-second budget was being emptied by work that
// never touched the thread, and the cheap position passes that keep a
// patch on a moving subject were refused (20 to 62).
//
// These pin the accounting, not the numbers.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

var client = readFileSync(new URL('../src/worker-client.mjs', import.meta.url), 'utf8');
var init = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('the worker client accumulates the time callers spend waiting', function () {
  assert.match(client, /var waitTotal = 0;/);
  assert.match(client, /waitTotal \+= nowMs\(\) - askedAt;/);
  // Both settle paths, or a rejected request leaks its wait forever.
  var adds = client.match(/waitTotal \+= nowMs\(\) - askedAt;/g) || [];
  assert.equal(adds.length, 2, 'resolve AND reject must record the wait');
  assert.match(client, /waitMs: function \(\) \{\s*return waitTotal;/);
});

test('the wrapped resolve calls the ORIGINAL, not itself', function () {
  // Reassigning `resolve` in place without capturing it first is an
  // infinite recursion that would hang every request.
  assert.match(client, /var ok = resolve;/);
  assert.match(client, /var bad = reject;/);
  assert.match(client, /ok\(v\);/);
  assert.match(client, /bad\(e\);/);
});

test('the player pass takes a baseline before its first request', function () {
  assert.match(init, /var waitBase = workerVideo\(\) \? vid\(\)\.waitMs\(\) : null;/);
  var base = init.indexOf('var waitBase =');
  var call = init.indexOf('runPass(wasVerdict, mark');
  assert.ok(base > 0 && call > base, 'the baseline must precede the pass');
});

test('the player pass charges only what it spent here, floored at zero', function () {
  var i = init.indexOf('var mine = cost;');
  assert.ok(i > 0);
  var seg = init.slice(i, i + 400);
  assert.match(seg, /vid\(\)\.waitMs\(\) - waitBase/);
  assert.match(seg, /Math\.max\(0, cost - waited\)/);
  assert.match(seg, /noteSpend\(performance\.now\(\), mine\)/);
});

test('the in-page path is still charged in full', function () {
  // waitBase is null when the worker is not driving the player, so the
  // subtraction cannot fire: that time really was spent on this thread.
  var i = init.indexOf('var mine = cost;');
  var seg = init.slice(i, i + 400);
  assert.match(seg, /if \(waitBase !== null\)/);
});

test('lastVerdictMs still measures WALL time, because cadence is about the gap', function () {
  // effZoom = lastVerdictMs * VERDICT_DUTY paces one pass after another
  // through a single GPU queue, so it must keep using elapsed time --
  // subtracting the worker there would schedule passes on top of the
  // worker's own backlog.
  var i = init.indexOf('var cost = performance.now() - now;');
  var seg = init.slice(i, i + 200);
  assert.match(seg, /if \(wasVerdict\) lastVerdictMs = cost;/);
  assert.match(seg, /else lastPassMs = cost;/);
});

test('the pass counters are monotonic, because the ring is not', function () {
  // player.passes was `stages.length` over a 120-cap ring sliced to 40,
  // so a probe diffing it across a window read the FILL, not the rate --
  // that is how a measured 2.09s verdict gap was written down as 5.77s.
  assert.match(init, /dbgSt\.passesTotal = \(dbgSt\.passesTotal \|\| 0\) \+ 1;/);
  assert.match(init, /if \(wasVerdict\) dbgSt\.verdictsTotal =/);
  var diag = readFileSync(new URL('../src/diag-report.mjs', import.meta.url), 'utf8');
  assert.match(diag, /passes: num\(ids\.passesTotal\)/);
  assert.match(diag, /verdicts: num\(ids\.verdictsTotal\)/);
  assert.match(diag, /passesRing: stages\.length/);
});
