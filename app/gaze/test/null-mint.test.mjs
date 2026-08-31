// THE MINT GATE, TESTED AS BEHAVIOUR.
//
// An adversarial review of the first draft (2026-09-01) found three
// defects that a source-string test could not see, and the tests that
// were supposed to pin the fix were `page.includes(...)` assertions
// against init-entry.js. These construct observations and run the real
// tracker instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { updatePersonTracks } from '../src/person-track.mjs';
import * as gv from '../src/gender-verdict.mjs';
import { readFileSync } from 'node:fs';

const box = (x1, y1, x2, y2, extra) =>
  Object.assign({ x1, y1, x2, y2, confidence: 0.8 }, extra || {});

function obs(b, over) {
  return Object.assign({ box: b, flagged: true, certain: false }, over || {});
}

test('a nullMint observation cannot create a track', () => {
  const o = obs(box(0.1, 0.1, 0.3, 0.6, { fromFace: true, mintNoShape: true }), {
    nullRead: true,
    nullMint: true,
  });
  const tracks = updatePersonTracks([], [o], 250);
  assert.equal(tracks.length, 0, 'a null read on a graphic minted a patch');
});

test('a nullMint observation still REFRESHES a track that already exists', () => {
  // THE EXPOSURE THE REVIEW FOUND. A face-derived track can only be
  // refreshed by a verdict pass, so an observation that is dropped
  // rather than tagged runs the track out through coastStep and takes
  // the blur off somebody who was covered. The null band is a property
  // of CONTENT, so it lands on the same subject every single pass --
  // this is not a rare interleaving, it is the steady state for one
  // unlucky face.
  const b = box(0.1, 0.1, 0.3, 0.6, { fromFace: true, mintNoShape: true });
  let tracks = updatePersonTracks([], [obs(b)], 250);
  assert.equal(tracks.length, 1, 'setup: the track should exist');
  const id = tracks[0].id;

  // Ten consecutive passes where every read nulls.
  for (let i = 0; i < 10; i++) {
    tracks = updatePersonTracks(
      tracks,
      [obs(b, { nullRead: true, nullMint: true })],
      250
    );
    assert.equal(tracks.length, 1, `track died on pass ${i + 1} -- EXPOSURE`);
    assert.equal(tracks[0].id, id, 'the track was re-minted rather than refreshed');
  }
  assert.equal(tracks[0].state, 'blurred', 'a null read must never clear anybody');
});

test('a null read cannot be tagged on a MoveNet-admitted person', () => {
  // Only face-derived observations are eligible; a measured person is
  // never refused on the strength of a gender read. The tag is applied
  // upstream, so this pins the tracker half: an untagged observation
  // births normally even when its read nulls.
  const o = obs(box(0.4, 0.2, 0.6, 0.8), { nullRead: true });
  const tracks = updatePersonTracks([], [o], 250);
  assert.equal(tracks.length, 1, 'a measured person was refused');
});

test('a CHILD read is never a null read, whatever its age head says', () => {
  // THE ORDERING DEFECT. A null read has its age head pinned at the
  // training prior (~36.9 measured), which sits inside NULL_AGE_LO..HI
  // by construction -- so a genuine child carrying no signal reads as a
  // 36-year-old and was being routed to the null branch AHEAD of the
  // child branch. The mint gate keys off `nullRead`, so that ordering
  // refused a child: the exact subject the owner reported.
  //
  // The first version of this test used raw 0.97, which fails
  // isNullRead on its FIRST condition and therefore proved nothing.
  // These inputs are inside the band.
  const childInBand = {
    gender: 'male',
    score: 0.28,
    age: 36.9,
    raw: 0.635,
    childP: 0.9,
  };
  assert.equal(gv.isAdultRead === undefined, true, 'isAdultRead is module-private by design');
  const [m] = gv.faceMeta('man', [childInBand]);
  assert.notEqual(m.nullRead, true, 'a child read was refused as a null read');
  assert.equal(m.abstained, true, 'a child read must still abstain');

  // And the adult null read it must not stop catching.
  const [n] = gv.faceMeta('man', [
    { gender: 'male', score: 0.28, age: 36.9, raw: 0.635, childP: 0.02 },
  ]);
  assert.equal(n.nullRead, true, 'the adult null read stopped being caught');
});

test('the mint gate is scoped to frames where MoveNet admitted nobody', () => {
  // The review found the scope had WIDENED: the frame gate it replaces
  // was guarded by `noShape`, so without that guard this refuses
  // face-derived people in frames the old gate never touched -- the R16
  // case of a woman whose face fell inside the speaker's box. The tag
  // carries the frame condition on the person object because the mint
  // gate lives in a different closure from `noShape`.
  const src = new URL('../src/init-entry.js', import.meta.url);
  const page = readFileSync(src, 'utf8');
  assert.ok(page.includes('bounded.mintNoShape = !!noShape;'), 'the tag is not set');
  assert.ok(page.includes('obs.box.mintNoShape'), 'the mint gate lost its scope guard');
});
