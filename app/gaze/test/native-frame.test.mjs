// The wire format between the page and the native tensor runner
// (native-frame.mjs). No port, no transport -- just bytes in, bytes or
// a decoded object out, so this is testable with hand-built buffers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRequest, decodeReply, parseReady } from '../src/native-frame.mjs';

test('encodeRequest header is little-endian and the buffer length is 16 + w*h*4', () => {
  const w = 2;
  const h = 1;
  const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const buf = encodeRequest(7, 3, w, h, rgba);
  assert.equal(buf.byteLength, 16 + w * h * 4);
  const bytes = new Uint8Array(buf);
  assert.deepEqual([...bytes.slice(0, 4)], [7, 0, 0, 0], 'reqId LE');
  assert.deepEqual([...bytes.slice(4, 8)], [3, 0, 0, 0], 'modelId LE');
  assert.deepEqual([...bytes.slice(8, 12)], [2, 0, 0, 0], 'width LE');
  assert.deepEqual([...bytes.slice(12, 16)], [1, 0, 0, 0], 'height LE');
  assert.deepEqual([...bytes.slice(16)], [1, 2, 3, 4, 5, 6, 7, 8], 'rgba payload verbatim');
});

test('encodeRequest refuses an rgba buffer of the wrong length', () => {
  assert.throws(() => encodeRequest(1, 1, 2, 2, new Uint8Array(4)), /rgba length/);
});

test('decodeReply round-trips a hand-built reply carrying two outputs', () => {
  const out0 = new Float32Array([1.5, -2.5]);
  const out1 = new Float32Array([3]);
  const total = 16 + 4 + out0.byteLength + 4 + out1.byteLength;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setUint32(0, 9, true); // reqId
  dv.setUint32(4, 0, true); // status ok
  dv.setUint32(8, 2, true); // nOutputs
  dv.setUint32(12, 1234, true); // elapsedUs
  let off = 16;
  dv.setUint32(off, out0.byteLength, true);
  off += 4;
  new Uint8Array(buf, off, out0.byteLength).set(new Uint8Array(out0.buffer));
  off += out0.byteLength;
  dv.setUint32(off, out1.byteLength, true);
  off += 4;
  new Uint8Array(buf, off, out1.byteLength).set(new Uint8Array(out1.buffer));

  const r = decodeReply(buf);
  assert.equal(r.reqId, 9);
  assert.equal(r.status, 0);
  assert.equal(r.elapsedUs, 1234);
  assert.equal(r.outputs.length, 2);
  assert.deepEqual([...r.outputs[0]], [1.5, -2.5]);
  assert.deepEqual([...r.outputs[1]], [3]);
});

test('a reply declaring an output longer than the buffer throws, not a short array', () => {
  const buf = new ArrayBuffer(16 + 4 + 8); // 8 real bytes follow the length field
  const dv = new DataView(buf);
  dv.setUint32(0, 1, true);
  dv.setUint32(4, 0, true);
  dv.setUint32(8, 1, true); // nOutputs = 1
  dv.setUint32(12, 0, true);
  dv.setUint32(16, 16, true); // declares 16 bytes, only 8 remain
  assert.throws(() => decodeReply(buf), /truncated/);
});

test('a header shorter than 16 bytes throws', () => {
  assert.throws(() => decodeReply(new ArrayBuffer(8)), /truncated header/);
});

test('a byteLength not divisible by 4 throws', () => {
  const buf = new ArrayBuffer(16 + 4 + 6);
  const dv = new DataView(buf);
  dv.setUint32(0, 1, true);
  dv.setUint32(4, 0, true);
  dv.setUint32(8, 1, true);
  dv.setUint32(12, 0, true);
  dv.setUint32(16, 6, true); // not a multiple of 4
  assert.throws(() => decodeReply(buf), /multiple of 4/);
});

test('a reply carrying zero outputs decodes to an empty array', () => {
  const buf = new ArrayBuffer(16);
  const dv = new DataView(buf);
  dv.setUint32(0, 5, true);
  dv.setUint32(4, 1, true); // status error
  dv.setUint32(8, 0, true);
  dv.setUint32(12, 77, true);
  const r = decodeReply(buf);
  assert.equal(r.reqId, 5);
  assert.equal(r.status, 1);
  assert.equal(r.elapsedUs, 77);
  assert.deepEqual(r.outputs, []);
});

test('parseReady understands native-ready and native-failed, and ignores anything else', () => {
  const ok = parseReady(
    JSON.stringify({ type: 'native-ready', backend: 'gpu', models: [{ id: 1, name: 'blazeface' }], initMs: 42 })
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.backend, 'gpu');
  assert.equal(ok.initMs, 42);
  assert.equal(ok.models.length, 1);

  const fail = parseReady(JSON.stringify({ type: 'native-failed', why: 'no gpu delegate' }));
  assert.equal(fail.ok, false);
  assert.equal(fail.why, 'no gpu delegate');

  assert.equal(parseReady(JSON.stringify({ type: 'something-else' })), null);
  assert.equal(parseReady('not json'), null);
  assert.equal(parseReady('null'), null);
});
