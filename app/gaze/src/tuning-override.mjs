// THE LOCAL OVERRIDE LAYER: one phone, one dial, now.
//
// `tuning.mjs` is the OTA channel -- a number moves for every device at
// once, and it costs a push plus a rules refresh before anyone can see
// what it did. That is the right shape for shipping a decision and the
// wrong shape for MAKING one, because every dial in that file was priced
// on a corpus or on one Redmi and the phone that matters is his.
//
// So this is a second writer into the same constants, and it is deliberately
// the smallest one that can exist:
//
//   * IT REUSES THE WHITELIST. Every write goes through `tuning.applyOne`,
//     which is the same SPEC table, the same clamps and the same refusal
//     the OTA payload meets. A key this build does not know is not stored
//     and not applied; a value outside its range is pulled to the edge
//     before it is stored, so what is in the store is always something
//     the clamp already considered safe.
//   * IT IS THE ONLY READER OF localStorage IN THE GAZE RUNTIME. One
//     key, one JSON object of numbers.
//   * IT CANNOT FAIL A BOOT. Private windows, blocked storage and a
//     malformed value all read as "no overrides", which is the shipped
//     behaviour, which is the measured behaviour.
//
// ORDER AT BOOT MATTERS AND IS FIXED: applyTuningFromWindow (OTA) first,
// then applyOverrides. A key he has set locally wins over the pushed
// value FOR THAT KEY only -- everything he has not touched still tracks
// whatever the OTA says, so a protection fix pushed tonight still lands
// on a phone with a couple of speed dials set.
import { applyOne, specRange, tunableNames } from './tuning.mjs';

export var STORE_KEY = 'tamescroll.tuning';

// What actually took effect at the last applyOverrides/setOverride, for
// the report. Numbers under our own constant names, nothing else.
var ACTIVE = {};

function storage(g) {
  try {
    var w = g || (typeof window !== 'undefined' ? window : null);
    var s = w && w.localStorage;
    return s && typeof s.getItem === 'function' ? s : null;
  } catch (e) {
    // Reading `localStorage` THROWS on a page with site data blocked --
    // it is not merely absent. Same class as the CORS reads in the image
    // path: the failure is the answer, and the answer is "no overrides".
    return null;
  }
}

/**
 * The stored overrides, filtered to whitelisted keys carrying finite
 * numbers. Everything else -- an unknown key, a string, a null, a
 * malformed document -- is dropped here, so nothing downstream has to
 * ask whether the store can be trusted.
 */
export function readOverrides(g) {
  var s = storage(g);
  if (!s) return {};
  var raw;
  try {
    raw = s.getItem(STORE_KEY);
  } catch (e) {
    return {};
  }
  if (!raw) return {};
  var obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    return {};
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  var out = {};
  var names = tunableNames();
  for (var i = 0; i < names.length; i++) {
    var k = names[i];
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    var v = obj[k];
    if (typeof v !== 'number' || !isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}

function write(g, obj) {
  var s = storage(g);
  if (!s) return false;
  try {
    if (!obj || !Object.keys(obj).length) s.removeItem(STORE_KEY);
    else s.setItem(STORE_KEY, JSON.stringify(obj));
    return true;
  } catch (e) {
    // A quota or a security error means the dial moves for this session
    // and not for the next one. That is a worse outcome than persisting
    // and a much better one than not moving at all.
    return false;
  }
}

/** Apply the stored overrides on top of whatever the OTA left. Returns
 * what took effect. Never throws. */
export function applyOverrides(g) {
  var raw = readOverrides(g);
  var applied = {};
  for (var k in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    var c = applyOne(k, raw[k]);
    if (c !== null) applied[k] = c;
  }
  ACTIVE = applied;
  return applied;
}

/**
 * Move one dial: clamp it, apply it live, remember it. Returns the value
 * that took effect, or null if the key or value was refused.
 *
 * Applying comes FIRST and storing second on purpose -- a value the SPEC
 * setter throws on must not end up in the store, where it would be
 * re-applied on every boot from now on.
 */
export function setOverride(g, key, value) {
  var c = applyOne(key, value);
  if (c === null) return null;
  var next = readOverrides(g);
  next[key] = c;
  write(g, next);
  ACTIVE[key] = c;
  return c;
}

/**
 * Forget every override and put the dials back where the OTA left them.
 *
 * `shipped` is the map to restore to -- init-entry passes what
 * applyTuningFromWindow produced plus the build's own defaults, because
 * this module cannot know what a dial was before somebody overrode it.
 * Without it, clearing the store would leave the overridden value in the
 * module until the next navigation, which reads as "reset did nothing".
 */
export function clearOverrides(g, shipped) {
  write(g, null);
  ACTIVE = {};
  if (shipped && typeof shipped === 'object') {
    for (var k in shipped) {
      if (!Object.prototype.hasOwnProperty.call(shipped, k)) continue;
      applyOne(k, shipped[k]);
    }
  }
  return {};
}

/** Drop one dial back to `shipped`, keeping the rest. */
export function clearOverride(g, key, shippedValue) {
  var next = readOverrides(g);
  delete next[key];
  write(g, next);
  delete ACTIVE[key];
  if (typeof shippedValue === 'number') applyOne(key, shippedValue);
  return next;
}

export function overrideCount(g) {
  return Object.keys(readOverrides(g)).length;
}

/** The report block: a count and the numbers themselves under their own
 * constant names. No strings, so the report's violation walker has
 * nothing to check beyond "is it finite". */
export function overrideBlock(g) {
  var applied = readOverrides(g);
  return { count: Object.keys(applied).length, applied: applied };
}

/** What the last apply put into the modules, for a caller that already
 * read the store and does not want to read it again. */
export function activeOverrides() {
  return ACTIVE;
}

/** The clamp, re-exported so the panel has exactly one source for it. */
export function rangeOf(key) {
  return specRange(key);
}
