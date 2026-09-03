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
//   * IT CANNOT FAIL A BOOT. No bridge, no token, a malformed value or a
//     store that throws all read as "no overrides", which is the shipped
//     behaviour, which is the measured behaviour.
//
// O1 (phase-o), THE STORE ITSELF: this used to be `window.localStorage`,
// keyed `tamescroll.tuning`. localStorage on m.youtube belongs to the
// PAGE -- so any script on YouTube's own origin, or one it loads, could
// read AND WRITE that key and weaken any dial the panel can reach
// (GENDER_CLEAR_SCORE included), silently, no build, no OTA push. The
// same shape as the pre-N8 TsPerf hole, and the same fix: the store now
// lives behind `window.TsTune`, a Kotlin bridge (MainActivity, beside
// PerfBridge) gated on the SAME per-document token PerfBridge already
// uses. `setToken` receives it once, from init-entry, which claims
// `__TS_TAKE_PERF_TOKEN` itself and hands the same string to both
// perf.mjs and this module -- neither module claims the one-shot door
// on its own any more.
//
// No bridge, or a token that never arrived (desktop; a page that lost
// the claim race): the store is EMPTY, always, on every boot -- nothing
// persists. A dial moved through `setOverride` in that document still
// applies live (ACTIVE, and the constant itself, both update) and still
// rides `activeOverrides()` into the report; only the next navigation
// forgets it. The panel names this state so it is never mistaken for
// silence: `bridgeAvailable` is false and it says so.
//
// ORDER AT BOOT MATTERS AND IS FIXED: applyTuningFromWindow (OTA) first,
// then applyOverrides. A key he has set locally wins over the pushed
// value FOR THAT KEY only -- everything he has not touched still tracks
// whatever the OTA says, so a protection fix pushed tonight still lands
// on a phone with a couple of speed dials set.
import { applyOne, specRange, tunableNames } from './tuning.mjs';

// What actually took effect at the last applyOverrides/setOverride, for
// the report AND for the panel's override count -- it is the only
// number that is right in every mode, bridge-backed or memory-only.
var ACTIVE = {};

var perfToken = null;

/** Called once, at boot, by init-entry with the SAME token it handed
 * perf.mjs. A no-op for anything that is not a non-empty string, so a
 * caller that failed to claim the door cannot overwrite a token this
 * module already has. */
export function setToken(t) {
  perfToken = typeof t === 'string' && t ? t : null;
}

/** Test seam only. Production code must go through setToken, which is
 * fed by the one real door (__TS_TAKE_PERF_TOKEN). */
export function _setTokenForTest(t) { perfToken = t; }

function bridge(g) {
  try {
    var w = g || (typeof window !== 'undefined' ? window : null);
    var b = w && w.TsTune;
    return b && typeof b.get === 'function' && typeof b.set === 'function' ? b : null;
  } catch (e) {
    return null;
  }
}

/** True only when there is both a bridge to call and a token to call it
 * with. The panel reads this to decide between "N overrides" and
 * "Overrides need the Android app". */
export function bridgeAvailable(g) {
  return !!bridge(g) && typeof perfToken === 'string' && !!perfToken;
}

/**
 * The stored overrides, filtered to whitelisted keys carrying finite
 * numbers. Everything else -- an unknown key, a string, a null, a
 * malformed document, a missing bridge, a wrong or absent token -- is
 * dropped here, so nothing downstream has to ask whether the store can
 * be trusted.
 */
export function readOverrides(g) {
  var b = bridge(g);
  if (!b || !bridgeAvailable(g)) return {};
  var raw;
  try {
    raw = b.get(perfToken);
  } catch (e) {
    return {};
  }
  if (!raw || typeof raw !== 'string') return {};
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

/** Best-effort persist. No bridge / no token means "this document only"
 * -- the caller has already applied the value live and updated ACTIVE
 * before this runs, so a false return here costs persistence, never
 * the live effect. */
function write(g, obj) {
  var b = bridge(g);
  if (!b || !bridgeAvailable(g)) return false;
  try {
    var json = obj && Object.keys(obj).length ? JSON.stringify(obj) : '';
    b.set(perfToken, json);
    return true;
  } catch (e) {
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
 * re-applied on every boot from now on. Storing is best-effort: without
 * a bridge the value still lands in ACTIVE (live, and in the report) --
 * only the next document forgets it.
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

/** How many dials are ACTUALLY moved right now -- ACTIVE, not the
 * persistent store, so a memory-only session (no bridge) still reports
 * itself honestly instead of claiming zero while dials sit overridden. */
export function overrideCount(g) {
  return Object.keys(ACTIVE).length;
}

/** The report block: a count and the numbers themselves under their own
 * constant names. No strings, so the report's violation walker has
 * nothing to check beyond "is it finite".
 *
 * O3 (phase-o): this used to read `readOverrides(g)` -- the RAW stored
 * value, before `applyOne`'s clamp. `readOverrides` filters to finite
 * numbers under whitelisted keys, but a value stored before a clamp
 * tightened (or hand-edited on disk) could sit outside today's range,
 * and the report would show a number that was never the number actually
 * running. `activeOverrides()` is what the last apply put into the
 * modules -- always inside today's clamp, because `applyOne` computed
 * it. */
export function overrideBlock(g) {
  var active = activeOverrides();
  return { count: Object.keys(active).length, applied: active };
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
