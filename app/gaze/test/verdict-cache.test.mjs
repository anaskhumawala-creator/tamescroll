import { test } from 'node:test';
import assert from 'node:assert';
import { makeVerdictCache, verdictKey, VERDICT_CACHE_MAX } from '../src/verdict-cache.mjs';

test('the exact url is the key, and the nsfw question is part of it', () => {
  const a = verdictKey('https://yt3.ggpht.com/abc=s68', false);
  const b = verdictKey('https://yt3.ggpht.com/abc=s68', true);
  assert.ok(a && b);
  assert.notStrictEqual(a, b, 'a face-only verdict must not answer for a full one');
});

test('urls that cannot repeat cheaply are refused', () => {
  assert.strictEqual(verdictKey('', false), null);
  assert.strictEqual(verdictKey(null, false), null);
  assert.strictEqual(verdictKey('data:image/png;base64,AAAA', false), null);
});

test('a stored verdict comes back for the same url and not for another', () => {
  const c = makeVerdictCache();
  const v = { face: true, flagBoxes: [{ x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.5 }], nsfw: false, reads: [] };
  c.set(verdictKey('https://example.com/a.jpg', false), v);
  assert.strictEqual(c.get(verdictKey('https://example.com/a.jpg', false)), v);
  assert.strictEqual(c.get(verdictKey('https://example.com/b.jpg', false)), null);
  assert.strictEqual(c.get(verdictKey('https://example.com/a.jpg', true)), null);
});

test('an error is never cached -- one transient failure must not cover a url forever', () => {
  const c = makeVerdictCache();
  assert.strictEqual(c.set(verdictKey('https://example.com/a.jpg', false), { error: true }), false);
  assert.strictEqual(c.get(verdictKey('https://example.com/a.jpg', false)), null);
});

test('it is bounded, and the oldest key is the one that goes', () => {
  const c = makeVerdictCache(3);
  for (const n of ['a', 'b', 'c', 'd']) c.set('k' + n, { face: false });
  assert.strictEqual(c.size, 3);
  assert.strictEqual(c.get('ka'), null);
  assert.ok(c.get('kd'));
});

test('re-storing a key refreshes its place in the queue', () => {
  const c = makeVerdictCache(2);
  c.set('k1', { face: false });
  c.set('k2', { face: false });
  c.set('k1', { face: true });
  c.set('k3', { face: false });
  assert.ok(c.get('k1'), 'k1 was touched most recently and must survive');
  assert.strictEqual(c.get('k2'), null);
});

test('the default cap is a real bound', () => {
  assert.ok(VERDICT_CACHE_MAX > 0 && VERDICT_CACHE_MAX <= 1000);
});
