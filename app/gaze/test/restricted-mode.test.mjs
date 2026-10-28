// Restricted Mode by page kind (his 2026-10-28): the PREF bit flips, and
// nothing else in YouTube's cookie may move with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefRestricted, prefWithRestricted, wantRestricted } from '../src/restricted-mode.mjs';

test('an empty or missing PREF is not restricted', () => {
  assert.equal(prefRestricted(''), false);
  assert.equal(prefRestricted(undefined), false);
  assert.equal(prefRestricted('f6=40000000&tz=Asia.Calcutta'), false);
});

test('the restricted bit is read out of f2 among other flags', () => {
  assert.equal(prefRestricted('f2=8000000'), true);
  assert.equal(prefRestricted('tz=Asia.Calcutta&f2=8000400&f6=40000000'), true);
  assert.equal(prefRestricted('f2=400'), false);
  assert.equal(prefRestricted('xf2=8000000'), false, 'only the f2 key counts');
});

test('turning it on keeps every other key and flag', () => {
  const out = prefWithRestricted('tz=Asia.Calcutta&f2=400&f6=40000000', true);
  assert.equal(prefRestricted(out), true);
  assert.match(out, /(^|&)tz=Asia\.Calcutta(&|$)/);
  assert.match(out, /(^|&)f6=40000000(&|$)/);
  assert.match(out, /(^|&)f2=8000400(&|$)/, 'the other f2 flag survives');
});

test('turning it off clears only the bit, and drops an empty f2', () => {
  assert.equal(prefWithRestricted('f2=8000400', false), 'f2=400');
  assert.equal(prefWithRestricted('tz=X&f2=8000000', false), 'tz=X');
  assert.equal(prefRestricted(prefWithRestricted('f2=8000000', false)), false);
});

test('on from nothing, off back to nothing', () => {
  assert.equal(prefWithRestricted('', true), 'f2=8000000');
  assert.equal(prefWithRestricted('', false), '');
});

test('only the watch page is unrestricted', () => {
  assert.equal(wantRestricted('watch'), false);
  for (const k of ['home', 'search', 'channel', 'feed', 'other']) {
    assert.equal(wantRestricted(k), true, k);
  }
});
