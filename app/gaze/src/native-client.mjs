// Page-side client for the Android native tensor runner (NativeInfer.kt,
// Task 2's other half) -- and, unmodified per the plan's iOS note, a
// future WKScriptMessageHandler transport. Same call shape as
// worker-client.mjs's player-path API (videoFrame/cropFaces/cropGender/
// releaseCrop/genderOnce/waitMs/backend/dead), so Task 4's transport
// selection can hand either client to the same caller.
//
// This module owns NOTHING policy-shaped: it draws frames to the sizes
// the models want (the SAME squash geometry detector.js's tensor path
// uses today -- see drawTo below), sends them down the port, and turns
// raw model outputs into boxes/reads through face-decode.mjs and
// person-gate.mjs -- the same decode the WebGL Worker path calls. One
// implementation, two transports.
//
// FAIL-SAFE, NEVER FAIL-OPEN: a reply with status != 0, a reply that
// fails to decode, or a request that times out all count as a failure.
// Three in a row and this client marks itself `dead()` so the caller
// (Task 4) falls back to the Worker for the rest of the page -- the
// worst case is exactly today's behaviour, never a wrong answer taken
// as a right one.
import { encodeRequest, decodeReply, parseReady } from './native-frame.mjs';
import { faceRowsFromOutputs, facesFromRows, genderReadsFromOutputs, squareBox } from './face-decode.mjs';
import { parsePersons, frameHasNoHumanShape, frameMaxKp, rejectedSlotBoxes, lastSlotDiag } from './person-gate.mjs';

var MODEL_BLAZEFACE = 1;
var MODEL_FACERES = 2;
var MODEL_MOVENET = 3;

// Both BlazeFace and MoveNet take a 256x256 input on this device (Task 0a
// REPORT.md); faceres takes 224x224. PERSON_LETTERBOX ships OFF
// (detector.js) so this mirrors the SQUASH the tensor path uses today --
// fixing the findings-16b squash is a round, not this task.
var FACE_SIZE = 256;
var PERSON_SIZE = 256;
var GENDER_SIZE = 224;

// One image should never take this long on a tensor runner that is
// answering in tens of milliseconds (Task 1's GPU-REPORT.md); a request
// stuck this long means the port or the interpreter is wedged.
var DEFAULT_REQUEST_TIMEOUT_MS = 4000;
// A native side that never says hello is one that is not coming.
var DEFAULT_READY_TIMEOUT_MS = 15000;
// Crop frames the page is still working on -- see worker-entry.js's
// `crops`. Here the "upload" IS the source bitmap itself (native has no
// GPU-resident frame handle for the page to hold onto), kept alive so a
// later cropGender can re-crop it at 224 per face without asking the
// caller to re-draw the whole frame.
var CROP_TTL_MS = 8000;

export function createNativeClient(port, opts) {
  var o = opts || {};
  var requestTimeoutMs = typeof o.requestTimeoutMs === 'number' ? o.requestTimeoutMs : DEFAULT_REQUEST_TIMEOUT_MS;
  var readyTimeoutMs = typeof o.readyTimeoutMs === 'number' ? o.readyTimeoutMs : DEFAULT_READY_TIMEOUT_MS;

  function nowMs() {
    try {
      return performance.now();
    } catch (e) {
      return Date.now();
    }
  }

  var state = {
    backend: null,
    models: null,
    dead: false,
    consecutiveFailures: 0,
  };
  var pending = new Map();
  var nextReqId = 1;
  // Cumulative ms spent awaiting a native reply -- same contract as
  // worker-client's waitMs: a caller takes a delta across its own pass
  // and subtracts it from the main-thread budget it charges.
  var waitTotal = 0;
  var crops = new Map(); // cid -> { bitmap, at }
  var nextCrop = 1;

  var readyResolve;
  var readyReject;
  var ready = new Promise(function (res, rej) {
    readyResolve = res;
    readyReject = rej;
  });
  var readyTimer = setTimeout(function () {
    die('no native-ready');
  }, readyTimeoutMs);

  function sweepCrops() {
    var now = nowMs();
    crops.forEach(function (c, id) {
      if (now - c.at > CROP_TTL_MS) {
        try {
          c.bitmap.close();
        } catch (e) {
          /* already closed */
        }
        crops.delete(id);
      }
    });
  }

  function die(why) {
    clearTimeout(readyTimer);
    if (state.dead) return;
    state.dead = true;
    pending.forEach(function (p) {
      clearTimeout(p.timer);
      p.reject(new Error('native ' + why));
    });
    pending.clear();
    try {
      readyReject(new Error('native ' + why));
    } catch (e) {
      /* already settled */
    }
  }

  function noteFailure() {
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= 3) die('3 consecutive request failures');
  }
  function noteSuccess() {
    state.consecutiveFailures = 0;
  }

  // One request, one reply, matched by reqId. `rgba` is transferred
  // (zero-copy) -- the caller must not read it again after calling this.
  function send(modelId, w, h, rgba) {
    if (state.dead) return Promise.reject(new Error('native dead'));
    var reqId = nextReqId++;
    var buf;
    try {
      buf = encodeRequest(reqId, modelId, w, h, rgba);
    } catch (e) {
      return Promise.reject(e);
    }
    return new Promise(function (resolve, reject) {
      var askedAt = nowMs();
      var ok = function (v) {
        waitTotal += nowMs() - askedAt;
        resolve(v);
      };
      var bad = function (e) {
        waitTotal += nowMs() - askedAt;
        reject(e);
      };
      var timer = setTimeout(function () {
        pending.delete(reqId);
        noteFailure();
        bad(new Error('native timeout'));
      }, requestTimeoutMs);
      pending.set(reqId, { resolve: ok, reject: bad, timer: timer });
      try {
        port.postMessage(buf, [buf]);
      } catch (e) {
        pending.delete(reqId);
        clearTimeout(timer);
        noteFailure();
        bad(e);
      }
    });
  }

  port.onmessage = function (e) {
    var data = e && e.data;
    if (typeof data === 'string') {
      var msg = parseReady(data);
      if (!msg) return; // not our protocol -- ignore rather than throw
      clearTimeout(readyTimer);
      if (msg.ok) {
        state.backend = msg.backend;
        state.models = msg.models;
        try {
          readyResolve({ backend: msg.backend, models: msg.models });
        } catch (err) {
          /* already settled */
        }
      } else {
        die('native-failed: ' + msg.why);
      }
      return;
    }
    if (!(data instanceof ArrayBuffer)) return;
    var reply;
    try {
      reply = decodeReply(data);
    } catch (err) {
      // Cannot be attributed to one pending request -- but it IS
      // evidence the native side answered something wrong.
      noteFailure();
      return;
    }
    var p = pending.get(reply.reqId);
    if (!p) return; // late reply for a request we already timed out
    pending.delete(reply.reqId);
    clearTimeout(p.timer);
    if (reply.status !== 0) {
      noteFailure();
      p.reject(new Error('native status ' + reply.status));
      return;
    }
    noteSuccess();
    p.resolve(reply);
  };

  // --- drawing --------------------------------------------------------
  //
  // Lazy, reused canvases -- one per input size, exactly like the tensor
  // path reuses one detector module instance per page. Works whether
  // this client lives on the main thread or inside a Worker (no
  // `document` reference anywhere).
  var canvas256 = null;
  var canvas224 = null;
  function canvasFor(size) {
    if (size === GENDER_SIZE) {
      if (!canvas224) canvas224 = new OffscreenCanvas(GENDER_SIZE, GENDER_SIZE);
      return canvas224;
    }
    if (!canvas256) canvas256 = new OffscreenCanvas(FACE_SIZE, FACE_SIZE);
    return canvas256;
  }

  // Whole-frame squash to `size`x`size` -- same geometry as
  // detector.js's tensor path (resizeBilinear with no letterbox pad).
  function drawTo(size, bitmap) {
    var canvas = canvasFor(size);
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(bitmap, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data;
  }

  // A single face crop, aspect-preserving-squared (squareBox) then drawn
  // at GENDER_SIZE. Filled black first: cropAndResize's out-of-range
  // extrapolation is zero, and canvas drawImage's source rect clips
  // (rather than throwing) when it runs off the bitmap, so a black fill
  // is the closest equivalent for the part that clips away.
  function drawSquareCrop(bitmap, sq) {
    var canvas = canvasFor(GENDER_SIZE);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GENDER_SIZE, GENDER_SIZE);
    var sw = bitmap.width;
    var sh = bitmap.height;
    var sx = sq.x1 * sw;
    var sy = sq.y1 * sh;
    var sWidth = (sq.x2 - sq.x1) * sw;
    var sHeight = (sq.y2 - sq.y1) * sh;
    if (sWidth > 0 && sHeight > 0) {
      ctx.drawImage(bitmap, sx, sy, sWidth, sHeight, 0, 0, GENDER_SIZE, GENDER_SIZE);
    }
    return ctx.getImageData(0, 0, GENDER_SIZE, GENDER_SIZE).data;
  }

  // faceres' 3 outputs (gender [N,1], age [N,100], descriptor [N,1024])
  // arrive one-at-a-time from N single-face requests (faceres batch is 1
  // natively -- REPORT.md). Assemble them into the flat layout
  // genderReadsFromOutputs expects, matching each reply's own outputs by
  // LENGTH -- the wire protocol carries no tensor name, only byteLength
  // (see native-frame.mjs), so this is the same "match by size" the
  // BlazeFace decode already does.
  function assembleGenderReads(replies, boxes) {
    var n = boxes.length;
    var genderData = new Float32Array(n);
    var ageData = new Float32Array(n * 100);
    var descData = new Float32Array(n * 1024);
    for (var i = 0; i < replies.length; i++) {
      var sorted = replies[i].outputs.slice().sort(function (a, b) {
        return a.length - b.length;
      });
      genderData[i] = sorted[0][0];
      ageData.set(sorted[1], i * 100);
      descData.set(sorted[2], i * 1024);
    }
    return genderReadsFromOutputs(genderData, ageData, descData, boxes, true);
  }

  // --- player path ------------------------------------------------------

  // All three interpreters load at construction on the Kotlin side
  // (Task 2 Step 2) -- there is no separate "ask for MoveNet" step here,
  // unlike the Worker, which loads it lazily on first use.
  function preloadPerson() {
    return true;
  }

  // One player pass: MoveNet (if withPersons) and BlazeFace (if
  // withFaces) on the SAME 256 frame -- one drawImage/getImageData, two
  // requests, mirroring worker-entry's one-upload-two-models pairing.
  function videoFrame(bitmap, aspect, held, withFaces, withPersons) {
    var wantPersons = withPersons !== false;
    var rgba;
    try {
      rgba = drawTo(PERSON_SIZE, bitmap);
    } catch (e) {
      try {
        bitmap.close();
      } catch (e2) {
        /* already closed */
      }
      return Promise.reject(e);
    }
    var personReq = wantPersons ? send(MODEL_MOVENET, PERSON_SIZE, PERSON_SIZE, rgba) : Promise.resolve(null);
    var faceReq = withFaces ? send(MODEL_BLAZEFACE, PERSON_SIZE, PERSON_SIZE, rgba) : Promise.resolve(null);
    return Promise.all([personReq, faceReq])
      .then(function (r) {
        var personReply = r[0];
        var faceReply = r[1];
        var persons = [];
        var noHumanShape = false;
        var maxKp = null;
        var rejectedBoxes = [];
        if (wantPersons && personReply) {
          // MoveNet's single [1,6,56] output, flattened -- the exact
          // shape parsePersons already reads off a tf tensor .data().
          persons = parsePersons(personReply.outputs[0], undefined, aspect, held);
          // R21: snapshot synchronously, right next to the call that
          // produced it -- see detector.js's detectPersons for why this
          // cannot be deferred into a later tick.
          noHumanShape = frameHasNoHumanShape(lastSlotDiag);
          maxKp = frameMaxKp(lastSlotDiag);
          rejectedBoxes = rejectedSlotBoxes(lastSlotDiag);
        }
        var faces = null;
        if (withFaces && faceReply) {
          faces = facesFromRows(faceRowsFromOutputs(faceReply.outputs));
        }
        return {
          persons: persons,
          // A SKIPPED PASS MUST BE INERT -- see worker-entry.js's
          // handleFrame comment. `wantPersons` false means we never
          // asked, so this must read false regardless of the model.
          noHumanShape: noHumanShape,
          maxKp: maxKp,
          personsSkipped: !wantPersons,
          rejectedBoxes: rejectedBoxes,
          faces: faces,
        };
      })
      .finally(function () {
        try {
          bitmap.close();
        } catch (e) {
          /* already closed */
        }
      });
  }

  // Faces in a person crop, KEEPING the source bitmap alive under a cid
  // so cropGender can re-crop it at 224 per face without a re-upload
  // from the caller.
  function cropFaces(pix) {
    sweepCrops();
    var t0 = nowMs();
    var rgba;
    try {
      rgba = drawTo(FACE_SIZE, pix);
    } catch (e) {
      try {
        pix.close();
      } catch (e2) {
        /* already closed */
      }
      return Promise.reject(e);
    }
    return send(MODEL_BLAZEFACE, FACE_SIZE, FACE_SIZE, rgba).then(
      function (reply) {
        var faces = facesFromRows(faceRowsFromOutputs(reply.outputs));
        var cid = nextCrop++;
        crops.set(cid, { bitmap: pix, at: nowMs() });
        return { cid: cid, faces: faces, ms: Math.round(nowMs() - t0) };
      },
      function (err) {
        try {
          pix.close();
        } catch (e) {
          /* already closed */
        }
        throw err;
      }
    );
  }

  function cropGender(cid, boxes) {
    var c = crops.get(cid);
    if (!c) return Promise.reject(new Error('crop gone'));
    if (!boxes.length) return Promise.resolve({ reads: [] });
    c.at = nowMs();
    var reqs = boxes.map(function (b) {
      var sq = squareBox(b, c.bitmap.width, c.bitmap.height);
      var rgba = drawSquareCrop(c.bitmap, sq);
      return send(MODEL_FACERES, GENDER_SIZE, GENDER_SIZE, rgba);
    });
    return Promise.all(reqs).then(function (replies) {
      return { reads: assembleGenderReads(replies, boxes) };
    });
  }

  function releaseCrop(cid) {
    var c = crops.get(cid);
    if (!c) return;
    try {
      c.bitmap.close();
    } catch (e) {
      /* already closed */
    }
    crops.delete(cid);
  }

  // A one-shot gender read on pixels the caller will not ask about
  // again (native-resolution face re-crop, whole-blur fallback) -- the
  // bitmap is closed here rather than kept, unlike cropFaces.
  function genderOnce(pix, boxes) {
    if (!boxes.length) {
      try {
        pix.close();
      } catch (e) {
        /* already closed */
      }
      return Promise.resolve({ reads: [] });
    }
    var reqs = boxes.map(function (b) {
      var sq = squareBox(b, pix.width, pix.height);
      var rgba = drawSquareCrop(pix, sq);
      return send(MODEL_FACERES, GENDER_SIZE, GENDER_SIZE, rgba);
    });
    return Promise.all(reqs)
      .then(function (replies) {
        return { reads: assembleGenderReads(replies, boxes) };
      })
      .finally(function () {
        try {
          pix.close();
        } catch (e) {
          /* already closed */
        }
      });
  }

  function terminate() {
    die('terminated');
    try {
      if (port.close) port.close();
    } catch (e) {
      /* already gone */
    }
  }

  return {
    ready: ready,
    backend: function () {
      return state.backend;
    },
    dead: function () {
      return state.dead;
    },
    // Mirrors worker-client's genderReady: whether the player path may
    // rely on gender reads. Native loads all three interpreters before
    // ever posting native-ready, so this is just "alive and answered".
    genderReady: function () {
      return !state.dead && !!state.backend;
    },
    preloadPerson: preloadPerson,
    videoFrame: videoFrame,
    cropFaces: cropFaces,
    cropGender: cropGender,
    releaseCrop: releaseCrop,
    genderOnce: genderOnce,
    waitMs: function () {
      return waitTotal;
    },
    terminate: terminate,
  };
}
