// THE PARKED MINIPLAYER DREW HIS BLUR AT SCALE-SQUARED.
//
// Owner screenshot 2026-08-31: video parked bottom-right, his face on the
// right of the box, the patch up and to the left of it and too small.
// MEASURED (probe_mini_patch_scale.py): host scale 0.56, and the same
// three patches read 0.559-0.562 of their full-size normalized position
// AND size. That is an exposure, so these tests are about coverage, not
// tidiness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hostScale, toLocalRect } from '../src/host-scale.mjs';

test('an untransformed host scales nothing', () => {
  const s = hostScale({ offsetWidth: 412 }, { width: 412 });
  assert.equal(s, 1);
  const r = { left: 10, top: 20, width: 30, height: 40 };
  assert.equal(toLocalRect(r, s), r, 'same object: no work, no churn');
});

test('the parked player measures its own scale', () => {
  // The numbers off the live page: 412px player parked at 231px wide.
  const s = hostScale({ offsetWidth: 412 }, { width: 231 });
  assert.ok(Math.abs(s - 0.5607) < 0.001, s);
});

test('a viewport rect converts to host-local pixels', () => {
  const s = 0.5607;
  const local = toLocalRect({ left: 176.9, top: 67.9, width: 54, height: 62 }, s);
  // Drawn back through the ancestor transform, it lands where it was measured.
  assert.ok(Math.abs(local.left * s - 176.9) < 0.01);
  assert.ok(Math.abs(local.top * s - 67.9) < 0.01);
  assert.ok(Math.abs(local.width * s - 54) < 1, 'size within a pixel of measured');
  assert.ok(Math.abs(local.height * s - 62) < 1);
});

test('round trip preserves the normalized box, which is the bug', () => {
  // Full size: a patch covering the right half of a 412x232 player.
  const full = { left: 206, top: 116, width: 206, height: 116 };
  const s = 231 / 412;
  const local = toLocalRect({ left: full.left * s, top: full.top * s,
                             width: full.width * s, height: full.height * s }, s);
  // What the browser paints = local * s. Normalized against the parked
  // player it must equal the full-size normalization.
  assert.ok(Math.abs((local.left * s) / (412 * s) - full.left / 412) < 0.005);
  assert.ok(Math.abs((local.width * s) / (412 * s) - full.width / 412) < 0.01);
});

test('a junk measurement is never allowed to move a patch', () => {
  // Fail-safe direction: an unmeasurable host keeps the old arithmetic
  // rather than throwing a patch somewhere new.
  assert.equal(hostScale(null, null), 1);
  assert.equal(hostScale({ offsetWidth: 0 }, { width: 231 }), 1);
  assert.equal(hostScale({ offsetWidth: 412 }, { width: 0 }), 1);
  assert.equal(hostScale({ offsetWidth: 1 }, { width: 1e6 }), 1, 'absurd scale refused');
  assert.equal(hostScale({ offsetWidth: 1e6 }, { width: 1 }), 1);
});

test('both renderers convert through this one function', () => {
  // The class-level guarantee. Video patches are what the owner saw; the
  // image path has the identical arithmetic and every feed host measured
  // is unscaled, so there it is a net. Two copies is how the last shared
  // geometry defect survived four days (see crop-geometry.test.mjs).
  for (const f of ['video-region.mjs', 'region-blur.mjs']) {
    const src = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    assert.match(src, /from '\.\/host-scale\.mjs'/, f + ' imports the shared helper');
    assert.match(src, /toLocalRect\(/, f + ' converts before writing');
  }
});
