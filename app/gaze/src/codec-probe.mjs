// WHICH CODEC THE PLAYER IS ACTUALLY FED (research 2026-09-03, idea #1).
// YouTube may serve AV1 to a phone with no AV1 hardware; nothing in this
// repo had ever read the answer. The player tells MediaSource the mime of
// every SourceBuffer it opens (`addSourceBuffer`) and every codec switch
// (`changeType`); wrapping those two records the family of the last VIDEO
// mime seen. Read-only: the wrappers call through untouched. The report
// carries the family as an enum (av01 / vp09 / avc1 / other / none) and
// the number of times it changed -- a video-id-free number.
var lastFamily = 'none';
var changes = 0;
var installed = false;

export function family(mime) {
  var m = String(mime || '').toLowerCase();
  if (m.indexOf('video/') !== 0) return null;
  if (m.indexOf('av01') !== -1 || m.indexOf('av1') !== -1) return 'av01';
  if (m.indexOf('vp09') !== -1 || m.indexOf('vp9') !== -1) return 'vp09';
  if (m.indexOf('avc1') !== -1 || m.indexOf('avc3') !== -1 || m.indexOf('h264') !== -1) return 'avc1';
  return 'other';
}

export function note(mime) {
  var f = family(mime);
  if (!f) return;
  if (f !== lastFamily) changes++;
  lastFamily = f;
}

export function served() {
  return { codec: lastFamily, codecChanges: changes };
}

export function _resetForTest() {
  lastFamily = 'none';
  changes = 0;
  installed = false;
}

/** Wrap the two MediaSource entry points on `g`; idempotent; false when
 * the page has no MediaSource. Never throws. */
export function install(g) {
  if (installed) return true;
  try {
    var MS = g && g.MediaSource;
    if (!MS || !MS.prototype || typeof MS.prototype.addSourceBuffer !== 'function') return false;
    var addOrig = MS.prototype.addSourceBuffer;
    MS.prototype.addSourceBuffer = function (type) {
      note(type);
      return addOrig.apply(this, arguments);
    };
    var SB = g.SourceBuffer;
    if (SB && SB.prototype && typeof SB.prototype.changeType === 'function') {
      var chOrig = SB.prototype.changeType;
      SB.prototype.changeType = function (type) {
        note(type);
        return chOrig.apply(this, arguments);
      };
    }
    installed = true;
    return true;
  } catch (e) {
    return false;
  }
}
