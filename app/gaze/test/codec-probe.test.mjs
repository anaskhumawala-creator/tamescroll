// codec-probe: which codec family the player opened its buffer with.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const cp = await import('../src/codec-probe.mjs');

test('family: video mimes map to a closed set, audio and junk to null', () => {
  assert.equal(cp.family('video/mp4; codecs="av01.0.08M.08"'), 'av01');
  assert.equal(cp.family('video/webm; codecs="vp09.00.41.08"'), 'vp09');
  assert.equal(cp.family('video/mp4; codecs="avc1.640028"'), 'avc1');
  assert.equal(cp.family('video/mp4; codecs="hev1.1.6.L93.B0"'), 'other');
  assert.equal(cp.family('audio/mp4; codecs="mp4a.40.2"'), null);
  assert.equal(cp.family(''), null);
  assert.equal(cp.family(null), null);
});

test('install wraps addSourceBuffer and changeType, calls through, and records the last VIDEO family', () => {
  cp._resetForTest();
  const log = [];
  class MS {
    addSourceBuffer(t) { log.push('add:' + t); return { type: t }; }
  }
  class SB {
    changeType(t) { log.push('change:' + t); }
  }
  const g = { MediaSource: MS, SourceBuffer: SB };
  assert.equal(cp.install(g), true);
  assert.equal(cp.install(g), true, 'idempotent');
  const ms = new MS();
  const sb = ms.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');
  assert.deepEqual(sb, { type: 'audio/mp4; codecs="mp4a.40.2"' }, 'call-through returns the real buffer');
  assert.deepEqual(cp.served(), { codec: 'none', codecChanges: 0 }, 'audio does not count');
  ms.addSourceBuffer('video/mp4; codecs="av01.0.08M.08"');
  assert.deepEqual(cp.served(), { codec: 'av01', codecChanges: 1 });
  new SB().changeType('video/webm; codecs="vp09.00.41.08"');
  assert.deepEqual(cp.served(), { codec: 'vp09', codecChanges: 2 });
  new SB().changeType('video/webm; codecs="vp09.00.41.08"');
  assert.equal(cp.served().codecChanges, 2, 'same family is not a change');
  assert.equal(log.length, 4, 'every call reached the original');
  cp._resetForTest();
});

test('install on a page without MediaSource returns false and never throws', () => {
  cp._resetForTest();
  assert.equal(cp.install({}), false);
  assert.equal(cp.install(null), false);
  assert.equal(cp.install({ MediaSource: {} }), false);
  cp._resetForTest();
});
