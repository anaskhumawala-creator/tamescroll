// The tuning-panel boot wiring in init-entry.js (phase-o O1, O2, O5, O7).
// STRUCTURAL, same reason as native-wired/delay-wired: init-entry.js is a
// page script that cannot be imported under node, so the shape of the
// wiring is asserted on the source with comments stripped first
// (phase-G G9 -- a source match a comment satisfies is a dead check).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const RAW = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('O1: setToken is imported from tuning-override.mjs, aliased for the boot claim', () => {
  assert.match(SRC, /import \{ applyOverrides, overrideBlock, setToken as setOverrideToken \} from '\.\/tuning-override\.mjs';/);
});

test('O1: the one-shot door is claimed exactly once, and handed to both perf.mjs and the override store', () => {
  // Exactly one caller of __TS_TAKE_PERF_TOKEN in the whole bundle --
  // neither module may claim it on its own any more (perf.mjs and
  // tuning-override.mjs both still carry their own fallback claim as a
  // safety net for a caller that skips this wiring, which is why the
  // count is asserted here rather than in either of those modules).
  const claims = SRC.match(/__TS_TAKE_PERF_TOKEN/g) || [];
  assert.equal(claims.length, 1, 'init-entry itself must claim the door exactly once');
  assert.match(SRC, /perf\.provideToken\(perfTok\)/);
  assert.match(SRC, /setOverrideToken\(perfTok\)/);
  // The claim and both hand-offs must happen BEFORE applyOverrides reads
  // the store, or the override bridge has no token yet on its first read.
  const claimAt = SRC.indexOf('perf.provideToken(perfTok)');
  const applyAt = SRC.indexOf('applyOverrides(window)');
  assert.ok(claimAt > 0 && applyAt > claimAt, 'the token must reach both modules before applyOverrides runs');
});

test('O7: applyPendingArm, codecProbe.install and the tuning report block each have their own try', () => {
  // The old shape was one try covering all three -- a throw out of
  // applyPendingArm (a malformed auto-test run state) silently took the
  // codec probe install and the OTA attribution block with it. Three
  // independent try blocks now: a regex anchored on each statement,
  // followed only by whitespace/`}` before the next `catch`, would fail
  // to match if a later statement crept back into an earlier try.
  assert.match(
    SRC,
    /try \{\s*autoTest\.applyPendingArm\(window\);\s*\} catch \(e\) \{\}/,
    'applyPendingArm must be alone in its own try',
  );
  assert.match(
    SRC,
    /try \{\s*[\s\S]*?if \(codecProbe\.CODEC_PROBE === 1\) codecProbe\.install\(window\);\s*\} catch \(e\) \{\}/,
    'codecProbe.install must be alone in its own try',
  );
  assert.match(
    SRC,
    /try \{\s*[\s\S]*?ids\.tuning = \{ applied: TUNED, refused: TUNE_REFUSED, clamped: TUNE_CLAMPED \};\s*\} catch \(e\) \{\}/,
    'the tuning report block must be alone in its own try',
  );
});

test('O2: cancelRun is wired at every place a run\'s owning document can go away', () => {
  const calls = SRC.match(/autoTest\.cancelRun\(window\)/g) || [];
  // the pillWatch teardown (video disconnected or failed) and pagehide
  // (leaving for the launcher, or any other document teardown the
  // shared WebView does not fire a per-video event for). loadstart
  // (SPA watch->watch reuses the <video>) goes through cancelRunOnLoad
  // since 1100 -- our own seek at arm start fires it on the same video.
  assert.equal(calls.length, 2, 'cancelRun must be reachable from pillWatch teardown and pagehide');
  assert.match(SRC, /addEventListener\('loadstart', function \(\) \{\s*(\/\/[^]*\s*)*try \{ autoTest\.cancelRunOnLoad\(window\); \} catch \(e\) \{\}/);
  assert.match(SRC, /if \(!video\.isConnected \|\| failed\) \{\s*clearInterval\(pillWatch\);\s*try \{ autoTest\.cancelRun\(window\); \} catch \(e\) \{\}/);
  assert.match(SRC, /addEventListener\('pagehide', function \(\) \{\s*submitDiag\('pagehide'\);\s*try \{ autoTest\.cancelRun\(window\); \} catch \(e\) \{\}/);
});

test('O5: attachRun is handed a blurOn reader so a row can be told a covered run from an off one', () => {
  assert.match(SRC, /autoTest\.attachRun\(window, \{[\s\S]*?blurOn: function \(\) \{ return !!playerBlurOn; \},[\s\S]*?\}\);/);
});

test('O1 (device, 1100): the door is claimed BEFORE applyTuningFromWindow, whose perf setters take it otherwise', () => {
  const claimAt = SRC.indexOf('perf.provideToken(perfTok)');
  const applyAt = SRC.indexOf('applyTuningFromWindow(window);');
  assert.ok(claimAt > 0 && applyAt > 0);
  assert.ok(claimAt < applyAt, 'the claim must precede the first SPEC setter');
});

test('device 1100: the loadstart hook cancels through cancelRunOnLoad, never the unconditional cancelRun', () => {
  const at = SRC.indexOf("addEventListener('loadstart'");
  assert.ok(at > 0);
  const hook = SRC.slice(at, at + 1200);
  assert.match(hook, /autoTest\.cancelRunOnLoad\(window\)/);
  assert.doesNotMatch(hook, /autoTest\.cancelRun\(window\)/);
});
