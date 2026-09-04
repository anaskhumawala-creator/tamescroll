// THE PIXEL ARMS, IN ONE PLACE, BECAUSE THREE BENCHES HAD THEIR OWN COPY.
//
// colour-arms, grey-corpus and grey-mirror-stack each carried their own
// `greyBy`/`luma`, and grey-mirror-stack's mirror also had to re-express
// the detector box. Three copies of a transform that decides a published
// number is the same defect class as the re-derived shipped rule (phase-g
// G1/G5/G9): the copies drift and no test can see it.
//
// Every function here is pure JS over a flat RGB byte buffer, so the same
// module runs in node (CPU bench) and in the browser (GPU bench) and both
// sides are byte-identical by construction -- which is the whole point,
// because a CPU-vs-GPU parity check is worthless if the two arms differ
// in their preprocessing rather than their backend.
//
// A transform NEVER touches the detector box. Detection runs once on the
// untouched crop and the box is reused, so a gender result can never be
// confounded with a detector result.

export const L601 = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Replicate a per-pixel scalar back to three channels. */
function toRGB(v, n) {
  const out = new Uint8Array(n * 3);
  for (let p = 0; p < n; p++) {
    const c = Math.max(0, Math.min(255, Math.round(v[p])));
    out[p * 3] = c; out[p * 3 + 1] = c; out[p * 3 + 2] = c;
  }
  return out;
}

/** Any per-pixel (r,g,b)->scalar, replicated to grey. */
export function greyBy(d, n, f) {
  const v = new Float64Array(n);
  for (let p = 0; p < n; p++) v[p] = f(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]);
  return toRGB(v, n);
}

export const armGrey = (d, n) => greyBy(d, n, L601);
export const armBlue = (d, n) => greyBy(d, n, (r, g, b) => b);
export const armRed = (d, n) => greyBy(d, n, (r) => r);
export const armGreen = (d, n) => greyBy(d, n, (r, g) => g);
export const armGamma = (d, n) => greyBy(d, n, (r, g, b) => 255 * Math.pow(L601(r, g, b) / 255, 0.7));
export const armInvert = (d, n) => greyBy(d, n, (r, g, b) => 255 - L601(r, g, b));

/** Horizontal flip of a w*h RGB buffer. */
export function mirror(d, w, h) {
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const row = y * w * 3;
    for (let x = 0; x < w; x++) {
      const s = row + x * 3, t = row + (w - 1 - x) * 3;
      out[t] = d[s]; out[t + 1] = d[s + 1]; out[t + 2] = d[s + 2];
    }
  }
  return out;
}

/**
 * The box, re-expressed for a mirrored image.
 *
 * BOXES ARE NORMALISED, NOT PIXELS, and getting that wrong is how the
 * first run of this bench "measured" mirror-averaging as worthless.
 * classifyFaceGenders hands the box straight to tf.image.cropAndResize,
 * whose rects are [0,1] fractions of the source -- so the flip is
 * 1 - x, and flipping by pixel width instead sends the crop far off the
 * face. The tell was mirror reading 66% of small women as male against
 * rgb’s 36.9%: a crop of nothing reads as the model’s prior, which is
 * male-leaning, so a bad crop looks exactly like a bad ARM.
 *
 * Mirroring the pixels and NOT the box is the same bug one step milder.
 */
export function mirrorBox(box) {
  return Object.assign({}, box, { x1: 1 - box.x2, x2: 1 - box.x1 });
}

/** Minimal P6 PPM reader. Shared so node and browser parse identically. */
export function readPPM(bytes) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x36) return null;
  let i = 2; const nums = [];
  while (nums.length < 3) {
    while (i < bytes.length && /\s/.test(String.fromCharCode(bytes[i]))) i++;
    if (bytes[i] === 0x23) { while (i < bytes.length && bytes[i] !== 0x0a) i++; continue; }
    let s = '';
    while (i < bytes.length && !/\s/.test(String.fromCharCode(bytes[i]))) s += String.fromCharCode(bytes[i++]);
    nums.push(Number(s));
  }
  i++;
  const w = nums[0], h = nums[1];
  return { w, h, data: bytes.subarray(i, i + w * h * 3) };
}

/** name -> (bytes,n) transform. `rgb` is the identity and must stay first. */
export const TRANSFORMS = {
  rgb: (d) => d,
  grey: armGrey,
  blueOnly: armBlue,
  redOnly: armRed,
  greenOnly: armGreen,
  gammaUp: armGamma,
  invert: armInvert,
};

/**
 * DEGRADE A CROP TO A NATIVE PIXEL SIZE AND BACK -- the augmentation the
 * head retrain needs, and the reason the first retrained head did not
 * transfer.
 *
 * FairFace crops are clean 224px aligned portraits. His faces reach
 * faceres at 34-192 native px (corpus p05/p50/p95), pulled off a 640x360
 * stream. A head trained on the former reads the latter as a different
 * distribution: on held-out FairFace a retrained head took Indian women
 * 44.4% -> 16.2% wrong, and the SAME head on his corpus was WORSE than
 * the shipped one (23.8% against 21.8% false cover at matched exposure).
 * The information was there; the head had learned ideal conditions.
 *
 * WHAT PRODUCTION ACTUALLY DOES, and this mimics exactly that: the
 * detector box is cut from the frame at native resolution -- N x N real
 * pixels -- and `tf.image.cropAndResize` then interpolates it up to
 * faceres' 224. So the information content is N x N and the tensor is
 * 224 x 224. Reproduce it by box-downsampling to N and bilinearly
 * upsampling back.
 *
 * BOX FILTER DOWN, BILINEAR UP, and the pair matters. A nearest-neighbour
 * downscale would ALIAS -- it samples one pixel per cell and throws the
 * rest away, which is not what a real capture does and would make small
 * sizes look artificially noisy rather than artificially soft. Bilinear
 * up is what cropAndResize itself uses.
 *
 * NEVER TOUCHES THE DETECTOR BOX, same contract as every other transform
 * here: detection runs once on the untouched crop and the box is reused,
 * so a size result can never be confounded with a detector result.
 * Finding 38 already priced detection separately (0.4% missed at 48px).
 */
export function degrade(d, w, h, n) {
  if (!n || n >= Math.min(w, h)) return d;
  // --- box-filter downscale to n x n
  const small = new Float64Array(n * n * 3);
  const cnt = new Float64Array(n * n);
  for (let y = 0; y < h; y++) {
    const ty = Math.min(n - 1, (y * n / h) | 0);
    for (let x = 0; x < w; x++) {
      const tx = Math.min(n - 1, (x * n / w) | 0);
      const s = (y * w + x) * 3, t = (ty * n + tx) * 3;
      small[t] += d[s]; small[t + 1] += d[s + 1]; small[t + 2] += d[s + 2];
      cnt[ty * n + tx]++;
    }
  }
  for (let p = 0; p < n * n; p++) {
    const c = cnt[p] || 1;
    small[p * 3] /= c; small[p * 3 + 1] /= c; small[p * 3 + 2] /= c;
  }
  // --- bilinear upscale back to w x h, matching cropAndResize
  const out = new Uint8Array(w * h * 3);
  const sx = n > 1 ? (n - 1) / (w - 1 || 1) : 0;
  const sy = n > 1 ? (n - 1) / (h - 1 || 1) : 0;
  for (let y = 0; y < h; y++) {
    const fy = y * sy, y0 = Math.min(n - 1, fy | 0), y1 = Math.min(n - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = x * sx, x0 = Math.min(n - 1, fx | 0), x1 = Math.min(n - 1, x0 + 1), wx = fx - x0;
      const o = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const a = small[(y0 * n + x0) * 3 + c] * (1 - wx) + small[(y0 * n + x1) * 3 + c] * wx;
        const b = small[(y1 * n + x0) * 3 + c] * (1 - wx) + small[(y1 * n + x1) * 3 + c] * wx;
        out[o + c] = Math.max(0, Math.min(255, Math.round(a * (1 - wy) + b * wy)));
      }
    }
  }
  return out;
}
