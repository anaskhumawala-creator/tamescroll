// Native inference wiring (Task 4, plan 2026-09-02-native-inference):
// the player path talks to whichever engine `vid()` returns -- the
// native TFLite client when Kotlin's port is adopted, ready and the
// NATIVE_INFER dial is on, otherwise the WebGL worker exactly as 1092.
// STRUCTURAL, like delay-wired: init-entry.js is a page script that
// cannot be imported under node, so the shape of the wiring is asserted
// on the source with comments stripped first (phase-G G9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NATIVE_INFER, setNativeInfer } from '../src/native-client.mjs';
import { tunableNames, applyTuning } from '../src/tuning.mjs';

const RAW = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('init-entry imports the native client and its dial as a live binding', () => {
  assert.match(SRC, /import \{ createNativeClient, NATIVE_INFER \} from '\.\/native-client\.mjs';/);
});

test('the port is adopted from the stash or the event, and re-adopted on a re-bind', () => {
  assert.match(SRC, /window\.__TS_NATIVE_PORT \|\| null/);
  assert.match(SRC, /addEventListener\('ts-native-port', adoptNativePort\)/);
  assert.match(SRC, /nativeClient = createNativeClient\(port\)/);
  // A second port for the same document replaces the client instead of
  // leaving one whose port Kotlin has already closed.
  assert.match(SRC, /nativeClient\.terminate\(\)/);
  // Adoption starts with the inference boot, not with the first video.
  assert.match(SRC, /function startInferenceWorker\(\) \{\s*if \(!plan\.boot \|\| failed\) return;\s*watchNativePort\(\);/);
});

test('vid() prefers native only when ready, alive and switched on; workerVideo() follows', () => {
  assert.match(SRC, /function vid\(\) \{\s*return nativeVideo\(\) \? nativeClient : gazeWorker;\s*\}/);
  assert.match(SRC, /return NATIVE_INFER > 0 && nativeClient\.genderReady\(\);/);
  assert.match(SRC, /if \(nativeClient\.dead\(\)\) \{/);
  assert.match(SRC, /function workerVideo\(\) \{\s*if \(nativeVideo\(\)\) return true;/);
});

test('no player-path model call bypasses the accessor', () => {
  // Every engine method the player path uses. A `gazeWorker.<one of
  // these>` left behind is a call the native engine never sees.
  const methods = ['videoFrame', 'cropFaces', 'cropGender', 'releaseCrop', 'genderOnce', 'preloadPerson', 'genderReady'];
  for (const m of methods) {
    const direct = SRC.match(new RegExp(`gazeWorker\\.${m}\\(`, 'g')) || [];
    assert.equal(direct.length, 0, `gazeWorker.${m}( still called directly`);
    const viaAccessor = SRC.match(new RegExp(`vid\\(\\)\\s*\\.${m}\\(`, 'g')) || [];
    assert.ok(viaAccessor.length >= 1, `vid().${m}( never called`);
  }
  // The budget subtracts the wait of the engine that did the work.
  assert.match(SRC, /var waitBase = workerVideo\(\) \? vid\(\)\.waitMs\(\) : null;/);
  assert.match(SRC, /var waited = vid\(\)\.waitMs\(\) - waitBase;/);
});

test('the counters and the probe marker exist and are seeded to 0', () => {
  assert.match(SRC, /d\.life\.nativeReady = 0;\s*d\.life\.nativeFailed = 0;\s*d\.life\.nativeDead = 0;\s*d\.life\.nativePasses = 0;/);
  assert.match(SRC, /if \(nativeVideo\(\)\) nativeLife\('nativePasses'\);\s*return vid\(\)\.videoFrame\(/);
  assert.match(SRC, /window\.__TS_GAZE_NATIVE = window\.__TS_GAZE_NATIVE \|\| \{\}/);
});

test('NATIVE_INFER is on the OTA channel, ships 1, clamps to [0, 1]', () => {
  assert.equal(NATIVE_INFER, 1);
  assert.ok(tunableNames().includes('NATIVE_INFER'));
  applyTuning({ NATIVE_INFER: 0 });
  assert.equal(NATIVE_INFER, 0);
  applyTuning({ NATIVE_INFER: 7 });
  assert.equal(NATIVE_INFER, 1);
  applyTuning({ NATIVE_INFER: -3 });
  assert.equal(NATIVE_INFER, 0);
  setNativeInfer(1);
  assert.equal(NATIVE_INFER, 1);
});
