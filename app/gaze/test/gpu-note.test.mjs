import test from 'node:test';
import assert from 'node:assert';
import { gpuNote, reportViolations } from '../src/diag-report.mjs';
import { parseReady } from '../src/native-frame.mjs';

// 1101. His Redmi 13 read `cpu` on every model with NO reason anywhere
// but logcat, because `isDelegateSupportedOnThisDevice` answers out of
// a device database frozen when tensorflow-lite-gpu 2.16.1 was built.
// These pin that the reason now reaches the report, and that it reaches
// it in a shape `reportViolations` accepts -- free text only under `R`.

test('gpuNote is null when the engine reported nothing', () => {
  assert.equal(gpuNote(null, '1'), null);
  assert.equal(gpuNote({}, '1'), null);
  assert.equal(gpuNote({ 2: { listed: true } }, '1'), null);
});

test('gpuNote carries the unlisted-device story', () => {
  const n = gpuNote({ 1: { listed: false, remembered: false, tried: false, ran: true, agree: true, won: true, gpuMs: 84, cpuMs: 210 } }, '1');
  assert.equal(n.listed, false);
  assert.equal(n.ran, true);
  assert.equal(n.won, true);
  assert.equal(n.gpuMs, 84);
  assert.equal(n.cpuMs, 210);
  assert.equal(n.whyR, null);
});

test('gpuNote keeps -1 as "not measured" rather than turning it into 0', () => {
  const n = gpuNote({ 3: { listed: true, tried: true, gpuMs: -1, cpuMs: -1 } }, '3');
  assert.equal(n.gpuMs, -1);
  assert.equal(n.cpuMs, -1);
});

test('a delegate failure message is redacted, never raw', () => {
  const n = gpuNote({ 1: { whyR: 'GPU delegate: failed to load https://example.com/x?id=abcdefghijk' } }, '1');
  assert.equal(typeof n.whyR, 'string');
  assert.equal(n.whyR.indexOf('://'), -1);
  assert.equal(n.whyR.indexOf('example.com'), -1);
});

test('the gpu note survives the report violation walker', () => {
  const report = {
    native: {
      models: {
        face: { gpu: gpuNote({ 1: { listed: false, ran: true, agree: false, won: false, gpuMs: 300, cpuMs: 210, whyR: 'delegate refused' } }, '1') },
      },
    },
  };
  assert.deepEqual(reportViolations(report, 'about:blank'), []);
});

test('parseReady passes the gpu block through on ready and on an update', () => {
  const ready = parseReady(JSON.stringify({ type: 'native-ready', backend: 'cpu', gpu: { 1: { listed: false } } }));
  assert.equal(ready.gpu['1'].listed, false);
  const upd = parseReady(JSON.stringify({ type: 'native-backends', backend: 'gpu', gpu: { 1: { won: true } } }));
  assert.equal(upd.update, true);
  assert.equal(upd.gpu['1'].won, true);
  // A build that sends no gpu block (1100 and earlier) must not throw.
  assert.equal(parseReady(JSON.stringify({ type: 'native-ready', backend: 'gpu' })).gpu, null);
});
