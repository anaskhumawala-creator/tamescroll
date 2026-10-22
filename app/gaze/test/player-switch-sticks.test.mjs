import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// His 2026-10-22 report: "when I turn it off or make the screen bigger or
// smaller, then again the blur shows up". YouTube fires loadstart on the
// same watch page for an ad ending, a quality switch and a fullscreen
// toggle, and loadstart used to force the switch back on.
const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

// Slice to MARKERS, never a character count.
function between(from, to, start = 0) {
  const a = src.indexOf(from, start);
  assert.ok(a >= 0, `marker moved: ${from}`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > a, `marker moved: ${to}`);
  return src.slice(a, b);
}

test('"off" is remembered by watch id, outside the per-element attach', () => {
  const head = between('var playerBlurOffFor', 'function attachVideo(video) {');
  assert.ok(head.includes("get('v')"), 'keyed on the watch id');
  assert.ok(src.indexOf('var playerBlurOffFor') < src.indexOf('function attachVideo(video) {'),
    'per-element state is what YouTube rebuilding the player reset');
});

test('a reloading stream on the same video keeps the switch off', () => {
  const load = between("video.addEventListener('loadstart'", "markPending(video);",
    src.indexOf("video.addEventListener('loadstart'"));
  assert.ok(load.includes('playerBlurKeptOff()'), 'loadstart must ask before re-arming');
  assert.ok(!/playerBlurOn = true;/.test(load), 'an unconditional re-arm is the bug');
  assert.ok(load.includes('if (keepOff) return;'), 'and must not blur-first a kept-off video');
});

test('a pass in flight when the pill goes off cannot put the blur back', () => {
  const cover = between('function coverVideo() {', 'markFlagged(video);');
  assert.ok(cover.includes('isPlayer && !playerBlurOn) return'), 'the cover door is shut while off');
  const set = between('var setPlayerBlur = function (on) {', 'pillPaint();');
  assert.ok(set.includes('passEpoch++'), 'the in-flight person pass is dropped');
});

test('a different video re-arms blur-first', () => {
  const tick = between('var pillWatch', '}, 250);');
  assert.ok(/!playerBlurOn && !playerBlurKeptOff\(\)[^\n]*setPlayerBlur\(true\)/.test(tick),
    'a watch->watch swap must not inherit the last video\'s "off"');
});
