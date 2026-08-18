// Throwaway spike. Injected as a Tauri v2 initialization_script into
// https://www.reddit.com/ — the worst-case CSP site (default-src 'none').
// Goal: prove or kill inline base64 model delivery + main-thread tfjs
// inference end-to-end, reporting the result via document.title because
// this script cannot fetch/XHR/postMessage anything out on Reddit.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import * as tfconv from '@tensorflow/tfjs-converter';
import { MODEL_JSON, MODEL_WEIGHTS_B64 } from './model-embed.js';

(function () {
  function report(str) {
    try {
      document.title = str;
    } catch (e) {
      // even setting document.title can theoretically throw pre-DOM; ignore
    }
  }

  function fail(stage, err) {
    const msg = err && err.message ? err.message : String(err);
    report('SPIKE_FAIL ' + stage + ': ' + msg.slice(0, 180));
  }

  function b64ToBuffer(b64) {
    const binStr = atob(b64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    return bytes.buffer;
  }

  const ioHandler = {
    // tf.io.IOHandler.load() must return ModelArtifacts — NOT the raw
    // model.json shape. That means weightSpecs (flattened, no `paths`)
    // rather than weightsManifest, plus signature/format so GraphModel
    // can resolve default outputs.
    load: async function () {
      const weightSpecs = [];
      for (const group of MODEL_JSON.weightsManifest) {
        for (const w of group.weights) weightSpecs.push(w);
      }
      return {
        modelTopology: MODEL_JSON.modelTopology,
        weightSpecs: weightSpecs,
        weightData: b64ToBuffer(MODEL_WEIGHTS_B64),
        format: MODEL_JSON.format,
        generatedBy: MODEL_JSON.generatedBy,
        convertedBy: MODEL_JSON.convertedBy,
        userDefinedMetadata: MODEL_JSON.userDefinedMetadata,
      };
    },
  };

  // --- Step: attempt a blob Worker first (expected blocked on Reddit) ---
  // A blocked worker-src does NOT always throw synchronously at `new
  // Worker()` — per spec the CSP violation can instead surface later as an
  // async 'error' event on the worker, with construction itself succeeding.
  // So "did construction throw" is not sufficient; round-trip a postMessage
  // and only call it unblocked if the worker actually replies.
  function tryWorker() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try {
        const blob = new Blob(['self.onmessage=function(){self.postMessage("ok")};'], {
          type: 'application/javascript',
        });
        const url = URL.createObjectURL(blob);
        const w = new Worker(url);
        const cleanup = () => {
          try {
            w.terminate();
            URL.revokeObjectURL(url);
          } catch (e) {
            /* best-effort cleanup */
          }
        };
        w.onerror = (ev) => {
          finish('yes(async-error:' + (ev && ev.message ? ev.message : 'unknown') + ')');
          cleanup();
        };
        w.onmessage = (ev) => {
          finish(ev.data === 'ok' ? 'no' : 'yes(unexpected-reply:' + ev.data + ')');
          cleanup();
        };
        w.postMessage('ping');
        setTimeout(() => {
          finish('yes(timeout-no-reply)');
          cleanup();
        }, 2000);
      } catch (e) {
        finish('yes(sync-throw:' + (e && e.name ? e.name : 'Error') + ':' + (e && e.message ? e.message : e) + ')');
      }
    });
  }

  function findQualifyingImage() {
    const imgs = document.images;
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i];
      if (im.naturalWidth >= 64 && im.complete) return im;
    }
    return null;
  }

  function injectFallbackImage() {
    return new Promise((resolve, reject) => {
      // Plain data: URI — never cross-origin/tainted regardless of backend.
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">' +
        '<rect width="300" height="300" fill="#887766"/>' +
        '<circle cx="150" cy="120" r="60" fill="#eecc99"/>' +
        '</svg>';
      const dataUri = 'data:image/svg+xml;base64,' + btoa(svg);
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('fallback test image failed to decode'));
      im.style.position = 'fixed';
      im.style.top = '-9999px';
      im.style.left = '-9999px';
      im.width = 300;
      im.height = 300;
      im.src = dataUri;
      (document.body || document.documentElement).appendChild(im);
    });
  }

  async function runInference(model, imgEl) {
    const outputs = tf.tidy(() => {
      let img = tf.browser.fromPixels(imgEl); // HWC uint8, avoids 2D-canvas taint on webgl
      img = tf.image.resizeBilinear(img, [256, 256]);
      // tfjs-core alone (no chained-ops registration) exposes only the
      // functional API, not tensor.toFloat()/.div()/.sub() chaining.
      img = tf.cast(img, 'float32');
      img = tf.div(img, 127.5);
      img = tf.sub(img, 1);
      img = tf.expandDims(img, 0);
      return model.execute(img, ['Identity:0', 'Identity_1:0']);
    });
    const [scoresA, scoresB] = outputs;
    const dataA = await scoresA.data();
    const dataB = await scoresB.data();
    tf.dispose(outputs);
    let count = 0;
    for (let i = 0; i < dataA.length; i++) if (dataA[i] > 0) count++;
    for (let i = 0; i < dataB.length; i++) if (dataB[i] > 0) count++;
    return count;
  }

  async function main() {
    const t0 = performance.now();
    const workerBlocked = await tryWorker();

    let backend;
    try {
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        backend = tf.getBackend();
      } catch (eWebgl) {
        await tf.setBackend('cpu');
        await tf.ready();
        backend = tf.getBackend();
      }
    } catch (e) {
      fail('backend-init', e);
      return;
    }
    const tEngine = performance.now();

    let model;
    try {
      model = await tfconv.loadGraphModel(ioHandler);
    } catch (e) {
      fail('model-load', e);
      return;
    }
    const tLoad = performance.now();

    let imgEl = findQualifyingImage();
    let usedFallback = false;
    if (!imgEl) {
      try {
        imgEl = await injectFallbackImage();
        usedFallback = true;
      } catch (e) {
        fail('fallback-image-inject', e);
        return;
      }
    }

    let faces;
    let tInfer0 = performance.now();
    try {
      faces = await runInference(model, imgEl);
    } catch (e) {
      if (!usedFallback) {
        // Real page image likely cross-origin-tainted the canvas path.
        // Retry against the guaranteed-untainted data: URI test image.
        try {
          imgEl = await injectFallbackImage();
          usedFallback = true;
          tInfer0 = performance.now();
          faces = await runInference(model, imgEl);
        } catch (e2) {
          fail('inference-retry(' + (e && e.message ? e.message.slice(0, 60) : e) + ')', e2);
          return;
        }
      } else {
        fail('inference', e);
        return;
      }
    }
    const tInfer1 = performance.now();

    report(
      'SPIKE_OK backend=' +
        backend +
        ' faces=' +
        faces +
        ' ms=' +
        Math.round(tInfer1 - t0) +
        ' worker_blocked=' +
        workerBlocked +
        ' engine_ms=' +
        Math.round(tEngine - t0) +
        ' load_ms=' +
        Math.round(tLoad - tEngine) +
        ' infer_ms=' +
        Math.round(tInfer1 - tInfer0) +
        ' img=' +
        (usedFallback ? 'fallback' : 'page')
    );
  }

  // Guard against running twice: the ceiling timeout and a late-arriving
  // window 'load' event can both call schedule(), and Tauri's own
  // initialization_script is documented to sometimes fire more than once
  // per navigation (tauri#4831, see gaze-research.md).
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    report('SPIKE_LOADED readyState=' + document.readyState);
    // Spec: run on window load plus a 5s delay (let Reddit's own JS settle).
    setTimeout(() => {
      main().catch((e) => fail('unhandled', e));
    }, 5000);
  }

  // Diagnostic breadcrumbs (spike-only): confirm the injected script runs
  // at document-start, and where in the load sequence any stall happens.
  report('SPIKE_INJECTED readyState=' + document.readyState);
  document.addEventListener('DOMContentLoaded', () => {
    report('SPIKE_DOMREADY readyState=' + document.readyState);
  });
  // Hard ceiling: if window 'load' never fires (real-world pages can hang
  // on trackers/analytics indefinitely), run anyway after 20s so the spike
  // still produces a result instead of hanging forever.
  const ceiling = setTimeout(() => {
    report('SPIKE_LOAD_TIMEOUT readyState=' + document.readyState);
    schedule();
  }, 20000);

  if (document.readyState === 'complete') {
    clearTimeout(ceiling);
    schedule();
  } else {
    window.addEventListener('load', () => {
      clearTimeout(ceiling);
      schedule();
    });
  }
})();
