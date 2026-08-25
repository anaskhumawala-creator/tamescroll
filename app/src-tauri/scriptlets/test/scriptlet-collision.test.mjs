// Two scriptlets, one global property.
//
// This is the bug that let a pre-roll ad reach the owner twice. On a
// YouTube watch page the engine emits BOTH
//   trustedPruneWindowJson("ytInitialPlayerResponse", "adSlots", ...)
//   setConstant("ytInitialPlayerResponse.playerAds", "undefined")
// and each one installs an accessor on window.ytInitialPlayerResponse.
// Whichever ran second used to replace the first outright, so the first
// never observed the page's assignment at all. Measured live: the
// pruner's accessor was installed and won the race against the page, yet
// `adSlots` still held 5 entries when the player read it.
//
// Order is decided by the engine's emit order, which is not ours to
// control and changes as vendored lists change — so both orders are
// pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const PRUNE = readFileSync(new URL('../trusted-prune-window-json.js', import.meta.url), 'utf8');
const SETC = readFileSync(new URL('../set-constant.js', import.meta.url), 'utf8');

function load() {
  const window = {};
  const ctx = { window, Object, JSON, Array, String, Number, RegExp };
  vm.createContext(ctx);
  vm.runInContext(
    PRUNE + ';' + SETC + ';this.__prune = trustedPruneWindowJson;this.__setc = setConstant;',
    ctx,
  );
  return { window: ctx.window, prune: ctx.__prune, setc: ctx.__setc };
}

// The real watch-page player response, reduced to the fields that decide
// whether an ad plays plus one the player genuinely needs.
function playerResponse() {
  return {
    adSlots: [1, 2, 3, 4, 5],
    adPlacements: [{}],
    playerAds: [{}],
    adBreakHeartbeatParams: 'x',
    videoDetails: { title: 'real video' },
    streamingData: { formats: [] },
  };
}

function assertBothRan(got) {
  // The pruner's job.
  assert.equal(got.adSlots, undefined, 'adSlots survived — the pruner was clobbered');
  assert.equal(got.adPlacements, undefined, 'adPlacements survived');
  assert.equal(got.adBreakHeartbeatParams, undefined, 'adBreakHeartbeatParams survived');
  // set-constant's job. Pruned OR pinned to undefined both read as
  // undefined to the player, which is the outcome that matters.
  assert.equal(got.playerAds, undefined, 'playerAds survived');
  // And the player red line: nothing it needs may be collateral.
  assert.equal(got.videoDetails.title, 'real video');
  assert.ok(got.streamingData, 'streamingData must survive');
}

test('pruner first, set-constant second (the live emit order)', () => {
  const { window, prune, setc } = load();
  prune('ytInitialPlayerResponse', 'adSlots', 'adPlacements', 'playerAds', 'adBreakHeartbeatParams');
  setc('ytInitialPlayerResponse.playerAds', 'undefined');
  window.ytInitialPlayerResponse = playerResponse();
  assertBothRan(window.ytInitialPlayerResponse);
});

test('set-constant first, pruner second', () => {
  const { window, prune, setc } = load();
  setc('ytInitialPlayerResponse.playerAds', 'undefined');
  prune('ytInitialPlayerResponse', 'adSlots', 'adPlacements', 'playerAds', 'adBreakHeartbeatParams');
  window.ytInitialPlayerResponse = playerResponse();
  assertBothRan(window.ytInitialPlayerResponse);
});

test('reassignment keeps pruning — YouTube reassigns on SPA navigation', () => {
  const { window, prune, setc } = load();
  prune('ytInitialPlayerResponse', 'adSlots');
  setc('ytInitialPlayerResponse.playerAds', 'undefined');
  window.ytInitialPlayerResponse = playerResponse();
  window.ytInitialPlayerResponse = playerResponse();
  assert.equal(window.ytInitialPlayerResponse.adSlots, undefined);
  assert.equal(window.ytInitialPlayerResponse.playerAds, undefined);
  assert.equal(window.ytInitialPlayerResponse.videoDetails.title, 'real video');
});
