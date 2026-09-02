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
  // uncoverVideo() = clearEl(video) + presenter.cover(false) (Stage B door).
  const clear = page.indexOf('uncoverVideo()', idx);
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
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// H5 (phase-h critic): the sweep above still could not see three shapes
// of a real write, and could not tell one shape of an unrelated mention
// from a real one. Fixtures A-G, docs/critic/phase-h.md:
//   B: a LOCAL HELPER not named `bump*`/`*Life` -- `init-entry`'s own
//      `wholeFrameLife` was already an exception to that naming pattern,
//      and there was never a reason to believe it was the last one.
//   C: an ALIAS of the `life` bag (`var L = ids.life; L.NAME = ...`) --
//      the property-write rule only ever looked for the literal word
//      `life`.
//   D: a KEY held in a local constant (`var K = 'NAME'; d.life[K] = ..`)
//      -- the bracket rule only ever looked for the literal name.
//   E: a comment starting right after a colon (`a: // NAME: 0 ...`) was
//      never stripped, because the old guard refused any `//` preceded
//      by `:` -- a rule with no purpose in this tree (there is no URL
//      scheme here for it to protect) that made an ordinary commented-out
//      object literal read as live code.
//   F: the SEEDED-TO-0 fallback matched the name inside a plain string
//      (`log('reset NAME: 0 ...')`) because it never required NAME to
//      sit in a property-key position -- immediately after `{`, `,` or
//      `(`, nothing but whitespace in between.
// KNOWN LIMIT, NOT FIXED (case G): `{ NAME: 0 }` inside an UNRELATED
// object literal (`export const EMPTY_REPORT = { wholeFrameSamples: 0 }`)
// is indistinguishable from a real seed by property-key position alone
// -- both are a bare identifier key at 0 right after a brace. Closing
// this needs more than syntax (tracing which object actually flows into
// the `life` bag), which is a heavier check than this file has ever
// tried to be. Narrowing case F is still worth doing without claiming
// case G solved; the ledger records it OPEN.
export function ownersOf(name, entries) {
  const q = '[\'"`]';
  const owners = [];
  for (const [file, src] of entries) {
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');

    // Case B: a local helper of any name, taking one parameter, that
    // writes that parameter as a `life[...]` key is a write site,
    // whatever it happens to be called.
    const helperNames = [];
    const fnRe = /function\s+(\w+)\s*\(\s*(\w+)\s*\)\s*{([^{}]*)}/g;
    let fm;
    while ((fm = fnRe.exec(code))) {
      const [, fnName, param, body] = fm;
      if (new RegExp('\\blife\\s*\\[\\s*' + param + '\\s*\\]').test(body)) {
        helperNames.push(fnName);
      }
    }

    // Case C: `var L = ids.life;` (or `= anything.life`) makes L an
    // alias for the bag -- a write through L counts exactly as `.life`
    // does.
    const aliases = ['life'];
    const aliasRe = /\b(?:var|let|const)\s+(\w+)\s*=\s*[^;\n]*\.life\b/g;
    let am;
    while ((am = aliasRe.exec(code))) aliases.push(am[1]);
    const base = aliases.map(escapeRe).join('|');

    // Case D: `var K = 'NAME';` makes K a stand-in for the literal name
    // in a bracket write.
    const keyAliases = [name];
    const keyAliasRe = new RegExp(
      '\\b(?:var|let|const)\\s+(\\w+)\\s*=\\s*' + q + escapeRe(name) + q, 'g');
    let km;
    while ((km = keyAliasRe.exec(code))) keyAliases.push(km[1]);
    const keyAlt = keyAliases.map(escapeRe).join('|');
    const helperAlt = helperNames.length ? '|' + helperNames.map(escapeRe).join('|') : '';

    const patterns = [
      // `<base>.NAME` -- direct, or through an alias of the bag.
      new RegExp('\\b(?:' + base + ')\\s*\\.\\s*' + escapeRe(name) + '\\b'),
      // `<base>[NAME]` / `<base>[K]` -- direct, or through a key alias.
      new RegExp('\\b(?:' + base + ')\\s*\\[\\s*(?:' + keyAlt + ')\\s*\\]'),
      // a bump-shaped helper, or a local helper proven to write the key
      // (case B), called with the literal name or a key alias of it.
      new RegExp('(?:bump\\w*|\\w*Life' + helperAlt + ')\\s*\\([^\\n]*'
        + q + '?(?:' + keyAlt + ')' + q + '?'),
      // seeded as a bare object-literal key, scoped to a property-key
      // POSITION -- immediately after `{`, `,` or `(`, whitespace only
      // in between -- so a sentence merely containing "NAME: 0" cannot
      // trip it (case F). Case G, an unrelated object at this same
      // position, is the documented, still-open limit above.
      new RegExp('[{,(]\\s*' + q + '?' + escapeRe(name) + q + '?\\s*:\\s*0\\b'),
    ];
    if (patterns.some((re) => re.test(code))) owners.push(file);
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

test('H5 (phase-h critic): the six shapes the sweep used to get wrong', () => {
  // Case A, the control: the real init-entry shape, restated small.
  const a = [['a.mjs', "d.life.wholeFrameSamples = (d.life.wholeFrameSamples||0)+1;"]];
  assert.deepEqual(ownersOf('wholeFrameSamples', a), ['a.mjs'], 'A: a plain write is still seen');

  // Case B: a local helper, not named bump*/*Life, that writes the
  // parameter it is given into the bag.
  const b = [['b.mjs', "function inc(k){ ids.life[k] = (ids.life[k]||0)+1; }\ninc('wholeFrameSamples');"]];
  assert.deepEqual(ownersOf('wholeFrameSamples', b), ['b.mjs'],
    'B: a same-named local helper is a write site whatever it is called');

  // Case C: an alias of the life bag.
  const c = [['c.mjs', "var L = window.__TS_GAZE_IDS.life; L.wholeFrameSamples = (L.wholeFrameSamples||0)+1;"]];
  assert.deepEqual(ownersOf('wholeFrameSamples', c), ['c.mjs'],
    'C: a write through an alias of `life` counts exactly as `.life` does');

  // Case D: the key held in a local constant instead of spelled out.
  const d = [['d.mjs', "var K='wholeFrameSamples';\nvar d=ids; d.life[K]=(d.life[K]||0)+1;"]];
  assert.deepEqual(ownersOf('wholeFrameSamples', d), ['d.mjs'],
    'D: a bracket write through a key alias still counts');

  // Case E: a comment sitting right after a colon must still be stripped
  // -- there is no reason in this tree for a colon to protect a `//`.
  const e = [['e.mjs', "var o={a:// wholeFrameSamples: 0 is what init-entry seeds\n1};"]];
  assert.deepEqual(ownersOf('wholeFrameSamples', e), [],
    'E: a comment is not a write, whatever precedes the //');

  // Case F: the name merely appears inside a sentence next to ": 0" --
  // not in a property-key position, so the seed fallback must not fire.
  const f = [['f.mjs', "log('reset wholeFrameSamples: 0 on a new video');"]];
  assert.deepEqual(ownersOf('wholeFrameSamples', f), [],
    'F: prose containing the name and ": 0" is not a seed');

  // Case G, the documented and still-open limit: an unrelated object
  // that happens to carry the same-named key at 0 is genuinely
  // indistinguishable from a real seed by property-key position alone.
  // Pinned here so a future tightening notices it changed, not to
  // claim the ambiguity is resolved.
  const g = [['g.mjs', "export const EMPTY_REPORT = { wholeFrameSamples: 0 };"]];
  assert.deepEqual(ownersOf('wholeFrameSamples', g), ['g.mjs'],
    'G (KNOWN LIMIT): an unrelated same-named key at 0 still reads as a '
    + 'seed -- recorded, not silently fixed');
});
