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

test('his tap is remembered by watch id, outside the per-element attach', () => {
  const head = between('var playerBlurChoice', 'function attachVideo(video) {');
  assert.ok(head.includes("get('v')"), 'keyed on the watch id');
  assert.ok(head.includes('playerBlurWanted(watchVideoId(), playerBlurChoice, onPhone)'),
    'the decision is player-switch.mjs, not a copy here');
  assert.ok(src.indexOf('var playerBlurChoice') < src.indexOf('function attachVideo(video) {'),
    'per-element state is what YouTube rebuilding the player reset');
});

test('a reloading stream on the same video keeps the switch off', () => {
  const load = between("video.addEventListener('loadstart'", "markPending(video);",
    src.indexOf("video.addEventListener('loadstart'"));
  assert.ok(load.includes('playerBlurWantedNow()'), 'loadstart must ask before re-arming');
  assert.ok(!/playerBlurOn = true;/.test(load), 'an unconditional re-arm is the bug');
  assert.ok(load.includes('if (keepOff) return;'), 'and must not blur-first a kept-off video');
});

test('a pass in flight when the pill goes off cannot put the blur back', () => {
  const cover = between('function coverVideo() {', 'markFlagged(video);');
  assert.ok(cover.includes('isPlayer && !playerBlurOn) return'), 'the cover door is shut while off');
  const set = between('var setPlayerBlur = function (on, tapped) {', 'pillPaint();');
  assert.ok(set.includes('passEpoch++'), 'the in-flight person pass is dropped');
});

test('a different video goes back to its default', () => {
  const tick = between('var pillWatch', '}, 250);');
  assert.ok(tick.includes('var wantOn = playerBlurWantedNow();'), 'the watcher asks what is wanted');
  assert.ok(tick.includes('setPlayerBlur(wantOn, false)'), 'and follows it without recording a tap');
  const click = between("pill.addEventListener('click'", 'pillHost.appendChild(pill);');
  assert.ok(click.includes('setPlayerBlur(!playerBlurOn, true)'), 'only a tap is remembered');
});

test('the pill says Beta on a phone', () => {
  const pill = between('pill.appendChild(pillLabel);', 'pill.appendChild(pillTrack);');
  assert.ok(pill.includes('if (onPhone)') && pill.includes("'Beta'"));
});
