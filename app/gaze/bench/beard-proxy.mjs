// bench/beard-proxy.mjs
//
// MEASUREMENT ONLY. There are NO beard labels on disk anywhere in this
// repo or the corpus. This bench does NOT compute a beard rate and does
// NOT claim to detect beards. It computes a JAW-DARKNESS PROXY -- the
// ratio of mean luma in a jaw/chin/moustache band to mean luma in a
// mid-face (eyes/cheek/nose-bridge) band -- and checks whether that
// proxy correlates with the shipped faceres model's male-ness score
// (`raw`) among reads from clusters a human labelled 'man'.
//
// THE PROXY IS NOT SPECIFIC TO BEARDS. A dark lower-third of a crop can
// come from: facial hair, but ALSO shadow (chin tucked, downlight,
// under-camera lighting), a dark collar/shirt/scarf entering the jaw
// band, a dark background behind the jaw, low overall exposure, or
// darker skin tone. This bench cannot and does not separate those
// causes. Read every correlation below as "dark lower-third of face vs
// male-ness", not "beard vs male-ness". Section (d) is a partial control
// for one confound (face size in px); it is not a full deconfound and
// does not touch skin tone or lighting.
//
// Run: node app/gaze/bench/beard-proxy.mjs

import fs from 'node:fs';
import path from 'node:path';

const CORPUS = 'Z:/tamescroll-corpus/bank';
const CLUSTERS_PATH = path.join(CORPUS, 'label/clusters.json');
const LABELS_PATH = path.join(CORPUS, 'label/labels.json');
const CROPS_DIR = path.join(CORPUS, 'crops');
const OUT_PATH = path.join(CORPUS, 'beard-proxy.json');

// ---- PPM (P6) loader, generic header parsing ----
function loadPPM(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] !== 0x50 || buf[1] !== 0x36) { // "P6"
    throw new Error(`not a P6 PPM: ${filePath}`);
  }
  let pos = 2;
  const tokens = [];
  while (tokens.length < 3) {
    // skip whitespace
    while (pos < buf.length && /\s/.test(String.fromCharCode(buf[pos]))) pos++;
    // skip comment lines
    if (buf[pos] === 0x23) { // '#'
      while (pos < buf.length && buf[pos] !== 0x0a) pos++;
      continue;
    }
    let start = pos;
    while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]))) pos++;
    tokens.push(buf.toString('ascii', start, pos));
  }
  // exactly one whitespace char follows maxval before pixel data
  pos++;
  const width = parseInt(tokens[0], 10);
  const height = parseInt(tokens[1], 10);
  const maxval = parseInt(tokens[2], 10);
  const expected = width * height * 3;
  const pixels = buf.subarray(pos, pos + expected);
  if (pixels.length !== expected) {
    throw new Error(`truncated pixel data: ${filePath} got ${pixels.length} want ${expected}`);
  }
  return { width, height, maxval, pixels };
}

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Computes jaw-darkness proxy stats for one PPM.
function jawDarknessProxy(ppm) {
  const { width: w, height: h, pixels } = ppm;
  const x0 = Math.floor(0.20 * w);
  const x1 = Math.floor(0.80 * w);
  const midY0 = Math.floor(0.35 * h);
  const midY1 = Math.floor(0.55 * h);
  const jawY0 = Math.floor(0.68 * h);
  const jawY1 = Math.floor(0.92 * h);

  function bandStats(y0, y1) {
    let sum = 0, sumSq = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * w + x) * 3;
        const Y = luma(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
        sum += Y;
        sumSq += Y * Y;
        n++;
      }
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return { mean, std: Math.sqrt(Math.max(0, variance)), n };
  }

  const mid = bandStats(midY0, midY1);
  const jaw = bandStats(jawY0, jawY1);
  return {
    jawRatio: jaw.mean / mid.mean,
    jawStd: jaw.std,
    jawMean: jaw.mean,
    midMean: mid.mean,
  };
}

// ---- stats helpers ----
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? NaN : num / denom;
}
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---- load corpus ----
const clusters = JSON.parse(fs.readFileSync(CLUSTERS_PATH, 'utf8'));
const labels = JSON.parse(fs.readFileSync(LABELS_PATH, 'utf8'));

function collectRows(labelValue) {
  const rows = [];
  let failCount = 0;
  const failReasons = {};
  const clusterIdsSeen = new Set();
  for (const cluster of clusters) {
    if (labels[cluster.id] !== labelValue) continue;
    clusterIdsSeen.add(cluster.id);
    for (const m of cluster.members) {
      const full = path.join(CROPS_DIR, m.crop);
      let ppm;
      try {
        ppm = loadPPM(full);
      } catch (err) {
        failCount++;
        const reason = err.message;
        failReasons[reason] = (failReasons[reason] || 0) + 1;
        continue;
      }
      const proxy = jawDarknessProxy(ppm);
      rows.push({
        clusterId: cluster.id,
        crop: m.crop,
        px: m.px,
        raw: m.raw,
        score: m.score,
        gender: m.gender,
        nm: m.nm,
        jawRatio: proxy.jawRatio,
        jawStd: proxy.jawStd,
        jawMean: proxy.jawMean,
        midMean: proxy.midMean,
      });
    }
  }
  return { rows, failCount, failReasons, nClusters: clusterIdsSeen.size };
}

const manResult = collectRows('man');
const womanResult = collectRows('woman');

fs.writeFileSync(OUT_PATH, JSON.stringify(manResult.rows.concat(womanResult.rows), null, 2));

// ---- (a) load summary ----
console.log('=== (a) load summary ===');
console.log(`man reads: ${manResult.rows.length}  man clusters: ${manResult.nClusters}  failed loads: ${manResult.failCount}`);
if (manResult.failCount > 0) console.log('  fail reasons:', manResult.failReasons);
console.log(`woman reads: ${womanResult.rows.length}  woman clusters: ${womanResult.nClusters}  failed loads: ${womanResult.failCount}`);
if (womanResult.failCount > 0) console.log('  fail reasons:', womanResult.failReasons);
console.log(`wrote ${manResult.rows.length + womanResult.rows.length} rows to ${OUT_PATH}`);

// ---- (b) pooled vs within-identity correlation (man only) ----
console.log('\n=== (b) jawRatio vs raw (male-ness), MAN reads only ===');
console.log('REMINDER: jawRatio is a dark-lower-third proxy, not a beard detector (see file header).');
const manRows = manResult.rows;
const pooledR = pearson(manRows.map(r => r.jawRatio), manRows.map(r => r.raw));
console.log(`pooled r (n=${manRows.length}): ${pooledR.toFixed(4)}`);

const byCluster = new Map();
for (const r of manRows) {
  if (!byCluster.has(r.clusterId)) byCluster.set(r.clusterId, []);
  byCluster.get(r.clusterId).push(r);
}
const clusterRs = [];
for (const [cid, rows] of byCluster) {
  if (rows.length < 3) continue; // need variance to compute r meaningfully
  const r = pearson(rows.map(x => x.jawRatio), rows.map(x => x.raw));
  if (!Number.isNaN(r)) clusterRs.push({ cid, r, n: rows.length });
}
const clusterRVals = clusterRs.map(x => x.r);
console.log(`within-identity mean r across ${clusterRVals.length} clusters (of ${byCluster.size} total, some excluded for n<3 or zero variance): ${mean(clusterRVals).toFixed(4)}`);
console.log(`  spread: std=${stddev(clusterRVals).toFixed(4)}  min=${Math.min(...clusterRVals).toFixed(4)}  max=${Math.max(...clusterRVals).toFixed(4)}  median=${median(clusterRVals).toFixed(4)}`);

// ---- (c) quartile table, man reads ----
function quartileTable(rows, label) {
  console.log(`\n=== quartile table (jawRatio, Q1=darkest jaw), ${label} ===`);
  const sorted = [...rows].sort((a, b) => a.jawRatio - b.jawRatio);
  const n = sorted.length;
  const qSize = Math.floor(n / 4);
  console.log('quartile | n    | med jawRatio | med raw | med score | frac score<0.40 | med px');
  for (let q = 0; q < 4; q++) {
    const start = q * qSize;
    const end = q === 3 ? n : start + qSize;
    const slice = sorted.slice(start, end);
    const fracBelow40 = slice.filter(r => r.score < 0.40).length / slice.length;
    console.log(
      `Q${q + 1}      | ${slice.length.toString().padEnd(4)} | ${median(slice.map(r => r.jawRatio)).toFixed(4)}       | ${median(slice.map(r => r.raw)).toFixed(4)}  | ${median(slice.map(r => r.score)).toFixed(4)}    | ${fracBelow40.toFixed(4)}          | ${median(slice.map(r => r.px)).toFixed(1)}`
    );
  }
}
quartileTable(manRows, 'MAN reads');

// ---- (d) confound check: face size ----
console.log('\n=== (d) confound check: px (face size) ===');
console.log('median px per jawRatio quartile (man reads), same quartiles as above:');
{
  const sorted = [...manRows].sort((a, b) => a.jawRatio - b.jawRatio);
  const n = sorted.length;
  const qSize = Math.floor(n / 4);
  for (let q = 0; q < 4; q++) {
    const start = q * qSize;
    const end = q === 3 ? n : start + qSize;
    const slice = sorted.slice(start, end);
    console.log(`  Q${q + 1}: median px = ${median(slice.map(r => r.px)).toFixed(1)}`);
  }
}
console.log('\njawRatio vs raw correlation WITHIN px bands (man reads):');
const pxBands = [
  { label: 'px<48', test: (px) => px < 48 },
  { label: '48<=px<80', test: (px) => px >= 48 && px < 80 },
  { label: '80<=px<140', test: (px) => px >= 80 && px < 140 },
  { label: 'px>=140', test: (px) => px >= 140 },
];
for (const band of pxBands) {
  const slice = manRows.filter(r => band.test(r.px));
  if (slice.length < 3) {
    console.log(`  ${band.label}: n=${slice.length} (too few to correlate)`);
    continue;
  }
  const r = pearson(slice.map(x => x.jawRatio), slice.map(x => x.raw));
  console.log(`  ${band.label}: n=${slice.length}  r=${r.toFixed(4)}`);
}

// ---- (e) control: woman reads ----
quartileTable(womanResult.rows, 'WOMAN reads (control)');
{
  const womanR = pearson(womanResult.rows.map(r => r.jawRatio), womanResult.rows.map(r => r.raw));
  console.log(`\npooled jawRatio-vs-raw r, WOMAN reads (control), n=${womanResult.rows.length}: ${womanR.toFixed(4)}`);
  console.log('(compare against the MAN pooled r above -- if similar magnitude, the effect is not specific to man-labelled clusters)');
}

console.log('\n=== REMINDER ===');
console.log('No beard rate was computed. No beard labels exist on disk. jawRatio is confounded');
console.log('with lighting, background, collar/clothing, and skin tone in addition to facial hair.');
