// native-client CONFIG request (performance batch 2026-09-03): a bare
// 16-byte header with modelId 0, the CPU mask in `w`, flags in `h` --
// sent after EVERY native-ready (phase-n: the engine outlives the
// document, so the previous page's mask would otherwise leak).
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeCtx {
  clearRect() {}
  fillRect() {}
  drawImage() {}
  getImageData() { return { data: new Uint8ClampedArray(4) }; }
}
class FakeOffscreenCanvas {
  constructor(w, h) { this.width = w; this.height = h; this._ctx = new FakeCtx(); }
  getContext() { return this._ctx; }
}
globalThis.OffscreenCanvas = FakeOffscreenCanvas;

const nc = await import('../src/native-client.mjs');

function makeFakePort() {
  const sent = [];
  const port = { postMessage(d) { sent.push(d); }, onmessage: null };
  port.sent = sent;
  port.emit = (d) => port.onmessage({ data: d });
  return port;
}
function header(buf) {
  const dv = new DataView(buf);
  return { reqId: dv.getUint32(0, true), modelId: dv.getUint32(4, true), w: dv.getUint32(8, true), h: dv.getUint32(12, true), bytes: buf.byteLength };
}
const READY = JSON.stringify({ type: 'native-ready', backend: 'gpu', npu: 'absent', backends: { 1: 'gpu', 2: 'gpu', 3: 'gpu' }, models: [{ id: 1, name: 'blazeface' }, { id: 2, name: 'faceres' }, { id: 3, name: 'movenet' }] });

test('defaults: ONE CONFIG (mask 0, NPU off) is sent after ready, and the ready message\'s backends land in the snapshot', async () => {
  nc.setNativeCpuMask(0);
  nc.setNativeNpu(0);
  assert.equal(nc.NATIVE_NPU, 0, 'ships 0 (phase-n N1)');
  const port = makeFakePort();
  const client = nc.createNativeClient(port);
  port.emit(READY);
  await client.ready;
  assert.equal(port.sent.length, 1, 'always sent: a mask the previous document set must not leak');
  assert.deepEqual(header(port.sent[0]), { reqId: 1, modelId: 0, w: 0, h: 0, bytes: 16 });
  assert.deepEqual(client.snapshot(), { backend: 'gpu', npu: 'absent', backends: { 1: 'gpu', 2: 'gpu', 3: 'gpu' }, dead: false });
});

test('NATIVE_CPU_MASK > 0 sends one CONFIG (modelId 0, w = mask, h = flags) right after ready', async () => {
  nc.setNativeCpuMask(5);
  nc.setNativeNpu(1);
  const port = makeFakePort();
  const client = nc.createNativeClient(port);
  port.emit(READY);
  await client.ready;
  assert.equal(port.sent.length, 1);
  assert.deepEqual(header(port.sent[0]), { reqId: 1, modelId: 0, w: 5, h: 1, bytes: 16 });
  nc.setNativeCpuMask(0);
});

test('NATIVE_NPU 1 sends the CONFIG with the NPU flag set at mask 0', async () => {
  nc.setNativeCpuMask(0);
  nc.setNativeNpu(1);
  const port = makeFakePort();
  const client = nc.createNativeClient(port);
  port.emit(READY);
  await client.ready;
  assert.equal(port.sent.length, 1);
  assert.deepEqual(header(port.sent[0]), { reqId: 1, modelId: 0, w: 0, h: 1, bytes: 16 });
  nc.setNativeNpu(0);
});

test('the mask is clamped to 0..7 and the CONFIG ack resolves like any reply', async () => {
  nc.setNativeCpuMask(99);
  assert.equal(nc.NATIVE_CPU_MASK, 7);
  nc.setNativeCpuMask(-3);
  assert.equal(nc.NATIVE_CPU_MASK, 0);
  const port = makeFakePort();
  const client = nc.createNativeClient(port);
  port.emit(READY);
  await client.ready;
  const p = client.configure(2, 1);
  assert.equal(port.sent.length, 2, 'the ready CONFIG and this one');
  for (const buf of port.sent) {
    const h = header(buf);
    assert.equal(h.modelId, 0);
    // an empty-outputs status-0 reply, NativeInfer's ack shape
    const reply = new ArrayBuffer(16);
    const dv = new DataView(reply);
    dv.setUint32(0, h.reqId, true);
    dv.setUint32(4, 0, true);
    dv.setUint32(8, 0, true);
    dv.setUint32(12, 0, true);
    port.emit(reply);
  }
  await p;
  assert.equal(client.dead(), false);
});
