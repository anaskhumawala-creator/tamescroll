import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ps from '../src/person-skip.mjs';

test('personsLive is true until PERSON_EMPTY_STREAK empty passes, then false, and one admitted person revives it', () => {
  ps.resetPersonSkip();
  assert.equal(ps.personsLive(), true);
  for (let i = 0; i < ps.PERSON_EMPTY_STREAK; i++) {
    assert.equal(ps.personsLive(), true, 'still live before the streak completes');
    ps.notePersons([], false);
  }
  assert.equal(ps.personsLive(), false, 'dead after the streak');
  ps.notePersons([], true); // a skipped pass is not evidence either way
  assert.equal(ps.personsLive(), false);
  ps.notePersons([{ x1: 0, y1: 0, x2: 1, y2: 1 }], false);
  assert.equal(ps.personsLive(), true, 'one admitted person revives');
  ps.resetPersonSkip();
});
