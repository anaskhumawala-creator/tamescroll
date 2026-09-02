// GL presenter (PRESENTER_GL, idea #4): the delay line's DOM half on a
// WebGL texture ring. A recording WebGL stub stands in for the context;
// the ring/present policy is delay-core's and is asserted through the
// same observable surface the 2D presenter has (stats, cover filter,
// presentedMediaTime), plus the two fail-safe doors this presenter adds:
// a lost context and a stream the context cannot capture both hand the
// video back through onLost AFTER detaching.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { attachDelayGl, PRESENTER_GL, setPresenterGl } from '../src/gl-presenter.mjs';
import { tunableNames, applyTuning } from '../src/tuning.mjs';

function makeEl(tag) {
  var listeners = {};
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    className: '',
    children: [],
    parentNode: null,
    width: 0,
    height: 0,
    appendChild(c) {
      c.parentNode = this;
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
      c.parentNode = null;
      return c;
    },
    contains(t) {
      return t === this || this.children.some((c) => c === t || (c.contains && c.contains(t)));
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    fire(type, evt) {
      (listeners[type] || []).slice().forEach((fn) => fn(evt || { type: type }));
    },
    listenerCount(type) {
      return (listeners[type] || []).length;
    },
  };
}

// A WebGL1 stand-in: every method records its name; the few that must
// answer do. `failUploads` makes texSubImage2D throw (a tainted stream).
function makeGl(opts) {
  opts = opts || {};
  var calls = [];
  var consts = { TEXTURE_2D: 1, RGBA: 2, UNSIGNED_BYTE: 3, FRAMEBUFFER: 4, COLOR_ATTACHMENT0: 5, ARRAY_BUFFER: 6, FLOAT: 7, STATIC_DRAW: 8, TRIANGLE_STRIP: 9, VERTEX_SHADER: 10, FRAGMENT_SHADER: 11, COMPILE_STATUS: 12, LINK_STATUS: 13, DEPTH_TEST: 14, BLEND: 15, LINEAR: 16, CLAMP_TO_EDGE: 17, TEXTURE_MIN_FILTER: 18, TEXTURE_MAG_FILTER: 19, TEXTURE_WRAP_S: 20, TEXTURE_WRAP_T: 21, TEXTURE0: 22, UNPACK_FLIP_Y_WEBGL: 23, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 24, FRAMEBUFFER_COMPLETE: 0x8cd5, FRAMEBUFFER_UNSUPPORTED: 0x8cdd };
  var answers = {
    createShader: () => ({}),
    createProgram: () => ({}),
    createTexture: () => ({ tex: true }),
    createBuffer: () => ({}),
    createFramebuffer: () => ({}),
    checkFramebufferStatus: () => (opts.fboIncomplete ? 0x8cdd : 0x8cd5),
    getShaderParameter: () => !opts.badShader,
    getProgramParameter: () => true,
    getShaderInfoLog: () => 'nope',
    getProgramInfoLog: () => '',
    getUniformLocation: (p, name) => ({ name: name }),
    readPixels: (x, y, w, h, f, t, buf) => {
      for (var i = 0; i < buf.length; i++) buf[i] = (i * 7) & 255;
    },
    texSubImage2D: () => {
      if (opts.failUploads) throw new Error('SecurityError: tainted');
    },
  };
  var gl = new Proxy(consts, {
    get(target, name) {
      if (name === 'calls') return calls;
      if (name in target) return target[name];
      return function () {
        calls.push({ name: name, args: Array.prototype.slice.call(arguments) });
        if (answers[name]) return answers[name].apply(null, arguments);
        return undefined;
      };
    },
  });
  return gl;
}

function setup(opts) {
  opts = opts || {};
  var gl = opts.noGl ? null : makeGl(opts);
  var doc = makeEl('document');
  doc.hidden = false;
  doc.createElement = function (tag) {
    var el = makeEl(tag);
    if (tag === 'canvas') el.getContext = (kind) => (kind === 'webgl' ? gl : null);
    return el;
  };
  globalThis.document = doc;
  var video = makeEl('video');
  video.currentTime = 0;
  video.playbackRate = 1;
  video.videoWidth = 640;
  video.videoHeight = 360;
  video._cb = null;
  video.requestVideoFrameCallback = opts.noRvfc ? undefined : (cb) => (video._cb = cb);
  var host = makeEl('div');
  host.appendChild(video);
  return { gl: gl, doc: doc, video: video, host: host };
}
function frame(video, mediaTime, atMs) {
  var cb = video._cb;
  assert.ok(cb, 'no rVFC callback registered');
  cb(atMs, { mediaTime: mediaTime });
}
function count(gl, name) {
  return gl.calls.filter((c) => c.name === name).length;
}

test('refuses without rVFC or without a WebGL context, touching nothing', () => {
  var s = setup({ noRvfc: true });
  assert.equal(attachDelayGl(s.video, s.host, { delayMs: 1000 }), null);
  s = setup({ noGl: true });
  assert.equal(attachDelayGl(s.video, s.host, { delayMs: 1000 }), null);
  assert.equal(s.host.children.length, 1, 'no canvas appended');
  assert.equal(s.video.style.opacity, undefined);
  s = setup({ badShader: true });
  assert.equal(attachDelayGl(s.video, s.host, { delayMs: 1000 }), null, 'a shader that will not compile refuses');
  assert.equal(s.host.children.length, 1);
});

test('captures by texture upload, presents at the delay target, and never calls createImageBitmap', () => {
  var s = setup();
  var hadCib = globalThis.createImageBitmap;
  globalThis.createImageBitmap = () => {
    throw new Error('the GL ring must not allocate bitmaps');
  };
  try {
    var p = attachDelayGl(s.video, s.host, { delayMs: 1000 });
    assert.ok(p, 'attached');
    var canvas = s.host.children[1];
    assert.equal(canvas.className, 'ts-gaze-delay');
    assert.equal(s.video.style.opacity, '0');
    assert.match(canvas.style.filter, /blur/, 'covered while refilling');
    // 45 frames at 30fps: 1.5s of media, target = currentTime - 1.0s.
    for (var i = 0; i < 45; i++) {
      s.video.currentTime = i / 30;
      frame(s.video, i / 30, i * 33);
    }
    var st = p.stats();
    assert.equal(st.captured, 45);
    assert.ok(st.presented > 0, 'presented something once a frame was old enough');
    assert.equal(st.refills, 1);
    assert.equal(canvas.style.filter, '', 'uncovered once live');
    assert.ok(p.presentedMediaTime() <= s.video.currentTime - 1.0 + 1e-9, 'presented frame is at least the delay old');
    assert.equal(p.newestMediaTime(), 44 / 30);
    assert.equal(count(s.gl, 'texSubImage2D'), 45, 'one upload per frame');
    assert.ok(s.gl.calls.filter((c) => c.name === 'texSubImage2D').every((c) => c.args[6] === s.video), 'uploads read the video element');
    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 360);
    // The ring evicts to its budget (30fps x 1.5s = 45 frames) and the
    // presented frame's predecessors are released, so it never grows.
    assert.ok(st.ring <= 45 && st.ring > 0, 'ring bounded: ' + st.ring);
    p.detach();
    assert.equal(s.host.children.length, 1, 'canvas removed');
    assert.equal(s.video.style.opacity, '');
    assert.equal(s.video.listenerCount('seeking'), 0);
  } finally {
    globalThis.createImageBitmap = hadCib;
  }
});

test('paintPatches draws the patch list into the presented frame and repaints only on change', () => {
  var s = setup();
  var p = attachDelayGl(s.video, s.host, { delayMs: 500 });
  for (var i = 0; i < 30; i++) {
    s.video.currentTime = i / 30;
    frame(s.video, i / 30, i * 33);
  }
  assert.ok(p.canPaint());
  var before = count(s.gl, 'drawArrays');
  p.paintPatches([{ x: 0.1, y: 0.1, w: 0.3, h: 0.5, br: 0.09, rr: 0.0125 }]);
  var st = p.stats();
  assert.equal(st.patchesDrawn, 1);
  assert.equal(st.repaints, 1);
  assert.ok(count(s.gl, 'drawArrays') > before, 'a repaint draws');
  assert.ok(st.blurLevel >= 1, 'a 58px radius blurs at a downsampled level, not full size');
  var again = count(s.gl, 'drawArrays');
  p.paintPatches([{ x: 0.1, y: 0.1, w: 0.3, h: 0.5, br: 0.09, rr: 0.0125 }]);
  assert.equal(count(s.gl, 'drawArrays'), again, 'same rects, no repaint');
  assert.equal(p.stats().repaints, 1);
  // A frame presented after the list is set carries the patches.
  s.video.currentTime = 31 / 30;
  frame(s.video, 30 / 30, 30 * 33);
  assert.equal(p.stats().patchesDrawn, 1);
  p.paintPatches([]);
  assert.equal(p.stats().patchesDrawn, 0);
  p.detach();
});

test('a lost context detaches and hands the video back through onLost', () => {
  var s = setup();
  var lost = null;
  var p = attachDelayGl(s.video, s.host, {
    delayMs: 500,
    onLost: (why) => {
      lost = why;
      // The wiring re-attaches here; the GL presenter must already be gone.
      assert.equal(s.host.children.length, 1, 'canvas already removed when onLost runs');
      assert.equal(s.video.style.opacity, '', 'video already visible again');
    },
  });
  var canvas = s.host.children[1];
  canvas.fire('webglcontextlost');
  assert.equal(lost, 'contextlost');
  assert.equal(p.stats().lost, 'contextlost');
  assert.equal(p.canPaint(), false);
  p.paintPatches([{ x: 0, y: 0, w: 1, h: 1, br: 0.09, rr: 0 }]); // inert after loss
  assert.equal(p.stats().repaints, 0);
});

test('three consecutive capture failures give the stream back; one does not', () => {
  var s = setup({ failUploads: true });
  var lost = null;
  var p = attachDelayGl(s.video, s.host, { delayMs: 500, onLost: (why) => (lost = why) });
  frame(s.video, 0, 0);
  assert.equal(lost, null, 'one failure is a hiccup');
  assert.equal(p.stats().capFailed, 1);
  frame(s.video, 1 / 30, 33);
  frame(s.video, 2 / 30, 66);
  assert.equal(lost, 'capture');
  assert.equal(p.stats().capFailed, 3);
  assert.equal(s.host.children.length, 1, 'detached');
});

test('requestVerdictFrame reads the newest texture back as a bitmap at its media time', async () => {
  var s = setup();
  var hadImageData = globalThis.ImageData;
  var hadCib = globalThis.createImageBitmap;
  var made = [];
  globalThis.ImageData = function (data, w, h) {
    this.data = data;
    this.width = w;
    this.height = h;
  };
  globalThis.createImageBitmap = (img) => {
    made.push(img);
    return Promise.resolve({ width: img.width, height: img.height, close() {} });
  };
  try {
    var p = attachDelayGl(s.video, s.host, { delayMs: 500 });
    assert.equal(await p.requestVerdictFrame(), null, 'empty ring answers null');
    for (var i = 0; i < 5; i++) {
      s.video.currentTime = i / 30;
      frame(s.video, i / 30, i * 33);
    }
    var r = await p.requestVerdictFrame();
    assert.ok(r && r.bitmap);
    assert.equal(r.mediaTime, 4 / 30);
    assert.equal(made[0].width, 640);
    assert.equal(made[0].height, 360);
    assert.equal(made[0].data.length, 640 * 360 * 4);
    assert.equal(count(s.gl, 'readPixels'), 1, 'one readback per verdict, none per frame');
    p.detach();
  } finally {
    globalThis.ImageData = hadImageData;
    globalThis.createImageBitmap = hadCib;
  }
});

test('locateCut keys the cut at the ring frame with the largest luma jump', () => {
  var s = setup();
  var p = attachDelayGl(s.video, s.host, { delayMs: 500 });
  // readPixels answers the same pattern for every frame, so no jump:
  // the ring must decline rather than invent a cut.
  for (var i = 0; i < 6; i++) frame(s.video, i / 10, i * 100);
  assert.equal(p.locateCut(0.05, 0.5), null);
  assert.ok(count(s.gl, 'readPixels') >= 2, 'frames were read for the delta');
  p.detach();
});

test('PRESENTER_GL is an OTA dial that ships 0 and is inert until a number is pushed', () => {
  assert.equal(PRESENTER_GL, 0);
  assert.ok(tunableNames().includes('PRESENTER_GL'));
  assert.equal(applyTuning({ PRESENTER_GL: 7 }).PRESENTER_GL, 1, 'clamped to the [0,1] edge');
  assert.equal(PRESENTER_GL, 1);
  applyTuning({ PRESENTER_GL: 0 });
  var json = JSON.parse(fs.readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8'));
  assert.equal(json.PRESENTER_GL, 0);
  setPresenterGl(1);
  assert.equal(PRESENTER_GL, 1);
  setPresenterGl(0);
  assert.equal(PRESENTER_GL, 0);
});

test('the wiring tries the GL presenter only at 1, falls back to 2D, and re-attaches 2D on loss', () => {
  var src = fs.readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ attachDelayGl, PRESENTER_GL \} from '\.\/gl-presenter\.mjs';/);
  var fn = src.slice(src.indexOf('function delayAttach()'), src.indexOf('function delayDetach()'));
  assert.match(fn, /PRESENTER_GL === 1 && !glRefused/);
  assert.match(fn, /attachDelayGl\(video, host, \{/);
  assert.match(fn, /glRefused = true;\s*bumpLife\('presenterGlLost'\);\s*if \(presenter === p\) \{\s*delayDetach\(\);\s*delayAttach\(\);/);
  assert.match(fn, /if \(!p\) p = attachDelay\(video, host, \{ delayMs: delayCore\.DELAY_MS, onFrame: null \}\);/);
});

test('an incomplete framebuffer refuses the attach before the canvas is appended (phase-n N4)', () => {
  var s = setup({ fboIncomplete: true });
  var p = attachDelayGl(s.video, s.host, { delayMs: 500 });
  assert.equal(p, null);
  assert.equal(s.host.children.length, 1, 'only the video: no canvas appended');
  assert.ok(count(s.gl, 'checkFramebufferStatus') >= 1, 'the status was read');
  var ok = setup();
  var q = attachDelayGl(ok.video, ok.host, { delayMs: 500 });
  assert.ok(q, 'a complete framebuffer attaches');
  assert.ok(count(ok.gl, 'checkFramebufferStatus') >= 1);
  q.detach();
});
