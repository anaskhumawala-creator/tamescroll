// THE ONLY EVIDENCE FOUR PLATFORMS HAVE, AND IT HAD NO COUNTER.
//
// On Reddit, X, Instagram and Facebook `isPlayer` is false (findings 16),
// so `wholeFrameFlagged` IS the pipeline: one boolean per frame, four
// clean samples to reveal the video. A frame where the detector finds
// nothing is indistinguishable from a frame with nobody in it --
// `cleanStreak++` either way.
//
// 16a asserted the 1089 letterbox could not make a frame blind. The
// phase-E critic measured 3 blind frames in 241 where the squash had 0,
// 79% of the lost detections under 64px -- his own band. The claim was
// wrong because nothing counted it, which is the loop-34 shape: a
// counter that does not exist reads exactly like a counter at zero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildReport } from '../src/diag-report.mjs';

const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('BOTH detector paths count a frame that found nothing', () => {
  // There are two, and instrumenting one is worse than instrumenting
  // neither: the worker path is what runs on his phone and the in-page
  // path is what runs when the worker is dead or on CPU, so a counter on
  // one arm silently describes a different population run to run. The
  // 08-31 small-face bench had exactly this defect -- two producers of
  // control crops, one patched -- and it read 1 of 81 instead of 77.
  const hits = page.match(/wholeFrameLife\('wholeFrameNoFaces'\)/g) || [];
  assert.equal(hits.length, 2, 'the worker path AND the in-page path');
});

test('the reveal is counted apart from the blind frame', () => {
  // They are different events and they want different fixes. A blind
  // frame is a detector question; a reveal is the blind frames REACHING
  // the user, and only the second is an exposure. Counting one number
  // for both is how `birthClaimed` lost a round of analysis (R17).
  const idx = page.indexOf("wholeFrameLife('wholeFrameCleared')");
  const clear = page.indexOf('clearEl(video)', idx);
  assert.ok(idx !== -1, 'the reveal is counted');
  assert.ok(clear !== -1 && clear - idx < 200, 'counted at the reveal itself');
  // And the denominator, or a count of blind frames says nothing about
  // a rate.
  assert.match(page, /wholeFrameLife\('wholeFrameSamples'\)/);
});

test('all three are seeded, so absent cannot be mistaken for never-hooked', () => {
  assert.match(page, /d\.life\.wholeFrameSamples === undefined/);
  assert.match(page, /d\.life\.wholeFrameNoFaces = 0;/);
  assert.match(page, /d\.life\.wholeFrameCleared = 0;/);
});

test('and they reach the report, zeros included', () => {
  // `player.life` is a shape-checked pass-through since loop 37e, so this
  // should hold for any numeric key -- and it is asserted rather than
  // assumed, because for a fortnight it was a six-key WHITELIST and
  // roughly thirty counters never left the device.
  const r = buildReport({
    ids: { life: { wholeFrameSamples: 240, wholeFrameNoFaces: 3, wholeFrameCleared: 0 } },
  });
  assert.equal(r.player.life.wholeFrameSamples, 240);
  assert.equal(r.player.life.wholeFrameNoFaces, 3);
  assert.equal(r.player.life.wholeFrameCleared, 0, 'a zero is evidence and must survive');
});

// WHO WRITES A COUNTER, as opposed to who MENTIONS it.
//
// Phase-g G9: the first version of this matched the bare NAME anywhere
// in a file, so three comment lines in `init-entry.js` explaining that
// `clampFired` was taken counted as ownership. That is wrong in both
// directions -- it turns red when somebody documents a counter in a
// second module, and its red-proof fixture demonstrated only that a
// twice-MENTIONED name trips the sweep, never a twice-WRITTEN one. A
// collision is two modules INCREMENTING one key; nothing else is.
//
// Comments are stripped first, and only a bump SITE counts: the literal
// passed to `bumpLife`/`bump`/`bumpArm`, or a `life[...]` write.
export function ownersOf(name, entries) {
  const owners = [];
  for (const [file, src] of entries) {
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    // WHAT COUNTS AS A WRITE, and the shape of it took three tries.
    //
    // The literal need not follow the paren: `person-track` bumps out of
    // a ternary -- `bumpLife(drawn === padded ? 'clampNoLegalEdge' :
    // 'clampFired')` -- so anchoring on `bump(` + quote reported ZERO
    // owners for the very name this check is named after. And the bump
    // helper is not always called `bump*`: `init-entry` writes through a
    // local `wholeFrameLife(...)`. Enumerating helper names is how a
    // check like this goes quietly stale, so the rule is structural:
    //   - the name reached as a property of a `life` bag, or
    //   - the name QUOTED on a line that also calls a bump-shaped helper
    //     (anything ending in `Life(`, or `bump`), or
    //   - the name SEEDED to 0, quoted or bare -- seeding from a second
    //     module is exactly how a counter silently changes meaning.
    const q = '[\'"`]';
    const bump = new RegExp(
      '\\.life\\.' + name + '\\b'
      + '|life\\s*\\[\\s*' + q + name + q
      + '|(?:bump\\w*|\\w*Life)\\s*\\([^\\n]*' + q + name + q
      + '|' + q + '?' + name + q + '?\\s*:\\s*0');
    if (bump.test(code)) owners.push(file);
  }
  return owners;
}

function srcEntries() {
  const dir = new URL('../src/', import.meta.url);
  return readdirSync(dir)
    .filter((f) => /\.(mjs|js)$/.test(f))
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]);
}

test('the name is new -- it does not rebase an existing counter', () => {
  // A new counter reusing an old name merges two unrelated events into
  // one number and silently rebases every reading any earlier round has
  // quoted. `clampFired` was taken once (loop 39) and this is the class
  // of check that caught it.
  //
  // THE SWEEP IS THE WHOLE MODULE TREE. The first version grepped
  // `init-entry.js` alone (phase-f F7), and a check scoped to one file
  // cannot see a collision BETWEEN files, which is what that one was.
  const entries = srcEntries();
  assert.ok(entries.length > 10, `precondition: the sweep found only ${entries.length} modules`);
  for (const name of ['wholeFrameSamples', 'wholeFrameNoFaces', 'wholeFrameCleared']) {
    const owners = ownersOf(name, entries);
    assert.deepEqual(owners, ['init-entry.js'],
      `${name} is written by ${owners.join(', ') || 'nothing'} -- a counter `
      + 'bumped from two modules merges two unrelated events into one number');
    const uses = (page.match(new RegExp(name, 'g')) || []).length;
    // Seed + bump sites only. If this rises sharply somebody has started
    // bumping it from a second, unrelated place inside the owner too.
    assert.ok(uses >= 2 && uses <= 6, `${name} appears ${uses} times`);
  }
});

test('that sweep can actually fail -- two WRITERS are caught, a comment is not', () => {
  // Red-before-green, kept as a test rather than a one-off, because this
  // repo has three times shipped a check that could not fail.
  //
  // The fixture is SYNTHETIC on purpose. The previous one used
  // `clampFired` and asserted it was "still written by two modules" --
  // it is written by exactly one (`person-track.mjs`) and merely
  // discussed in another, so the proof proved the bug rather than the
  // check (phase-g G9). There is no real two-writer collision in the
  // tree today, and manufacturing one in `src/` to test a test is not
  // an option, so the sweep is exercised as the pure function it now is.
  const two = [
    ['a.mjs', 'function f(){ bumpLife("ghostFired"); }'],
    ['b.mjs', 'function g(){ bumpArm(\'ghostFired\'); }'],
  ];
  assert.deepEqual(ownersOf('ghostFired', two), ['a.mjs', 'b.mjs'],
    'two modules bumping one key must both be reported');

  // And the false positive the old version had: a mention is not a write.
  const mention = [
    ['a.mjs', 'function f(){ bumpLife("ghostFired"); }'],
    ['b.mjs', '// NOT `ghostFired` -- that name is TAKEN by a.mjs\nvar x = 1;'],
    ['c.mjs', '/* ghostFired is documented here, never written */'],
  ];
  assert.deepEqual(ownersOf('ghostFired', mention), ['a.mjs'],
    'a comment naming a counter must not read as a second owner');

  // A seed counts as a write: seeding from a second module is exactly
  // how a counter silently changes meaning.
  assert.deepEqual(ownersOf('seedName', [['s.mjs', 'life = { seedName: 0 };']]), ['s.mjs']);

  // The live tree agrees with the point of the fixture.
  assert.deepEqual(ownersOf('clampFired', srcEntries()), ['person-track.mjs'],
    'clampFired has exactly one writer -- the collision it is famous for '
    + 'was resolved, and the comments about it are not owners');
});
