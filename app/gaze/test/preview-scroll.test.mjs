import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
const sample = src.slice(src.indexOf('function sampleOnce()'), src.indexOf('function sampleOnce()') + 2600);

test('a feed preview does not run a pass while the feed is scrolling', () => {
  assert.ok(sample.includes('feedPreview()'), 'sampleOnce must know a preview from a watch player');
  assert.ok(sample.includes('scrolling(performance.now())'), 'and must gate on the scroll signal');
});

test('the skipped preview is covered whole, never left exposed', () => {
  const i = sample.indexOf('feedPreview()');
  const gate = sample.slice(i, i + 260);
  // coverVideo() is the player's whole-cover door (Stage B wiring): it is
  // markFlagged(video) plus presenter.cover(true) when a delay presenter
  // is attached. delay-wired.test.mjs pins that the door does both.
  assert.ok(gate.includes('coverVideo()'), 'blur-first: a skipped pass must cover the video');
  assert.ok(gate.indexOf('return') > gate.indexOf('coverVideo'), 'cover before returning');
});

test('the watch player is never skipped -- that page has no preview', () => {
  const fn = src.slice(src.indexOf('function feedPreview()'), src.indexOf('function feedPreview()') + 320);
  assert.ok(fn.includes("'/watch'"), 'watch pages must be excluded by path');
  assert.ok(fn.includes('return false'), 'an unreadable path must not skip passes');
});

const mini = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');

test('the drag gesture never binds a non-passive listener off the watch page', () => {
  // Slice to the END of onDown, not a magic character count -- a fixed
  // window silently stops covering the function as comments grow.
  const down = mini.slice(
    mini.indexOf('function onDown('),
    mini.indexOf('function endDrag(')
  );
  assert.ok(down.includes('watchPage()'), 'onDown must refuse off /watch');
  assert.ok(
    down.indexOf('watchPage()') < down.indexOf('inPlayer(target)'),
    'the page check must come before the player check, or a feed preview still binds'
  );
});

test('a navigation off the watch page takes the listener back off', () => {
  assert.ok(mini.includes('removeEventListener('), 'unbindHost must actually remove it');
  // Slice to the END of onDown, not a magic character count -- a fixed
  // window silently stops covering the function as comments grow.
  const down = mini.slice(
    mini.indexOf('function onDown('),
    mini.indexOf('function endDrag(')
  );
  assert.ok(down.includes('unbindHost()'), 'and a touch off /watch must trigger it');
});

test('the only non-passive listener is on the player, never the document', () => {
  const doc = mini.split('doc.addEventListener').slice(1);
  for (const block of doc) {
    const head = block.slice(0, 400);
    assert.ok(!/passive:\s*false/.test(head), 'a non-passive document listener costs every scroll');
  }
});
