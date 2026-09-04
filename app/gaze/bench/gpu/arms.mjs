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
