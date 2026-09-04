// THE IN-PLAYER TUNING PANEL.
//
// Every dial in tuning.mjs was priced on a labelled corpus or on the one
// Redmi on this desk, and the phone that matters is his. Until now the
// only way to try a number on it was: edit rules/tuning.json, push,
// refresh rules, watch, guess. This is the same set of dials with the
// loop closed -- change it, see the video change, read the drops.
//
// FOUR RULES SHAPE IT, and they are the house rules rather than taste:
//
//   * IT IS NOT A NAG AND IT IS NOT A PARENTAL CONTROL. It has no icon
//     in YouTube's chrome, no badge, no notification, and nothing about
//     it appears unless the gear is pressed. It is one 36px button
//     beside the blur switch that is already there.
//   * IT DOES NOT TOUCH THE BLUR SWITCH. The first design opened on a
//     long press of the pill; the pill is his escape hatch from a wrong
//     verdict and a control that does two things is a control you stop
//     trusting. So the opener is a control OF OUR OWN and this module
//     binds NOTHING to the pill -- tune-overlay.test.mjs fails if a
//     single listener lands there.
//   * IT SPEAKS ENGLISH. `PTRACK_MIN_COAST_PASSES` is a constant name,
//     not a label. Every row says what the dial does, in a sentence,
//     with the value in the unit a person would say out loud. The key
//     is shown, small and grey, only in Advanced.
//   * IT WRITES THROUGH THE WHITELIST. Every press goes to
//     tuning-override.setOverride, which is tuning.applyOne, which is
//     the same SPEC clamp an OTA push meets.
import { tunableNames, currentValue, specRange } from './tuning.mjs';
import * as overrides from './tuning-override.mjs';
import * as autoTest from './auto-test.mjs';
import * as codecProbe from './codec-probe.mjs';

export var GEAR_CLASS = 'ts-gaze-gear';
export var PANEL_CLASS = 'ts-gaze-tune';
export var GROUPS = ['blur', 'speed', 'advanced'];
export var GROUP_LABELS = { blur: 'Blur', speed: 'Speed', advanced: 'Advanced' };
var REFRESH_MS = 500;

// THE COPY IS THE FEATURE, so it lives in one table and the tests read
// it as data. `group` and the order within a group decide the layout;
// anything the whitelist grows that is not named here still renders, in
// Advanced, and says so rather than going missing.
//
//   scale/dp/unit  how the number is said out loud (1500 -> "1.5 s")
//   zero           what 0 means, when 0 means "off" rather than zero
//   bool           a switch, drawn like the blur pill's
//   nextDoc        takes effect on the next video, not on this one
var META = {
  // --- Blur -------------------------------------------------------------
  DELAY_MS: {
    group: 'blur', label: 'Blur delay',
    desc: 'How long the picture is held back so a patch lands on the frame someone appears in. Longer is safer and further behind live.',
    unit: 's', scale: 1000, dp: 1, step: 250, zero: 'off', nextDoc: true,
  },
  PTRACK_MIN_COAST_PASSES: {
    group: 'blur', label: 'Patch memory',
    desc: 'How long a patch keeps following someone between checks. Lower leaves fewer stray patches and shows a little more.',
    unit: 'checks', dp: 2, step: 0.17,
  },
  BLUR_IN_FRAME: {
    group: 'blur', label: 'Blur into the picture',
    desc: 'Draw the blur into the video frame instead of as a layer on top of it.',
    bool: true,
  },
  PRESENTER_GL: {
    group: 'blur', label: 'GPU blur',
    desc: 'Let the graphics chip blur and present the frames. Falls back on its own if the phone cannot.',
    bool: true, nextDoc: true,
  },
  // --- Speed ------------------------------------------------------------
  VERDICT_DUTY: {
    group: 'speed', label: 'Time between checks',
    desc: 'How long to wait between checks, as a multiple of what the last check cost. Higher is smoother and slower to react.',
    unit: '×', dp: 1, step: 0.5,
  },
  RENDER_EVERY: {
    group: 'speed', label: 'Patch redraw',
    desc: 'Move the patches every frame, or every other frame. Every other frame is cheaper and can trail slightly.',
    unit: 'frames', dp: 0, step: 1,
  },
  NATIVE_CPU_MASK: {
    group: 'speed', label: 'Models on the CPU',
    desc: 'Move models off the graphics chip: add 1 for faces, 2 for gender, 4 for bodies. 0 leaves them all on the GPU.',
    // O11 (phase-o): the native engine only rebuilds its models when it
    // reports ready, once per document -- a mask changed mid-document
    // has nothing left to rebuild until the next one.
    dp: 0, step: 1, zero: 'all on GPU', nextDoc: true,
  },
  NO_AV1: {
    group: 'speed', label: 'Refuse AV1 video',
    desc: 'Ask for VP9 or H.264 instead of AV1, which some phones have to decode in software.',
    // O4 (phase-o): this used to say "applies on next video", which was
    // never true from here. YouTube decides the codec via
    // MediaSource.isTypeSupported at ~380-530ms after the document
    // starts (measured, probe_av1_caps.py); a value moved through this
    // panel only reaches the page once the gaze bundle boots, half a
    // second to a second later -- on THIS document or the next one. The
    // OTA channel reaches the same document-start script this dial
    // needs and is the only channel that can move it in time.
    bool: true, otaOnly: true,
  },
  SUSTAINED_PERF: {
    group: 'speed', label: 'Steady clocks',
    desc: 'Ask the phone to hold a speed it can sustain instead of boosting and then throttling.',
    bool: true,
  },
  REFRESH_CAP_HZ: {
    group: 'speed', label: 'Screen refresh cap',
    desc: 'Cap the display refresh rate. A 90 Hz screen at 60 composes a third fewer frames.',
    unit: 'Hz', dp: 0, step: 30, zero: 'off',
  },
  THERMAL_DUTY: {
    group: 'speed', label: 'Ease off when hot',
    desc: 'Check less often while the phone is close to throttling, and go back when it cools.',
    bool: true,
  },
  PERF_HINT: {
    group: 'speed', label: 'Performance hint',
    desc: 'Tell Android the thread doing the detection needs steady CPU.',
    bool: true,
  },
  INFER_PRIO: {
    group: 'speed', label: 'Detection priority',
    desc: '0 normal, 1 below the display, 2 background. Lower priority means a slower check and a steadier picture.',
    dp: 0, step: 1,
  },
  PLAYBACK_SLOW: {
    group: 'speed', label: 'Slow down when dropping',
    desc: 'Play at 0.95× while the decoder is dropping frames. Never touches a speed you chose yourself.',
    bool: true,
  },
  // --- Advanced ---------------------------------------------------------
  CUT_DELTA: {
    group: 'advanced', label: 'Scene cut sensitivity',
    desc: 'How much the picture must change to count as a new shot. Lower fires on ordinary camera movement.',
    dp: 0, step: 5,
  },
  GENDER_CLEAR_SCORE: {
    group: 'advanced', label: 'Certainty to leave a man sharp',
    desc: 'How sure the model must be before it stops blurring someone it reads as the same gender as you.',
    dp: 2, step: 0.02,
  },
  GENDER_CLEAR_SCORE_FEMALE: {
    group: 'advanced', label: 'Certainty to leave a woman sharp',
    desc: 'The same bar, for a read that came back female.',
    dp: 2, step: 0.02,
  },
  GENDER_GREY: {
    group: 'blur', label: 'Read faces in black and white',
    desc: 'Shows the face model a grey copy of each face instead of a colour one.'
      + ' Measured to miss fewer women, and to leave fewer marks on things that'
      + ' are not people. Costs nothing and takes effect on the next check.',
    dp: 0, step: 1, zero: 'off',
  },  NULL_MINT_NM_FLOOR: {
    group: 'advanced', label: 'Face signal floor',
    desc: 'How much the model must have found in a crop before it is allowed to start a new patch there.',
    dp: 1, step: 0.5, zero: 'off',
  },
  MEM_TRUST_MAN: {
    group: 'advanced', label: 'Memory trust (man)',
    desc: 'How many clear reads a face needs before the app remembers it and clears it instantly next time.',
    dp: 0, step: 1,
  },
  MEM_TRUST_WOMAN: {
    group: 'advanced', label: 'Memory trust (woman)',
    desc: 'The same count, for a face read as female.',
    dp: 0, step: 1,
  },
  MEM_SIM: {
    group: 'advanced', label: 'Face match strictness',
    desc: 'How alike two faces must be to count as the same person. Lower starts merging different people.',
    dp: 2, step: 0.05,
  },
  PERSON_SKIP_EVERY: {
    group: 'advanced', label: 'Body model skip',
    desc: 'Once nobody has been found for a while, run the body model on one check in this many. 1 is off.',
    unit: 'checks', dp: 0, step: 1,
  },
  PTRACK_IOU_MIN: {
    group: 'advanced', label: 'Track match overlap',
    desc: 'How much two boxes must overlap to be treated as the same person between checks.',
    dp: 2, step: 0.05,
  },
  VERDICT_MAX_INTERVAL_MS: {
    group: 'advanced', label: 'Longest gap between checks',
    desc: 'The cap on the time between checks, whatever the last one cost.',
    unit: 's', scale: 1000, dp: 1, step: 200,
  },
  GENDER_REFRESH_MS: {
    group: 'advanced', label: 'Re-read a settled face after',
    desc: 'How long a settled verdict may stand before the face is read again. 0 re-reads everyone every check.',
    unit: 's', scale: 1000, dp: 1, step: 500, zero: 'every check',
  },
  CUT_PERSON_LOOK: {
    group: 'advanced', label: 'Look for bodies on a cut',
    desc: 'Force one body check at every shot change, even while the body model is being skipped.',
    bool: true,
  },
  NATIVE_INFER: {
    group: 'advanced', label: 'Native engine',
    desc: 'Run the models through the phone’s own engine instead of the browser. Off falls back to the web worker.',
    bool: true,
  },
  NATIVE_NPU: {
    group: 'advanced', label: 'Try the NPU',
    desc: 'Trial the phone’s neural chip at load and keep it only if it is faster and agrees with the GPU.',
    // O11 (phase-o): the trial runs once, after the engine reports
    // ready, same as NATIVE_CPU_MASK above.
    bool: true, nextDoc: true,
  },
  CODEC_PROBE: {
    group: 'advanced', label: 'Read the served codec',
    desc: 'Watch which video codec YouTube hands the player. Read-only; nothing is changed.',
    bool: true, nextDoc: true,
  },
};

function metaFor(key) {
  return META[key] || {
    group: 'advanced',
    label: key,
    desc: 'Not yet described. See the comment beside this key in tuning.mjs.',
    dp: 2,
  };
}

/** A sensible step for a dial nobody wrote one for: a twentieth of its
 * own range, or 1 where the whole range is small integers. */
function defaultStep(min, max) {
  var span = max - min;
  if (span <= 0) return 1;
  if (span <= 10 && min === Math.round(min) && max === Math.round(max)) return 1;
  var s = span / 20;
  var pow = Math.pow(10, Math.floor(Math.log(s) / Math.LN10));
  return Math.max(0.01, Math.round(s / pow) * pow);
}

/**
 * Every whitelisted dial, in the order the panel draws them: groups in
 * GROUPS order, and inside a group the order of META, which puts the
 * four he tunes most at the top of the first two groups.
 */
export function rows() {
  var names = tunableNames();
  var metaOrder = Object.keys(META);
  var out = [];
  for (var g = 0; g < GROUPS.length; g++) {
    var group = GROUPS[g];
    // META order first (it is the deliberate one), then anything the
    // whitelist has grown since, so a new dial is never invisible.
    var ordered = metaOrder.filter(function (k) {
      return names.indexOf(k) !== -1 && metaFor(k).group === group;
    });
    var rest = names.filter(function (k) {
      return metaOrder.indexOf(k) === -1 && metaFor(k).group === group;
    });
    var keys = ordered.concat(rest);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var m = metaFor(key);
      var r = specRange(key) || { min: 0, max: 1 };
      var bool = m.bool === true || (r.min === 0 && r.max === 1 && !m.dp && !m.unit);
      out.push({
        key: key,
        label: m.label,
        desc: m.desc,
        group: group,
        unit: m.unit || '',
        scale: m.scale || 1,
        dp: typeof m.dp === 'number' ? m.dp : 2,
        zero: m.zero || null,
        bool: !!bool,
        nextDoc: !!m.nextDoc,
        otaOnly: !!m.otaOnly,
        step: m.step || (bool ? 1 : defaultStep(r.min, r.max)),
        min: r.min,
        max: r.max,
        value: currentValue(key),
      });
    }
  }
  return out;
}

/** The value said out loud: a unit, never a bare machine number. */
export function formatValue(row, v) {
  if (!row) return '';
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  if (row.bool) return v > 0 ? 'on' : 'off';
  if (v === 0 && row.zero) return row.zero;
  var n = v / (row.scale || 1);
  var s = n.toFixed(row.dp);
  // 1.50 -> 1.5, but 60 stays 60.
  if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return row.unit ? s + ' ' + row.unit : s;
}

/** One press of a stepper, clamped to the dial's own range. */
export function stepValue(row, dir) {
  if (!row) return null;
  var v = (typeof row.value === 'number' && isFinite(row.value) ? row.value : row.min) + dir * row.step;
  if (v < row.min) v = row.min;
  if (v > row.max) v = row.max;
  return Math.round(v * 1000) / 1000;
}

// --- live readouts -------------------------------------------------------

var ENGINE_WORD = { npu: 'NPU', gpu: 'GPU', cpu: 'CPU' };
var NPU_WORD = { ok: 'in use', failed: 'no gain', pending: 'trying', absent: 'none', disabled: 'off' };
var CODEC_WORD = { av01: 'AV1', vp09: 'VP9', avc1: 'H.264', other: 'other' };
var DASH = '—';

function hook(win, name) {
  try {
    return win && typeof win[name] === 'function' ? win[name]() : null;
  } catch (e) {
    return null;
  }
}
function nowMs(win) {
  try {
    if (win && win.performance && typeof win.performance.now === 'function') return win.performance.now();
  } catch (e) { /* fall through */ }
  return Date.now();
}

/**
 * The same four numbers probe_drops_ab.py reads over CDP, measured from
 * inside the page instead: dropped/total since the panel was opened, the
 * renderer's own rAF rate, what the last check cost, and where the
 * models and the picture actually landed.
 *
 * Cumulative since open rather than a half-second delta, deliberately --
 * a per-tick rate on a phone reads as noise and gets acted on.
 */
export function makeReadouts() {
  var base = null;
  return {
    reset: function () { base = null; },
    sample: function (win, video, native) {
      var t = nowMs(win);
      var q = null;
      try {
        q = video && typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
      } catch (e) { q = null; }
      var render = hook(win, '__TS_GAZE_RENDER');
      var cur = {
        t: t,
        dropped: q && typeof q.droppedVideoFrames === 'number' ? q.droppedVideoFrames : null,
        total: q && typeof q.totalVideoFrames === 'number' ? q.totalVideoFrames : null,
        raf: render && typeof render.raf === 'number' ? render.raf : null,
      };
      if (!base) base = cur;

      var dropPct = DASH;
      if (cur.total !== null && base.total !== null && cur.total - base.total > 0) {
        dropPct = (100 * (cur.dropped - base.dropped) / (cur.total - base.total)).toFixed(1) + '%';
      }
      var hz = DASH;
      var secs = (cur.t - base.t) / 1000;
      if (cur.raf !== null && base.raf !== null && secs > 0.5) {
        hz = String(Math.round((cur.raf - base.raf) / secs)) + ' Hz';
      }

      var verdict = DASH;
      try {
        var stages = (win && win.__TS_GAZE_IDS && win.__TS_GAZE_IDS.stages) || [];
        for (var i = stages.length - 1; i >= 0; i--) {
          if (stages[i] && stages[i].v && typeof stages[i].end === 'number') {
            verdict = Math.round(stages[i].end) + ' ms';
            break;
          }
        }
      } catch (e) { /* no stages is not a failure */ }

      var served = { codec: 'none' };
      try { served = codecProbe.served() || served; } catch (e) { /* module-level, cannot fail */ }
      var paint = hook(win, '__TS_DELAY_STATS');
      var st = (paint && paint.stats) || null;
      var presenter = DASH;
      if (st) presenter = st.lost ? '2D (GPU handed back)' : (st.gl ? 'GPU' : '2D');

      return [
        { label: 'Dropped frames', value: dropPct },
        { label: 'Frame rate', value: hz },
        { label: 'Last check', value: verdict },
        { label: 'Engine', value: (native && ENGINE_WORD[native.backend]) || DASH },
        { label: 'NPU', value: (native && NPU_WORD[native.npu]) || DASH },
        { label: 'Video codec', value: CODEC_WORD[served.codec] || DASH },
        { label: 'Presenter', value: presenter },
      ];
    },
  };
}

// --- the panel -----------------------------------------------------------

var CSS = {
  gear:
    'position:absolute;top:48px;right:112px;z-index:2147483645;' +
    'display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,.55);color:#fff;font:500 15px system-ui;' +
    'width:36px;min-height:36px;border:none;border-radius:999px;opacity:.85;' +
    'cursor:pointer;pointer-events:auto;',
  panel:
    // O9 (phase-o): this used to sit at top:48px, the SAME row as the
    // blur pill and this gear, so opening the panel visually buried his
    // one-tap escape hatch under it -- reachable in the DOM (a tap
    // outside the panel still closes it), invisible on the screen. The
    // panel now starts below that row so the pill and the gear stay on
    // screen, and shrinks its own height to fit.
    'position:absolute;top:92px;right:8px;left:8px;z-index:2147483646;' +
    'max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
    'background:rgba(16,16,18,.96);color:#eee;font:400 13px/1.4 system-ui;' +
    'border-radius:12px;padding:10px 12px 14px;pointer-events:auto;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.5);text-align:left;',
  head: 'display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;',
  title: 'font:600 14px system-ui;',
  x: 'background:none;border:none;color:#bbb;font:400 18px system-ui;width:32px;min-height:32px;cursor:pointer;',
  readouts: 'display:flex;flex-wrap:wrap;gap:4px 14px;margin:0 0 10px;color:#cfcfcf;',
  readout: 'font:400 12px system-ui;',
  rvalue: 'color:#fff;font-weight:600;',
  group: 'font:600 12px system-ui;color:#9ad;margin:12px 0 4px;letter-spacing:.4px;text-transform:uppercase;',
  row: 'padding:7px 0;border-top:1px solid rgba(255,255,255,.08);',
  rowTop: 'display:flex;align-items:center;justify-content:space-between;gap:8px;',
  label: 'font:600 13px system-ui;',
  desc: 'color:#9e9e9e;font:400 11px/1.35 system-ui;margin-top:2px;',
  key: 'color:#6f6f6f;font:400 10px system-ui;margin-top:2px;',
  tag: 'color:#d8a657;font:400 11px system-ui;margin-top:2px;',
  ctl: 'display:flex;align-items:center;gap:6px;flex:none;',
  step:
    'background:rgba(255,255,255,.12);color:#fff;border:none;border-radius:8px;' +
    'width:34px;min-height:34px;font:600 16px system-ui;cursor:pointer;',
  value: 'min-width:64px;text-align:center;font:600 13px system-ui;',
  track: 'position:relative;width:34px;height:18px;border-radius:999px;flex:none;',
  knob: 'position:absolute;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s;',
  btn:
    'background:rgba(255,255,255,.12);color:#fff;border:none;border-radius:10px;' +
    'padding:9px 12px;min-height:36px;font:600 12px system-ui;cursor:pointer;',
  btnRow: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;',
  bar: 'height:6px;border-radius:999px;background:rgba(255,255,255,.15);margin-top:8px;overflow:hidden;',
  fill: 'height:6px;background:#4a4;width:0%;',
  note: 'color:#9e9e9e;font:400 11px system-ui;margin-top:6px;',
  table: 'width:100%;border-collapse:collapse;margin-top:8px;font:400 12px system-ui;',
  cell: 'padding:3px 6px 3px 0;text-align:left;',
};

/**
 * Build the gear and, on demand, the panel. Both live in the SAME host
 * as the blur pill (#player-container-id), so element fullscreen keeps
 * them rendered and the miniplayer hides them together.
 *
 * @param {object} o  {doc, host, win, pill, video, nativeInfo, shipped}
 *   `pill` is passed for one reason only: so this module can be seen not
 *   to touch it. `shipped` is what the dials read before any override
 *   was applied -- init-entry captures it between applyTuningFromWindow
 *   and applyOverrides, because nothing downstream can reconstruct it.
 */
export function installTuneUi(o) {
  var doc = o.doc;
  var host = o.host;
  var win = o.win || (typeof window !== 'undefined' ? window : null);
  var video = o.video || null;
  var nativeInfo = typeof o.nativeInfo === 'function' ? o.nativeInfo : function () { return null; };
  var shipped = o.shipped || null;
  if (!shipped) {
    // Fallback: whatever this document booted with. Correct on a page
    // that has no overrides, and never worse than not offering a reset.
    shipped = {};
    var names = tunableNames();
    for (var n = 0; n < names.length; n++) shipped[names[n]] = currentValue(names[n]);
  }

  var panel = null;
  var timer = null;
  var readouts = makeReadouts();
  var advancedOpen = false;
  var message = '';
  // O8 (phase-o): the two pieces that actually change every tick, kept
  // by reference so the 500ms refresh can patch them in place instead
  // of tearing the whole panel down and rebuilding it -- a full rebuild
  // under a finger mid-press was replacing the very button the press
  // landed on.
  var readoutsEl = null;
  var testEl = null;

  function el(tag, css, text) {
    var e = doc.createElement(tag);
    if (css) e.style.cssText = css;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  var gear = el('button', CSS.gear, '⚙');
  gear.type = 'button';
  gear.className = GEAR_CLASS;
  gear.setAttribute('aria-label', 'Tuning');
  gear.addEventListener('click', function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (panel) close();
    else open();
  });
  host.appendChild(gear);

  // Tapping the video outside the panel closes it, the way any sheet
  // does. Capture phase, because YouTube's own control overlay swallows
  // clicks on its way down.
  function onDocDown(e) {
    if (!panel) return;
    var t = e && e.target;
    try {
      if (t && (panel.contains(t) || gear.contains(t))) return;
    } catch (err) { /* a target from another root closes the panel */ }
    close();
  }
  try {
    if (doc && typeof doc.addEventListener === 'function') doc.addEventListener('click', onDocDown, true);
  } catch (e) { /* a panel that cannot be dismissed by tapping away still has an X */ }

  function setOverride(key, v) {
    return overrides.setOverride(win, key, v);
  }

  function stepKey(key, dir) {
    var all = rows();
    var row = null;
    for (var i = 0; i < all.length; i++) if (all[i].key === key) row = all[i];
    if (!row) return null;
    var next = row.bool ? (row.value > 0 ? 0 : 1) : stepValue(row, dir);
    var got = setOverride(key, next);
    render();
    return got;
  }

  function reset() {
    overrides.clearOverrides(win, shipped);
    render();
  }

  function reload() {
    try { win.location.reload(); } catch (e) { /* nothing else to try */ }
  }

  function startTest() {
    var r = autoTest.beginRun(win, video);
    if (r) { message = r; render(); }
  }

  // --- rendering --------------------------------------------------------

  function readoutBlock() {
    var wrap = el('div', CSS.readouts);
    var list = readouts.sample(win, video, nativeInfo());
    for (var i = 0; i < list.length; i++) {
      var r = el('span', CSS.readout, list[i].label + ' ');
      var v = el('span', CSS.rvalue, list[i].value);
      r.appendChild(v);
      wrap.appendChild(r);
    }
    return wrap;
  }

  function switchEl(on) {
    var track = el('span', CSS.track + 'background:' + (on ? '#4a4' : '#777') + ';');
    var knob = el('span', CSS.knob + 'left:' + (on ? '18px' : '2px') + ';');
    track.appendChild(knob);
    return track;
  }

  // O6 (phase-o): while a mode test is running, the row for a dial the
  // CURRENT ARM moves shows the arm's temporary value -- pressing its
  // stepper would call setOverride and PERSIST that temporary number as
  // his own real setting, silently, the moment the test happened to be
  // sitting on it. `underTest` disables the control instead and says
  // why, so a press cannot lock in a value he never chose.
  function rowEl(row, underTest) {
    var wrap = el('div', CSS.row);
    var top = el('div', CSS.rowTop);
    var left = el('div', '');
    left.appendChild(el('div', CSS.label, row.label));
    var ctl = el('div', CSS.ctl);

    if (row.bool) {
      var sw = doc.createElement('button');
      sw.type = 'button';
      sw.style.cssText = 'background:none;border:none;padding:6px;min-height:36px;cursor:pointer;' +
        (underTest ? 'opacity:.4;' : '');
      sw.disabled = !!underTest;
      sw.appendChild(switchEl(row.value > 0));
      if (!underTest) sw.addEventListener('click', function () { stepKey(row.key, +1); });
      ctl.appendChild(sw);
    } else {
      var minus = el('button', CSS.step + (underTest ? 'opacity:.4;' : ''), '−');
      minus.type = 'button';
      minus.disabled = !!underTest;
      if (!underTest) minus.addEventListener('click', function () { stepKey(row.key, -1); });
      var val = el('span', CSS.value, formatValue(row, row.value));
      var plus = el('button', CSS.step + (underTest ? 'opacity:.4;' : ''), '+');
      plus.type = 'button';
      plus.disabled = !!underTest;
      if (!underTest) plus.addEventListener('click', function () { stepKey(row.key, +1); });
      ctl.appendChild(minus);
      ctl.appendChild(val);
      ctl.appendChild(plus);
    }
    top.appendChild(left);
    top.appendChild(ctl);
    wrap.appendChild(top);
    wrap.appendChild(el('div', CSS.desc, row.desc));
    if (underTest) wrap.appendChild(el('div', CSS.tag, 'under test — back to your own setting when the test ends'));
    else if (row.otaOnly) wrap.appendChild(el('div', CSS.tag, 'only takes effect from a pushed update, not from here'));
    else if (row.nextDoc) wrap.appendChild(el('div', CSS.tag, 'applies on next video'));
    // The constant's own name, for the one place it is useful: reading a
    // comment in tuning.mjs, or pushing the same number over the air.
    if (row.group === 'advanced') wrap.appendChild(el('div', CSS.key, row.key));
    return wrap;
  }

  // O4 (phase-o): the button text used to hardcode "6 min" for a fixed
  // six arms at sixty seconds each -- true only by coincidence. It is
  // derived from ARMS and ARM_SECS now, so removing an arm (as noAv1
  // was) cannot leave the label promising a runtime the run no longer
  // takes.
  var TEST_MINUTES = Math.round((autoTest.ARMS.length * (autoTest.ARM_SECS + 8)) / 60);

  function testBlock() {
    var wrap = el('div', '');
    var run = autoTest.readRun(win);
    var btn = el('button', CSS.btn, 'Test modes on this video (' + TEST_MINUTES + ' min)');
    btn.type = 'button';
    btn.addEventListener('click', startTest);
    if (!run) wrap.appendChild(btn);

    var prog = run ? autoTest.runProgress(win) : null;
    if (prog) {
      wrap.appendChild(el('div', CSS.note, 'Testing ' + prog.label + ' — mode ' + prog.arm + ' of ' + prog.arms + ', ' + prog.secs + 's'));
      var bar = el('div', CSS.bar);
      bar.appendChild(el('div', CSS.fill + 'width:' + Math.round(prog.frac * 100) + '%;'));
      wrap.appendChild(bar);
      var stop = el('button', CSS.btn, 'Stop test');
      stop.type = 'button';
      stop.addEventListener('click', function () { autoTest.abortRun(win); render(); });
      var stopRow = el('div', CSS.btnRow);
      stopRow.appendChild(stop);
      wrap.appendChild(stopRow);
    }

    var res = autoTest.results(win);
    if (res.length) {
      var best = autoTest.bestRow(res);
      var table = el('table', CSS.table);
      var head = el('tr', '');
      // O10 (phase-o): a row measured with the native engine dead, or
      // with a model quietly running on a different backend than the
      // control row, used to look identical to a clean measurement --
      // the two things `native-client.mjs` already tracks
      // (snapshot().dead, snapshot().backends) never left this module.
      ['Mode', 'Dropped', 'Frame rate', 'Engine'].forEach(function (h) {
        head.appendChild(el('th', CSS.cell + 'color:#9e9e9e;font-weight:600;', h));
      });
      table.appendChild(head);
      for (var i = 0; i < res.length; i++) {
        var arm = autoTest.ARMS[res[i].arm] || { label: 'mode ' + res[i].arm };
        var tr = el('tr', '');
        var mark = i === best ? '  ★ best' : '';
        tr.appendChild(el('td', CSS.cell + (i === best ? 'color:#8d8;' : ''), arm.label + mark));
        tr.appendChild(el('td', CSS.cell, res[i].dropPct === null ? '—' : res[i].dropPct.toFixed(1) + '%'));
        tr.appendChild(el('td', CSS.cell, res[i].rafHz === null ? '—' : Math.round(res[i].rafHz) + ' Hz'));
        var eword = ENGINE_WORD[res[i].nativeBackend] || res[i].nativeBackend || '—';
        var ecell = el(
          'td',
          CSS.cell + (res[i].nativeDead ? 'color:#e77;text-decoration:line-through;' : ''),
          res[i].nativeDead ? eword + ' (died)' : eword,
        );
        tr.appendChild(ecell);
        table.appendChild(tr);
        // A row measured with the blur pill off, or while backgrounded
        // or in the miniplayer, did not exercise what it claims to.
        var caveats = [];
        if (!res[i].blurOn) caveats.push('blur was off');
        if (res[i].hidden) caveats.push('tab was backgrounded');
        if (res[i].mini) caveats.push('miniplayer');
        if (res[i].paused) caveats.push('paused');
        if (caveats.length) {
          var noteTr = el('tr', '');
          var noteTd = el('td', CSS.cell + 'color:#d8a657;font-size:10px;', '(' + caveats.join(', ') + ')');
          noteTd.setAttribute('colspan', '4');
          noteTr.appendChild(noteTd);
          table.appendChild(noteTr);
        }
      }
      wrap.appendChild(table);
    }
    if (message) wrap.appendChild(el('div', CSS.note, message));
    return wrap;
  }

  function build() {
    var p = el('div', CSS.panel);
    p.className = PANEL_CLASS;
    var head = el('div', CSS.head);
    head.appendChild(el('div', CSS.title, 'Tuning'));
    var x = el('button', CSS.x, '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      close();
    });
    head.appendChild(x);
    p.appendChild(head);
    readoutsEl = readoutBlock();
    p.appendChild(readoutsEl);
    testEl = testBlock();
    p.appendChild(testEl);

    // O6 (phase-o): while a mode test is running, the keys IT moves
    // render read-only below, so a press cannot lock in a temporary
    // arm value as a permanent setting. `run.i` is already
    // bounds-checked by readRun; the `||` here is the same second line
    // of defence the panel's results table already uses for ARMS[i].
    var run = autoTest.readRun(win);
    var testingOver = (run && autoTest.ARMS[run.i] && autoTest.ARMS[run.i].over) || null;

    var all = rows();
    for (var g = 0; g < GROUPS.length; g++) {
      var group = GROUPS[g];
      var mine = all.filter(function (r) { return r.group === group; });
      if (!mine.length) continue;
      if (group === 'advanced') {
        var toggle = el('div', CSS.group + 'cursor:pointer;', (advancedOpen ? '▾ ' : '▸ ') + GROUP_LABELS[group]);
        toggle.addEventListener('click', function () { advancedOpen = !advancedOpen; render(); });
        p.appendChild(toggle);
        if (!advancedOpen) continue;
      } else {
        p.appendChild(el('div', CSS.group, GROUP_LABELS[group]));
      }
      for (var i = 0; i < mine.length; i++) {
        var underTest = !!(testingOver && Object.prototype.hasOwnProperty.call(testingOver, mine[i].key));
        p.appendChild(rowEl(mine[i], underTest));
      }
    }

    var btns = el('div', CSS.btnRow);
    var resetBtn = el('button', CSS.btn, 'Reset to shipped');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', reset);
    var reloadBtn = el('button', CSS.btn, 'Reload');
    reloadBtn.type = 'button';
    reloadBtn.addEventListener('click', reload);
    btns.appendChild(resetBtn);
    btns.appendChild(reloadBtn);
    p.appendChild(btns);
    var count = overrides.overrideCount(win);
    if (count) p.appendChild(el('div', CSS.note, count + (count === 1 ? ' setting' : ' settings') + ' changed from shipped'));
    // O1 (phase-o): no bridge, no token -- an edit made here still
    // applies live (this document only) but the next reload forgets
    // it. Said plainly, once, rather than left to look like silence.
    if (!overrides.bridgeAvailable(win)) {
      p.appendChild(el('div', CSS.note, 'Overrides need the Android app — changes apply now but are not remembered after this page.'));
    }
    return p;
  }

  function render() {
    if (!panel) return;
    var next = build();
    if (panel.parentNode) {
      host.removeChild(panel);
      host.appendChild(next);
    }
    panel = next;
  }

  // O8 (phase-o): the 500ms interval calls this, not render() -- it
  // patches only the readouts and the test/progress block, the two
  // pieces that change on their own between presses. Everything else
  // (the dial rows, the reset/reload buttons) is rebuilt only by
  // render(), which runs on an actual press -- infrequent, and exactly
  // when the rows need to reflect a new value anyway.
  function tick() {
    if (!panel) return;
    var freshReadouts = readoutBlock();
    if (readoutsEl && readoutsEl.parentNode) {
      readoutsEl.parentNode.replaceChild(freshReadouts, readoutsEl);
    }
    readoutsEl = freshReadouts;
    var freshTest = testBlock();
    if (testEl && testEl.parentNode) {
      testEl.parentNode.replaceChild(freshTest, testEl);
    }
    testEl = freshTest;
  }

  function open() {
    if (panel) return;
    readouts.reset();
    panel = build();
    host.appendChild(panel);
    try {
      timer = win.setInterval(tick, REFRESH_MS);
    } catch (e) { timer = null; }
  }

  function close() {
    if (timer) {
      try { win.clearInterval(timer); } catch (e) { /* already gone */ }
      timer = null;
    }
    if (panel && panel.parentNode) host.removeChild(panel);
    panel = null;
    message = '';
  }

  function destroy() {
    close();
    try {
      if (doc && typeof doc.removeEventListener === 'function') doc.removeEventListener('click', onDocDown, true);
    } catch (e) { /* nothing to remove */ }
    if (gear.parentNode) host.removeChild(gear);
  }

  // A finished run reloads one last time on his own dials and wants its
  // table read, so the panel opens itself exactly once, then forgets.
  try {
    if (autoTest.takeShow(win)) open();
  } catch (e) { /* an auto-open that fails is not a failure */ }

  return {
    open: open,
    close: close,
    destroy: destroy,
    // The gear is OURS and the caller has to be able to hide it with
    // the pill when the player leaves the watch page. Handing back the
    // element beats a class query against a host the caller resolved
    // separately -- that query read null on the device and the gear
    // rode the feed while the pill correctly hid (2026-09-03).
    gear: gear,
    isOpen: function () { return !!panel; },
    // Test seams: the presses, without synthesising a DOM event.
    _step: stepKey,
    _reset: reset,
  };
}
