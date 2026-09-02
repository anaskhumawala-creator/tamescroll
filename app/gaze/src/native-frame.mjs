// Wire format between the page and the native tensor runner
// (NativeInfer.kt on Android; per the plan's iOS note, unmodified for a
// future WKScriptMessageHandler transport). Pure functions only: an
// ArrayBuffer in, an ArrayBuffer or a decoded object out. No transport,
// no port, no timeouts here -- that is native-client.mjs -- so this is
// testable without a fake port at all.
//
// Protocol (docs/superpowers/plans/2026-09-02-native-inference.md):
//   page -> native: ArrayBuffer, 16-byte header
//     [u32 reqId, u32 modelId, u32 width, u32 height] + RGBA bytes
//     (width*height*4), all little-endian.
//   native -> page: ArrayBuffer, 16-byte header
//     [u32 reqId, u32 status(0 ok/1 error), u32 nOutputs, u32 elapsedUs]
//     then per output [u32 byteLength] + little-endian Float32 data.
//
// FAIL-SAFE: a reply that does not fully describe itself -- a declared
// byteLength that runs past the buffer, or a byte count that is not a
// whole number of floats -- THROWS rather than returning a short
// outputs array. A silently-truncated tensor read as real data is worse
// than a request that failed loudly; the caller's job is to reject that
// one request and let the page fall back to the Worker.

var HEADER_BYTES = 16;

/**
 * Page -> native. `rgba` is a Uint8Array-like (Uint8ClampedArray from
 * getImageData works directly) of exactly w*h*4 bytes.
 */
export function encodeRequest(reqId, modelId, w, h, rgba) {
  var expected = w * h * 4;
  if (!rgba || rgba.length !== expected) {
    throw new Error('encodeRequest: rgba length ' + (rgba && rgba.length) + ' != ' + expected + ' (w*h*4)');
  }
  var buf = new ArrayBuffer(HEADER_BYTES + expected);
  var view = new DataView(buf);
  view.setUint32(0, reqId >>> 0, true);
  view.setUint32(4, modelId >>> 0, true);
  view.setUint32(8, w >>> 0, true);
  view.setUint32(12, h >>> 0, true);
  new Uint8Array(buf, HEADER_BYTES).set(rgba);
  return buf;
}

/**
 * Native -> page. Throws on anything short of a complete,
 * self-consistent reply -- see the file header. `outputs[i]` is a
 * Float32Array VIEW into `buf` (no copy, host byte order -- little-
 * endian on every platform this app ships to): the caller must not
 * reuse `buf` for anything else while still reading an output.
 */
export function decodeReply(buf) {
  if (!(buf instanceof ArrayBuffer)) throw new Error('decodeReply: not an ArrayBuffer');
  if (buf.byteLength < HEADER_BYTES) throw new Error('decodeReply: truncated header');
  var view = new DataView(buf);
  var reqId = view.getUint32(0, true);
  var status = view.getUint32(4, true);
  var nOutputs = view.getUint32(8, true);
  var elapsedUs = view.getUint32(12, true);
  var outputs = [];
  var off = HEADER_BYTES;
  for (var i = 0; i < nOutputs; i++) {
    if (off + 4 > buf.byteLength) {
      throw new Error('decodeReply: truncated output ' + i + ' length field');
    }
    var byteLength = view.getUint32(off, true);
    off += 4;
    if (byteLength % 4 !== 0) {
      throw new Error('decodeReply: output ' + i + ' byteLength ' + byteLength + ' is not a multiple of 4');
    }
    if (off + byteLength > buf.byteLength) {
      throw new Error('decodeReply: truncated output ' + i + ' data (declared ' + byteLength + ' bytes)');
    }
    outputs.push(new Float32Array(buf, off, byteLength / 4));
    off += byteLength;
  }
  return { reqId: reqId, status: status, elapsedUs: elapsedUs, outputs: outputs };
}

/**
 * The one-time string message the port sends before any binary traffic:
 * `{"type":"native-ready","backend":...,"models":[...],"initMs":n}` or
 * `{"type":"native-failed","why":"..."}`. Never throws on a message that
 * is not shaped like this protocol -- returns null so the caller can
 * ignore anything else arriving on the same port.
 */
export function parseReady(str) {
  var msg;
  try {
    msg = JSON.parse(str);
  } catch (e) {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  if (msg.type === 'native-ready') {
    return { ok: true, backend: msg.backend || null, models: msg.models || [], initMs: msg.initMs };
  }
  if (msg.type === 'native-failed') {
    return { ok: false, why: msg.why || 'unknown' };
  }
  return null;
}
