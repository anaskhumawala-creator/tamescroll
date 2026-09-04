// THE BROWSER HALF OF THE GPU BENCH.
//
// tfjs has no GPU backend in node without a CUDA toolkit, and this
// machine has none. It DOES have a 3060 Ti, and Chrome reaches it through
// ANGLE/D3D11 -- so the inference runs in a headless Chrome page on the
// real GPU and the SCORING stays in node, off banked rows, exactly as
// every existing bench already works.
//
// This page is therefore a pure inference producer: it fetches a job,
// runs the SHIPPED detectFaceBoxes / classifyFaceGenders over it, and
// POSTs rows back. It does no analysis, holds no thresholds and makes no
// comparisons -- so a GPU result and a CPU result are the same JSON and
// the same node scorer reads both.
//
// THE BACKEND IS A JOB PARAMETER, NOT A CONSTANT, and that is the point:
// the same page run twice with backend 'webgl' and 'cpu' produces two
// row sets over the identical crops, which is the parity check. WebGL is
// a different arithmetic (fp32 render must be available or tfjs falls
// back to fp16 textures), and this repo has already been bitten once by a
// backend that silently returned garbage -- findings 25, where WebGL on
// Adreno read MoveNet's keypoints at 0.03 while every other backend read
// 0.8. A GPU number is worth nothing until it agrees with the CPU.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders, detectPersons } from '../.cache/shipped.mjs';
import { readPPM, mirror, mirrorBox, degrade, TRANSFORMS } from './arms.mjs';

const say = (m) => {
  const el = document.getElementById('log');
  if (el) el.textContent = m;
  try { navigator.sendBeacon('/progress', m); } catch (e) { /* progress only */ }
};

async function post(path, body) {
  await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body) });
}

async function ppmAt(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return readPPM(new Uint8Array(await r.arrayBuffer()));
}

async function main() {
  const job = await (await fetch('/job.json')).json();

  await tf.setBackend(job.backend);
  await tf.ready();

  // The renderer string is the only proof the page is on the GPU rather
  // than on SwiftShader, which would make every timing here a lie.
  let renderer = 'n/a';
  if (job.backend === 'webgl') {
    try {
      const gl = tf.backend().getGPGPUContext().gl;
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no-debug-ext';
    } catch (e) { renderer = 'unavailable: ' + e.message; }
  }
  say('backend ' + tf.getBackend() + ' | ' + renderer);

  const face = await tfconv.loadGraphModel('/models/blazeface.json');
  const gen = await tfconv.loadGraphModel('/models/faceres.json');

  // Warm both graphs before the clock starts. A WebGL first call pays
  // shader compilation for every kernel in the graph -- on this repo's
  // own Android numbers that is seconds, and charging it to crop #1
  // makes any per-crop timing meaningless.
  const warm = tf.zeros([224, 224, 3], 'int32');
  try {
    await detectFaceBoxes(face, null, warm);
    await classifyFaceGenders(gen, null, [{ x1: 10, y1: 10, x2: 200, y2: 200 }], warm, { square: true });
  } finally { tf.dispose(warm); }

  const rows = [];
  // ============================================ DETECTOR FALSE-FIRE MODE
  // THE HALF NOBODY HAS EVER MEASURED. Findings 35, 38 and 45 each say the
  // same sentence: every junk-patch number this repo owns is CONDITIONAL ON
  // DETECTION, because the corpus holds only crops BlazeFace already fired
  // on. 19.1% (video) and 7.6% (image) are lower bounds on a base rate
  // nobody has measured. His loudest complaint -- 'randomly just blur some
  // text' -- lives entirely in that gap.
  //
  // Finding 38 measured detector RECALL (0.4% missed at 48px, no bias) and
  // says in its own words that it is 'structurally blind to FALSE
  // POSITIVES', because one face was present in every frame it scored.
  //
  // So: run the FULL shipped chain over whole 640x360 frames -- the exact
  // resolution his player decodes -- and record, per frame, what BlazeFace
  // reported, what MoveNet reported, and what faceres then read on every
  // box. A frame where BlazeFace fires and MoveNet admits NOBODY is the
  // candidate false fire, and the gender read on it decides whether it
  // would actually mint a patch under the shipped rules.
  //
  // MoveNet is the negative oracle, and that choice is defensible ONLY
  // because findings 25 and 38 established it works on a real GPU (the
  // Adreno blindness was the WebGL runtime, not the model). It is still an
  // oracle and not ground truth -- crops are banked so a sample can be
  // eyeballed rather than taken on trust.
  if (job.mode === 'detect') {
    const person = await tfconv.loadGraphModel('/models/movenet-multipose.json');
    {
      const w2 = tf.zeros([360, 640, 3], 'int32');
      try { await detectPersons(person, null, 640 / 360, null, w2); } finally { tf.dispose(w2); }
    }
    const out = [];
    const t0 = performance.now();
    let noPPM = 0, k = 0;
    for (const w of job.work) {
      const ppm = await ppmAt('/crops/' + w.crop);
      if (!ppm) { noPPM++; k++; continue; }
      const img = tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32');
      const row = Object.assign({}, w, { w: ppm.w, h: ppm.h });
      try {
        const persons = await detectPersons(person, null, ppm.w / ppm.h, null, img);
        row.nPersons = persons.length;
        row.maxKp = persons.maxKp;
        row.noShape = !!persons.noHumanShape;
        // The person object is FLAT (person-gate.mjs:1004), not {box:{...}}.
        row.pboxes = persons.map((p) => [p.x1, p.y1, p.x2, p.y2, p.confidence]);

        const boxes = await detectFaceBoxes(face, null, img);
        row.faces = [];
        if (boxes.length) {
          const reads = await classifyFaceGenders(gen, null, boxes, img, { square: true });
          for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i], g = reads[i] || {};
            const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
            row.faces.push({
              box: [b.x1, b.y1, b.x2, b.y2],
              conf: b.confidence,
              px: Math.round((b.x2 - b.x1) * ppm.w),
              raw: g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2,
              s: g.score, g: g.gender, age: g.age, childP: g.childP,
              nm: g.shape ? g.shape.norm : null,
              // Corroborated by MoveNet? A face inside an admitted person
              // box is a person the other model also sees.
              inP: row.pboxes.some((q) => cx >= q[0] && cx <= q[2] && cy >= q[1] && cy <= q[3]),
            });
          }
        }
      } finally { tf.dispose(img); }
      out.push(row);
      k++;
      if (k % 25 === 0) {
        const rate = k / ((performance.now() - t0) / 1000);
        say('detect ' + k + '/' + job.work.length + '  ' + rate.toFixed(2) + ' frame/s');
      }
    }
    const secs2 = (performance.now() - t0) / 1000;
    await post('/done', { ok: true, backend: tf.getBackend(), renderer, secs: secs2,
      rate: out.length / secs2, noPPM, noFace: 0, rows: out });
    say('COMPLETE ' + out.length + ' frames in ' + secs2.toFixed(1) + 's');
    return;
  }
  let done = 0, noPPM = 0, noFace = 0;
  const t0 = performance.now();

  for (const w of job.work) {
    const ppm = await ppmAt('/crops/' + w.crop);
    if (!ppm) { noPPM++; done++; continue; }
    const n = ppm.w * ppm.h;

    // Detect ONCE on the untouched crop; every arm reuses the box.
    const base = tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32');
    let box = null;
    try {
      for (const b of await detectFaceBoxes(face, null, base)) {
        if (!box || (b.x2 - b.x1) * (b.y2 - b.y1) > (box.x2 - box.x1) * (box.y2 - box.y1)) box = b;
      }
    } finally { tf.dispose(base); }
    if (!box) { noFace++; done++; continue; }

    // SIZE AUGMENTATION. `job.sizes` lists NATIVE pixel sizes; each one
    // emits its own row, so 10,580 portraits become 10,580 x |sizes|
    // training examples spanning his real 34-192px band instead of only
    // FairFace's ideal 224. This is the fix for the transfer failure:
    // a head trained on clean portraits alone was WORSE than the shipped
    // one on his corpus (23.8% vs 21.8%) while beating it by 18 points
    // on held-out FairFace.
    //
    // The box is detected once on the UNDEGRADED crop and reused at every
    // size, so a size result can never be confounded with a detector
    // result. Finding 38 already priced detection separately.
    const sizes = (job.sizes && job.sizes.length) ? job.sizes : [0];
    for (const px0 of sizes) {
    const src = px0 ? degrade(ppm.data, ppm.w, ppm.h, px0) : ppm.data;
    const row = Object.assign({}, w);
    if (px0) row.nativePx = px0;
    for (const a of job.arms) {
      const fn = TRANSFORMS[a];
      if (!fn) throw new Error('unknown arm ' + a);
      const px = fn(src, n);

      const img = tf.tensor3d(px, [ppm.h, ppm.w, 3], 'int32');
      let g;
      try {
        g = (await classifyFaceGenders(gen, null, [box], img, { square: true }))[0];
      } finally { tf.dispose(img); }

      // Mirror-averaging, when asked for: the SAME arm's pixels flipped,
      // with the box flipped to match, averaged in raw space.
      if (job.mirror) {
        const mi = tf.tensor3d(mirror(px, ppm.w, ppm.h), [ppm.h, ppm.w, 3], 'int32');
        let gm;
        try {
          gm = (await classifyFaceGenders(gen, null, [mirrorBox(box)], mi, { square: true }))[0];
        } finally { tf.dispose(mi); }
        const r1 = g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2;
        const r2 = gm.gender === 'male' ? 0.5 + gm.score / 2 : 0.5 - gm.score / 2;
        row[a + 'Mir'] = { raw: (r1 + r2) / 2 };
      }

      row[a] = {
        raw: g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2,
        s: g.score, g: g.gender, age: g.age, childP: g.childP,
        nm: g.shape ? g.shape.norm : null,
      };
      // The field is `desc`, not `descriptor` -- face-decode.mjs:237.
      // It is already L2-normalised there, so a cosine is a dot product.
      if (job.keepDesc && g.desc) row[a + 'Desc'] = Array.from(g.desc);
    }
    rows.push(row);
    done++;
    }
    if (done % 25 === 0) {
      const rate = done / ((performance.now() - t0) / 1000);
      say('done ' + done + '/' + (job.work.length * ((job.sizes && job.sizes.length) || 1)) + '  ' + rate.toFixed(2) + ' crop/s  noFace ' + noFace);
    }
  }

  const secs = (performance.now() - t0) / 1000;
  await post('/done', {
    ok: true, backend: tf.getBackend(), renderer,
    secs, rate: rows.length / secs, noPPM, noFace, rows,
  });
  say('COMPLETE ' + rows.length + ' rows in ' + secs.toFixed(1) + 's');
}

main().catch(async (e) => {
  say('FAILED ' + e.message);
  try { await post('/done', { ok: false, error: String(e && e.stack || e) }); } catch (x) { /* server gone */ }
});
