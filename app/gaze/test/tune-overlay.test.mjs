// THE TUNING PANEL. It is the only UI of ours that lives on YouTube's
// page besides the blur switch, so two things are load bearing and both
// are tested here: it opens from a control of OUR OWN (a gear beside the
// pill -- a long press on the pill would have made the escape hatch feel
// unreliable), and it CANNOT change what a tap on the pill does.
//
// Everything a person reads is tested as data (labels, units, groups)
// rather than as rendered markup, because the copy is the feature.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- minimal DOM stub, same shape as video-region.test.mjs --------------
function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: { cssText: '', setProperty() {} },
    className: '',
    id: '',
    type: '',
    textContent: '',
    children: [],
    parentNode: null,
    isConnected: true,
    listeners: {},
    hidden: false,
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
    replaceChild(next, prev) {
      const i = this.children.indexOf(prev);
      if (i !== -1) { this.children[i] = next; }
      next.parentNode = this;
      prev.parentNode = null;
      return prev;
    },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener(t, fn) {
      this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn);
    },
    setAttribute(k, v) { this[k] = v; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 412, height: 232 }; },
    contains(n) {
      for (let p = n; p; p = p.parentNode) if (p === this) return true;
      return false;
    },
    fire(t, ev) {
      for (const fn of this.listeners[t] || []) fn(ev || { stopPropagation() {}, preventDefault() {}, target: this });
    },
    querySelectorAll() { return []; },
  };
}
globalThis.document = { createElement: (t) => makeEl(t), addEventListener() {}, removeEventListener() {} };

const to = await import('../src/tune-overlay.mjs');
const { tunableNames, currentValue, specRange } = await import('../src/tuning.mjs');
const overridesMod = await import('../src/tuning-override.mjs');
const autoTest = await import('../src/auto-test.mjs');

// O1 (phase-o): the override store moved behind window.TsTune, gated on
// the same per-document token PerfBridge already uses. `withBridge:
// false` gets a window with no bridge at all -- the desktop / lost-the-
// race case the panel has to name in its own copy.
const TOKEN = 'tok-panel';
function fakeWin(opts) {
  opts = opts || {};
  const store = { json: '' };
  const s = new Map();
  const win = {
    sessionStorage: {
      getItem: (k) => (s.has(k) ? s.get(k) : null),
      setItem: (k, v) => s.set(k, String(v)),
      removeItem: (k) => s.delete(k),
    },
    location: { pathname: '/watch', reload() {} },
    document: { documentElement: { classList: { contains: () => false } }, hidden: false },
    setInterval: () => 1,
    clearInterval: () => {},
    performance: { now: () => 1000 },
    __TS_GAZE_RENDER: () => ({ raf: 0 }),
    _store: store,
    _s: s,
  };
  if (opts.withBridge !== false) {
    win.TsTune = {
      get: (tok) => (tok === TOKEN ? store.json : ''),
      set: (tok, json) => { if (tok === TOKEN) store.json = json || ''; },
    };
  }
  return win;
}

const gearOf = (host) => host.children.filter((c) => c.className === to.GEAR_CLASS)[0];
const panelOf = (host) => host.children.filter((c) => c.className === to.PANEL_CLASS)[0];
// The DOM stub does not aggregate a parent's textContent from its
// children the way a real document does, so a row's tag ("under test",
// "applies on next video") is invisible to `panel.textContent` even
// though it is really there, three levels down. Walk it for real.
function textOf(el) {
  if (!el) return '';
  let s = el.textContent || '';
  for (const c of el.children || []) s += ' ' + textOf(c);
  return s;
}
function allDescendants(el) {
  if (!el) return [];
  let out = [el];
  for (const c of el.children || []) out = out.concat(allDescendants(c));
  return out;
}

test('every whitelisted dial is offered, in a group, with a plain label -- never only its key', () => {
  const rows = to.rows();
  assert.deepEqual(
    rows.map((r) => r.key).slice().sort(),
    tunableNames().slice().sort(),
    'a new dial must not go missing from the panel',
  );
  for (const r of rows) {
    assert.ok(to.GROUPS.indexOf(r.group) !== -1, r.key + ' has no group');
    assert.ok(r.label && r.label !== r.key, r.key + ' shows its key name as the label');
    assert.ok(r.desc && r.desc.length > 10, r.key + ' has no plain-language description');
    assert.equal(typeof r.value, 'number');
    assert.ok(r.step > 0);
  }
});

test('the four he tunes most sit at the top of the first two groups', () => {
  const rows = to.rows();
  const first = (g) => rows.filter((r) => r.group === g)[0].key;
  assert.equal(rows[0].group, 'blur', 'blur is the first group');
  assert.equal(first('blur'), 'DELAY_MS');
  assert.equal(first('speed'), 'VERDICT_DUTY');
  for (const k of ['PTRACK_MIN_COAST_PASSES', 'DELAY_MS', 'VERDICT_DUTY', 'BLUR_IN_FRAME']) {
    const i = rows.findIndex((r) => r.key === k);
    assert.ok(i >= 0 && rows[i].group !== 'advanced', k + ' must not be buried in Advanced');
  }
  assert.equal(to.GROUPS[to.GROUPS.length - 1], 'advanced');
});

test('a 0/1 dial is a switch; everything else steps inside its own clamp', () => {
  const rows = to.rows();
  const byKey = (k) => rows.find((r) => r.key === k);
  assert.equal(byKey('BLUR_IN_FRAME').bool, true);
  assert.equal(byKey('DELAY_MS').bool, false);
  for (const r of rows) {
    const range = specRange(r.key);
    assert.equal(to.stepValue({ ...r, value: range.max }, +1), range.max, r.key + ' steps past its ceiling');
    assert.equal(to.stepValue({ ...r, value: range.min }, -1), range.min, r.key + ' steps past its floor');
    const up = to.stepValue({ ...r, value: range.min }, +1);
    assert.ok(up > range.min && up <= range.max);
  }
});

test('the dials that only take effect on the next video say so', () => {
  // O4/O11 (phase-o): NO_AV1 came out of this list -- it does not take
  // effect on the next video either, only over the air (see the otaOnly
  // test below) -- and NATIVE_CPU_MASK/NATIVE_NPU joined it, because
  // native-client.mjs only rebuilds a model's backend and reads NPU
  // eligibility once, at the next ready.
  const nextDoc = to.rows().filter((r) => r.nextDoc).map((r) => r.key).sort();
  assert.deepEqual(nextDoc, ['CODEC_PROBE', 'DELAY_MS', 'NATIVE_CPU_MASK', 'NATIVE_NPU', 'PRESENTER_GL'].sort());
});

test('a value is shown with its unit, never as a bare machine number', () => {
  assert.equal(to.formatValue(to.rows().find((r) => r.key === 'DELAY_MS'), 1500), '1.5 s');
  assert.equal(to.formatValue(to.rows().find((r) => r.key === 'REFRESH_CAP_HZ'), 60), '60 Hz');
  assert.equal(to.formatValue(to.rows().find((r) => r.key === 'REFRESH_CAP_HZ'), 0), 'off');
  assert.equal(to.formatValue(to.rows().find((r) => r.key === 'BLUR_IN_FRAME'), 1), 'on');
  assert.equal(to.formatValue(to.rows().find((r) => r.key === 'BLUR_IN_FRAME'), 0), 'off');
});

test('the readouts are plain words and units, and survive a page with no hooks at all', () => {
  const r = to.makeReadouts();
  const win = {
    performance: { now: () => 1000 },
    __TS_GAZE_RENDER: () => ({ raf: 100 }),
    __TS_GAZE_IDS: { stages: [{ end: 355, v: 1 }] },
  };
  const video = { getVideoPlaybackQuality: () => ({ droppedVideoFrames: 10, totalVideoFrames: 100 }) };
  r.sample(win, video, null); // baseline
  win.performance.now = () => 3000;
  win.__TS_GAZE_RENDER = () => ({ raf: 200 });
  video.getVideoPlaybackQuality = () => ({ droppedVideoFrames: 22, totalVideoFrames: 200 });
  const out = r.sample(win, video, { backend: 'gpu', npu: 'absent' });
  const by = {};
  for (const row of out) by[row.label] = row.value;
  assert.equal(by['Dropped frames'], '12.0%');
  assert.equal(by['Frame rate'], '50 Hz');
  assert.equal(by['Engine'], 'GPU');
  assert.ok('Video codec' in by);
  // A page with nothing hooked up must still render a panel.
  const bare = to.makeReadouts();
  bare.sample({}, null, null);
  for (const row of bare.sample({}, null, null)) assert.equal(typeof row.value, 'string');
});

test('the gear is ours, it is beside the pill, and tapping it opens the panel', () => {
  const host = makeEl('div');
  const pill = makeEl('button');
  pill.className = 'ts-gaze-pill';
  host.appendChild(pill);
  const ui = to.installTuneUi({ doc: document, host: host, win: fakeWin(), pill: pill });
  const gear = gearOf(host);
  assert.ok(gear, 'no gear button was built');
  assert.equal(gear.tagName, 'BUTTON');
  assert.ok(/min-height:36px/.test(gear.style.cssText), 'the gear is not a 36px touch target');
  assert.equal(panelOf(host), undefined, 'the panel is hidden until it is asked for');
  gear.fire('click');
  assert.ok(panelOf(host), 'tapping the gear did not open the panel');
  ui.destroy();
  assert.equal(panelOf(host), undefined);
  assert.equal(gearOf(host), undefined);
});

test('installing the panel adds NOT ONE listener to the blur pill', () => {
  // His escape hatch is a single tap on the pill. A long-press opener
  // would have shared that element; a gear does not touch it, and this
  // test is what keeps it that way.
  const host = makeEl('div');
  const pill = makeEl('button');
  pill.className = 'ts-gaze-pill';
  let toggled = 0;
  pill.addEventListener('click', () => { toggled++; });
  host.appendChild(pill);
  const before = pill.listeners.click.length;
  const ui = to.installTuneUi({ doc: document, host: host, win: fakeWin(), pill: pill });
  assert.equal(pill.listeners.click.length, before, 'the panel bound itself to the pill');
  for (const t of Object.keys(pill.listeners)) {
    if (t !== 'click') assert.equal(pill.listeners[t].length, 0, 'a ' + t + ' listener landed on the pill');
  }
  pill.fire('click');
  assert.equal(toggled, 1, 'a short tap on the pill must still toggle the blur');
  assert.equal(panelOf(host), undefined, 'tapping the pill opened the panel');
  ui.destroy();
});

test('a stepper writes through the override bridge and applies live (O1)', () => {
  const host = makeEl('div');
  const win = fakeWin();
  overridesMod.setToken(TOKEN);
  const ui = to.installTuneUi({ doc: document, host: host, win: win });
  gearOf(host).fire('click');
  const before = currentValue('VERDICT_DUTY');
  ui._step('VERDICT_DUTY', +1);
  assert.ok(currentValue('VERDICT_DUTY') > before, 'the dial did not move');
  const stored = JSON.parse(win._store.json);
  assert.equal(stored.VERDICT_DUTY, currentValue('VERDICT_DUTY'), 'the bridge never saw the write');
  ui._reset();
  assert.equal(win._store.json, '', 'reset must clear the bridge store, not merely the panel');
  assert.equal(currentValue('VERDICT_DUTY'), before, 'reset did not put it back');
  ui.destroy();
  overridesMod.setToken(null);
});

test('O1: with no bridge at all, the panel says overrides need the app, and still applies live', () => {
  const host = makeEl('div');
  const win = fakeWin({ withBridge: false });
  overridesMod.setToken(null);
  const ui = to.installTuneUi({ doc: document, host: host, win: win });
  gearOf(host).fire('click');
  const panelText = textOf(panelOf(host));
  assert.ok(/Overrides need the Android app/.test(panelText), 'the panel did not say overrides are unavailable');
  const before = currentValue('VERDICT_DUTY');
  ui._step('VERDICT_DUTY', +1);
  assert.ok(currentValue('VERDICT_DUTY') > before, 'a memory-only edit must still apply for this document');
  ui.destroy();
});

// O13 (phase-o): the old version of this test read miniplayer.mjs as
// text and grepped the `var OUR_CONTROLS` line for the substring
// 'ts-gaze-gear' -- a dead check, because nothing ever pressed a real
// gear and watched the drag refuse to arm. That property now has its
// own real test, driving installMiniplayer's actual document listeners
// against a built gear element: miniplayer.test.mjs, "a press that
// starts on the tuning gear cannot arm the miniplayer drag" (RED against
// the pre-fix onDown, which had no onAControl call site to fail through
// at all). What belongs here instead is the half only this module can
// pin: the gear this file BUILDS carries the exact class name
// OUR_CONTROLS depends on, so a rename on one side cannot silently
// desync from the other.
test('the gear this module builds carries the class miniplayer.mjs OUR_CONTROLS names', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  assert.match(src, /OUR_CONTROLS = '#' \+ BTN_ID \+ ',\.ts-gaze-pill,\.ts-gaze-gear,\.ts-gaze-tune';/);
  assert.equal(to.GEAR_CLASS, 'ts-gaze-gear');
  assert.equal(to.PANEL_CLASS, 'ts-gaze-tune');

  const host = makeEl('div');
  const ui = to.installTuneUi({ doc: document, host: host, win: fakeWin() });
  const gear = gearOf(host);
  assert.ok(gear, 'no gear button was built');
  assert.equal(gear.className, to.GEAR_CLASS, 'the built gear does not carry GEAR_CLASS');
  assert.equal(gear.tagName, 'BUTTON', 'the gear must be a real button, PAGE_CONTROLS\' other line of defence');
  ui.destroy();
});

test('O11: NATIVE_CPU_MASK and NATIVE_NPU only take effect on the next video, same as the other backend dials', () => {
  const rows = to.rows();
  const cpuMask = rows.find((r) => r.key === 'NATIVE_CPU_MASK');
  const npu = rows.find((r) => r.key === 'NATIVE_NPU');
  assert.ok(cpuMask && cpuMask.nextDoc, 'NATIVE_CPU_MASK must be tagged nextDoc');
  assert.ok(npu && npu.nextDoc, 'NATIVE_NPU must be tagged nextDoc');
});

test('O4: NO_AV1 is tagged otaOnly, not nextDoc -- it cannot take effect from this panel at all', () => {
  // The codec decision happens in the document-start script, roughly
  // 380-530ms before the gaze bundle boots, so a value this panel writes
  // can never reach it in the same document a reload would produce. The
  // row must say so rather than implying "next video" will pick it up.
  const row = to.rows().find((r) => r.key === 'NO_AV1');
  assert.ok(row, 'NO_AV1 must still be a tunable row');
  assert.equal(row.otaOnly, true, 'NO_AV1 must be tagged otaOnly');
  assert.ok(!row.nextDoc, 'NO_AV1 must not also claim nextDoc');

  const host = makeEl('div');
  const ui = to.installTuneUi({ doc: document, host: host, win: fakeWin() });
  gearOf(host).fire('click');
  const text = textOf(panelOf(host));
  assert.ok(/only takes effect from a pushed update/.test(text), 'the panel does not say NO_AV1 is OTA-only');
  ui.destroy();
});

test('O6: a row under an active auto-test reads as under-test and its controls are disabled', () => {
  const host = makeEl('div');
  const win = fakeWin();
  // ARMS[1] is blurInFrame -- { BLUR_IN_FRAME: 1 } -- a fresh, non-stale
  // run so readRun(win) is non-null when the panel builds.
  autoTest.writeRun(win, { i: 1, mediaTime: 0, at: Date.now() });
  const ui = to.installTuneUi({ doc: document, host: host, win: win });
  gearOf(host).fire('click');
  const panel = panelOf(host);
  const text = textOf(panel);
  assert.ok(/under test/.test(text), 'a row under an active arm must say it is under test');
  const disabledSwitch = allDescendants(panel).some((n) => n.tagName === 'BUTTON' && n.disabled === true);
  assert.ok(disabledSwitch, 'the switch under test must be disabled, or a press would promote the arm to a permanent override');
  ui.destroy();
  autoTest.endRun(win);
});

test('O9: the panel no longer opens directly under the pill/gear row', () => {
  const host = makeEl('div');
  const pill = makeEl('button');
  pill.className = 'ts-gaze-pill';
  host.appendChild(pill);
  const ui = to.installTuneUi({ doc: document, host: host, win: fakeWin(), pill: pill });
  const gear = gearOf(host);
  assert.ok(/top:48px/.test(gear.style.cssText), 'the gear moved -- this test is checking the wrong row');
  gear.fire('click');
  const panel = panelOf(host);
  assert.ok(!/top:48px/.test(panel.style.cssText), 'the panel still sits at the pill/gear row, covering the escape hatch');
  ui.destroy();
});
