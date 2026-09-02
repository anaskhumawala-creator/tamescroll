// Stage B wiring (Task 10, plan 2026-09-02): the delay presenter and
// the verdict timeline are wired into the player loop in init-entry.js.
// This is a STRUCTURAL test: init-entry.js is a page script that cannot
// be imported under node, so it asserts the shape of the wiring by
// reading the source. Comments are stripped first (phase-G G9: a
// twice-MENTIONED name is not a call site).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DELAY_MS } from '../src/delay-core.mjs';
import { tunableNames } from '../src/tuning.mjs';

const RAW = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function between(startMarker, endMarker) {
  const a = SRC.indexOf(startMarker);
  assert.ok(a >= 0, `marker missing: ${startMarker}`);
  const b = SRC.indexOf(endMarker, a);
  assert.ok(b > a, `end marker missing: ${endMarker}`);
  return SRC.slice(a, b);
}

test('init-entry imports the three Stage B modules', () => {
  assert.match(SRC, /import \* as delayCore from '\.\/delay-core\.mjs';/);
  assert.match(SRC, /import \{ attachDelay \} from '\.\/delay-presenter\.mjs';/);
  assert.match(SRC, /import \{ makeTimeline, pushSnapshot, pushCut, boxesAt, latestSnapshot \} from '\.\/track-timeline\.mjs';/);
});

test('the presenter attaches only for a region-mode WATCH player with DELAY_MS > 0', () => {
  const fn = between('function delayWanted()', 'function delayAttach()');
  assert.match(fn, /isPlayer && useRegionVideo && !feedPreview\(\) && delayCore\.DELAY_MS > 0/);
});

test('attach hands the renderer a timeline and counts a late verdict', () => {
  const fn = between('function delayAttach()', 'function delayDetach()');
  assert.match(fn, /attachDelay\(video, host, \{ delayMs: delayCore\.DELAY_MS/);
  assert.match(fn, /videoRegion\.setTimeline\(video,/);
  assert.match(fn, /boxesAt\(timeline, m\)/);
  assert.match(fn, /bumpLife\('delayVerdictLate'\)/);
  // Blur-first: the canvas starts covered.
  assert.match(fn, /presenter\.cover\(true\)/);
  assert.match(fn, /__TS_DELAY_STATS = function/);
});

test('detach clears the renderer timeline and tears the presenter down', () => {
  const fn = between('function delayDetach()', 'function coverVideo()');
  assert.match(fn, /videoRegion\.clearTimeline\(video\)/);
  assert.match(fn, /p\.detach\(\)/);
});

test('every whole-cover decision on the player drives presenter.cover', () => {
  const cover = between('function coverVideo()', 'function uncoverVideo()');
  assert.match(cover, /markFlagged\(video\)/);
  assert.match(cover, /presenter\.cover\(true\)/);
  const uncover = between('function uncoverVideo()', 'var heldPersons = [];');
  assert.match(uncover, /clearEl\(video\)/);
  assert.match(uncover, /presenter\.cover\(false\)/);
  // After the delay-line block, no bare markFlagged/clearEl on the
  // player remains inside attachVideo EXCEPT inside the two doors and
  // giveUp (which detaches first) -- count them.
  const body = SRC.slice(SRC.indexOf('var heldPersons = [];'));
  const bare = (body.match(/markFlagged\(video\)/g) || []).length;
  assert.equal(bare, 0, 'a bare markFlagged(video) bypasses presenter.cover');
  const bareClear = (body.match(/clearEl\(video\)/g) || []).length;
  // giveUp, pill-off: both call delayDetach() first, so the bare
  // clearEl there is on a video with no presenter.
  assert.equal(bareClear, 2, 'a bare clearEl(video) outside giveUp/pill-off bypasses presenter.cover');
  for (const m of body.matchAll(/clearEl\(video\)/g)) {
    const before = body.slice(Math.max(0, m.index - 400), m.index);
    assert.match(before, /delayDetach\(\)/, 'bare clearEl(video) without a preceding delayDetach()');
  }
});

test('a verdict pass reads the newest ring frame and the tracker result is snapshotted at its media time', () => {
  const pass = between('function runPass(withFaces, mark, keepFrame)', 'function gateTick(now)');
  assert.match(pass, /presenter\.requestVerdictFrame\(\)/);
  assert.match(pass, /passMediaTime = r\.mediaTime/);
  assert.match(pass, /passMediaTime = video\.currentTime/);
  // The DRAWN geometry is snapshotted, never the raw tracker box: the
  // render padding, the R27 directional clamp and the merge would
  // otherwise never reach a presented frame (2026-09-02, the Linus
  // false-cover root cause).
  assert.match(SRC, /nullHeld = videoTracks\.nullHeld \|\| \[\];\s*if \(presenter\) pushSnapshot\(timeline, passMediaTime, presentTracks\(videoTracks\)\);/);
  assert.match(SRC, /var b = boxesAt\(timeline, m\);\s*if \(!b\) \{\s*bumpLife\('delayVerdictLate'\);\s*lastTarget = null;\s*return null;\s*\}[\s\S]{0,600}?var merged = mergePresented\(b\);\s*lastTarget = \{ m: m, entries: b, merged: merged \};\s*return merged;/);
});

test('a scene cut reaches the timeline', () => {
  assert.match(SRC, /bumpLife\('cutDetected'\);\s*if \(presenter\) pushCut\(timeline, video\.currentTime\);/);
});

test('start attaches (pill on), pill off and giveUp detach, loadstart restarts the timeline covered', () => {
  const start = between('function start() {', 'function stop() {');
  assert.match(start, /if \(playerBlurOn\) delayAttach\(\);/);
  const giveUp = between('function giveUp(reason, err)', 'identityMem = createIdentityMemory();');
  assert.match(giveUp, /delayDetach\(\);/);
  assert.match(SRC, /timeline = makeTimeline\(delayCore\.DELAY_MS \+ 2000\);\s*presenter\.cover\(true\);/);
  assert.match(SRC, /delayDetach\(\);\s*clearEl\(video\);\s*videoRegion\.clear\(video\);\s*regionActive = false;\s*videoTracks = \[\];/);
});

test('the delayVerdictLate counter is seeded so absent cannot read as never-hooked', () => {
  assert.match(SRC, /lf\.delayVerdictLate = lf\.delayVerdictLate \|\| 0;/);
});

test('DELAY_MS ships at 1500 on the OTA channel, 0 = off (measured 2026-09-02, delay-core.mjs)', () => {
  assert.equal(DELAY_MS, 1500);
  assert.ok(tunableNames().includes('DELAY_MS'));
});
