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
  // Phase-j J6: the port comes ONLY from the stash's one-shot taker,
  // never from an assignable global a page script could own.
  assert.match(SRC, /var take = window\.__TS_TAKE_NATIVE_PORT;\s*port = typeof take === 'function' \? take\(\) \|\| null : null;/);
  assert.doesNotMatch(SRC, /window\.__TS_NATIVE_PORT\b/);
  assert.match(SRC, /addEventListener\('ts-native-port', adoptNativePort\)/);
  assert.match(SRC, /nativeClient = createNativeClient\(port, \{\s*onReply: function \(ok\) \{\s*nativeLife\(ok \? 'nativeReplies' : 'nativeErrors'\);/);
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
    // A crop chain binds the accessor's answer to a local ONCE (J7), so
    // cropFaces/cropGender/releaseCrop are reached through that local.
    const viaAccessor = SRC.match(new RegExp(`(vid\\(\\)|\\beng|\\bzeng)\\s*\\.${m}\\(`, 'g')) || [];
    assert.ok(viaAccessor.length >= 1, `vid().${m}( never called`);
  }
  // The budget subtracts the wait of the engine that did the work, read
  // from ONE engine at both ends (phase-j J8).
  assert.match(SRC, /var waitEng = workerVideo\(\) \? vid\(\) : null;\s*var waitBase = waitEng \? waitEng\.waitMs\(\) : null;/);
  assert.match(SRC, /var waited = waitEng\.waitMs\(\) - waitBase;/);
  assert.doesNotMatch(SRC, /vid\(\)\.waitMs\(\)/);
  // A cid is read and released by the client that minted it (J7).
  assert.match(SRC, /var eng = vid\(\);\s*return eng\.cropFaces\(pixels\)/);
  assert.match(SRC, /\(zeng = vid\(\)\)\.cropFaces\(zpix\)/);
  assert.match(SRC, /zeng\.cropGender\(zcid, faces\)/);
  assert.match(SRC, /zeng\.releaseCrop\(zcid\)/);
  assert.doesNotMatch(SRC, /vid\(\)\.cropGender\(/);
  assert.doesNotMatch(SRC, /vid\(\)\.releaseCrop\(/);
});

test('every VIDEO gender crop is squared in pixels, like the image path (phase-j J1)', () => {
  // classifyFaceGenders squares the crop only with {square: true}; a call
  // without it feeds faceres a normalized-square box, which on 16:9 is a
  // 1.78:1 rectangle stretched to 224x224 -- the findings-16a defect.
  for (const f of ['init-entry.js', 'worker-entry.js']) {
    const src = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const calls = src.match(/classifyFaceGenders\([^;]*?\)(?=\s*[;.])/g) || [];
    assert.ok(calls.length >= 2, f + ': no classifyFaceGenders calls found');
    for (const call of calls) assert.match(call, /\{ square: true \}/, f + ': ' + call);
  }
});

test('the counters and the probe marker exist and are seeded to 0', () => {
  assert.match(SRC, /d\.life\.nativeReady = 0;\s*d\.life\.nativeFailed = 0;\s*d\.life\.nativeDead = 0;\s*d\.life\.nativePasses = 0;/);
  // Phase-j J9: counted on the resolved frame, not on the intent.
  assert.match(SRC, /var onNative = nativeVideo\(\);\s*return vid\(\)\s*\.videoFrame\([^)]*\)\s*\.then\(function \(r\) \{[^}]*if \(onNative\) nativeLife\('nativePasses'\);/);
  assert.doesNotMatch(SRC, /nativeLife\('nativePasses'\);\s*return vid\(\)/);
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

test('the parity hook is flag-gated and nothing in the app sets the flag', () => {
  assert.match(SRC, /if \(!window\.__TS_NATIVE_PARITY\) return;\s*window\.__TS_GAZE_ENGINES = \{/);
  assert.doesNotMatch(SRC, /__TS_NATIVE_PARITY\s*=[^=]/);
  const files = ['init-entry.js', 'native-client.mjs', 'worker-client.mjs', 'worker-entry.js'];
  for (const f of files) {
    let src = '';
    try {
      src = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    } catch (e) {
      continue;
    }
    assert.doesNotMatch(src, /__TS_NATIVE_PARITY\s*=[^=]/, f + ' sets the parity flag');
  }
});
