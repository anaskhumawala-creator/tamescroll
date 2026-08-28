// THE WARM-UP MUST NEVER LEAVE THE ENGINE IN COMPILE-ONLY MODE.
//
// ENGINE_COMPILE_ONLY makes every tfjs kernel build its shader and
// return WITHOUT running it. That is exactly what the pre-compile pass
// wants and exactly what the rest of the pipeline must never see: with
// the flag left set, BlazeFace would answer "no faces" on every image
// and the drain would REVEAL each one -- silently, with no error
// anywhere. There is no unit-testable seam around a WebGL backend, so
// this pins the shape of the code that guarantees it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/detector.js', import.meta.url), 'utf8');

test('compile-only is turned off in a finally, not on the happy path', () => {
  const fn = SRC.slice(SRC.indexOf('async function compileOnly('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.ok(body.includes("env.set('ENGINE_COMPILE_ONLY', true)"), 'the flag is set somewhere');
  const off = body.indexOf("env.set('ENGINE_COMPILE_ONLY', false)");
  assert.ok(off > 0, 'the flag is cleared');
  const fin = body.indexOf('} finally {');
  assert.ok(fin > 0 && off > fin, 'the flag is cleared in a finally, so a throw cannot skip it');
});

test('the warm-up runs every model the image path uses', () => {
  const fn = SRC.slice(SRC.indexOf('export async function warmUp('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  for (const m of ['models.face', 'models.gender', 'models.nsfw']) {
    assert.ok(body.includes(m), `${m} is warmed`);
  }
});

test('a warm-up failure is swallowed, never surfaced as a verdict', () => {
  const fn = SRC.slice(SRC.indexOf('export async function warmUp('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  // It returns timings or null; it must not throw into ensureModels,
  // which would take the whole worker down for an optimisation.
  assert.ok(body.includes('catch (e)'), 'warmUp catches');
});
