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

function fakeWin() {
  const map = new Map();
  return {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
    sessionStorage: {
      getItem: () => null, setItem() {}, removeItem() {},
    },
    setInterval: () => 1,
    clearInterval: () => {},
    performance: { now: () => 1000 },
    __TS_GAZE_RENDER: () => ({ raf: 0 }),
    _map: map,
  };
}

const gearOf = (host) => host.children.filter((c) => c.className === to.GEAR_CLASS)[0];
const panelOf = (host) => host.children.filter((c) => c.className === to.PANEL_CLASS)[0];

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
  const nextDoc = to.rows().filter((r) => r.nextDoc).map((r) => r.key).sort();
  assert.deepEqual(nextDoc, ['CODEC_PROBE', 'DELAY_MS', 'NO_AV1', 'PRESENTER_GL'].sort());
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

test('a stepper writes through the override store and applies live', () => {
  const host = makeEl('div');
  const win = fakeWin();
  const ui = to.installTuneUi({ doc: document, host: host, win: win });
  gearOf(host).fire('click');
  const before = currentValue('VERDICT_DUTY');
  ui._step('VERDICT_DUTY', +1);
  assert.ok(currentValue('VERDICT_DUTY') > before, 'the dial did not move');
  const stored = JSON.parse(win._map.get('tamescroll.tuning'));
  assert.equal(stored.VERDICT_DUTY, currentValue('VERDICT_DUTY'));
  ui._reset();
  assert.equal(win._map.has('tamescroll.tuning'), false);
  assert.equal(currentValue('VERDICT_DUTY'), before, 'reset did not put it back');
  ui.destroy();
});

test('the gear is in miniplayer OUR_CONTROLS, or a tap on it drags the player', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const line = src.split('\n').filter((l) => /var OUR_CONTROLS/.test(l))[0];
  assert.ok(line && line.indexOf('ts-gaze-gear') !== -1, 'OUR_CONTROLS does not name the gear');
});
