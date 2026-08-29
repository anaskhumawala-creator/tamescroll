// ADOPTING THE PRESTARTED WORKER.
//
// lib.rs starts a worker at document_start and tells it to load its
// models, ~250-425ms before our bundle evaluates. By the time the client
// exists, that worker has usually already said 'up' and reported model
// loads -- to a handler that was only collecting them in an array. If
// the client dropped that backlog, the drain would wait forever on
// readiness that had already happened, which is worse than never
// prestarting at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerClient } from '../src/worker-client.mjs';

function fakeWorker() {
  const posted = [];
  return {
    posted,
    postMessage(m) { posted.push(m); },
    terminate() { this.terminated = true; },
    onmessage: null,
    onerror: null,
  };
}

function withWindow(pre, run) {
  global.window = { __TS_GAZE_PREWORKER: pre };
  global.location = { origin: 'https://m.youtube.com' };
  try { return run(); } finally { delete global.window; }
}

test('a prestarted worker is adopted instead of a second one being made', () => {
  const w = fakeWorker();
  const events = [];
  const client = withWindow({ worker: w, queue: [] }, () =>
    createWorkerClient({ onEvent: (e) => events.push(e) })
  );
  assert.equal(client.ready(), false, 'nothing is ready until it says up');
  w.onmessage({ data: { type: 'up' } });
  assert.equal(client.ready(), true);
  assert.ok(events.some((e) => e.type === 'up' && e.prestarted === true));
  assert.deepEqual(w.posted, [{ type: 'init' }], 'init is (re)sent; ensureModels is idempotent');
});

test('everything the worker said before the client existed is replayed', () => {
  const w = fakeWorker();
  const events = [];
  const queue = [
    { type: 'up' },
    { type: 'loaded', model: 'face' },
    { type: 'loaded', model: 'gender' },
    { type: 'loaded', model: 'nsfw' },
    { type: 'ready', backend: 'webgl' },
  ];
  const client = withWindow({ worker: w, queue }, () =>
    createWorkerClient({ onEvent: (e) => events.push(e) })
  );
  assert.equal(client.ready(), true, 'the backlog carried its hello');
  assert.equal(client.settled(), true, 'and all three model loads');
  assert.equal(client.backend(), 'webgl');
  assert.equal(queue.length, 0, 'the backlog is drained, not replayed twice');
});

test('the prestart handle is claimed, so a second client cannot take the same worker', () => {
  const w = fakeWorker();
  const win = { __TS_GAZE_PREWORKER: { worker: w, queue: [] } };
  global.window = win;
  global.location = { origin: 'https://m.youtube.com' };
  try {
    createWorkerClient({ onEvent() {} });
    assert.equal(win.__TS_GAZE_PREWORKER, null, 'claimed');
  } finally {
    delete global.window;
  }
});

test('with no prestart the client builds its own worker from our url', () => {
  const made = [];
  global.window = {};
  global.location = { origin: 'https://m.youtube.com' };
  try {
    function Ctor(url) { made.push(String(url)); return fakeWorker(); }
    createWorkerClient({ onEvent() {}, Worker: Ctor });
    assert.equal(made.length, 1);
    assert.match(made[0], /\/__tamescroll\/gaze-page\.js\?v=/);
  } finally {
    delete global.window;
  }
});
