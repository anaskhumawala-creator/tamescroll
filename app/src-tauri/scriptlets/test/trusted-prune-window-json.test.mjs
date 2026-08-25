// Inline-JSON pruner: strips ad slots out of the player response that
// YouTube embeds in the watch page HTML, before the page reads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../trusted-prune-window-json.js', import.meta.url), 'utf8');

// Same shape as the sibling scriptlet tests: a real vm context, because
// the scriptlet installs an ACCESSOR on `window` and a plain object
// literal in this module's scope would not exercise that path.
function load() {
  const window = {};
  const ctx = { window, Object, JSON, Array, String };
  vm.createContext(ctx);
  vm.runInContext(SRC + ";this.__fn = trustedPruneWindowJson;", ctx);
  return { window: ctx.window, fn: ctx.__fn };
}

test('prunes named paths from the value as it is ASSIGNED', () => {
  const { window, fn } = load();
  fn('ytInitialPlayerResponse', 'adSlots', 'playerAds');
  window.ytInitialPlayerResponse = {
    adSlots: [1, 2, 3, 4],
    playerAds: [{}],
    videoDetails: { title: 'real video' },
  };
  const got = window.ytInitialPlayerResponse;
  assert.equal(got.adSlots, undefined);
  assert.equal(got.playerAds, undefined);
  // Everything the player actually needs must survive untouched —
  // over-pruning breaks playback, which is worse than an ad.
  assert.equal(got.videoDetails.title, 'real video');
});

test('prunes a value that was already assigned before we ran', () => {
  const { window, fn } = load();
  window.ytInitialPlayerResponse = { adSlots: [1], videoDetails: {} };
  fn('ytInitialPlayerResponse', 'adSlots');
  assert.equal(window.ytInitialPlayerResponse.adSlots, undefined);
  assert.ok(window.ytInitialPlayerResponse.videoDetails);
});

test('handles dotted paths and missing branches without throwing', () => {
  const { window, fn } = load();
  fn('x', 'a.b.c', 'nope.gone');
  window.x = { a: { b: { c: 1, d: 2 } } };
  assert.equal(window.x.a.b.c, undefined);
  assert.equal(window.x.a.b.d, 2);
});

test('a non-object assignment passes through unharmed', () => {
  const { window, fn } = load();
  fn('x', 'adSlots');
  window.x = null;
  assert.equal(window.x, null);
  window.x = 'string';
  assert.equal(window.x, 'string');
});

test('no paths given means do nothing at all', () => {
  const { window, fn } = load();
  fn('x');
  window.x = { adSlots: [1] };
  assert.deepEqual(window.x.adSlots, [1]);
});
