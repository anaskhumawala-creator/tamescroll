// bench/beard-sheets.mjs
//
// Picks a stratified sample of ~120 MAN-labelled reads (spread across the
// jawRatio proxy range AND across identities/clusters, deduplicated so
// near-identical consecutive video frames don't dominate) and writes a
// manifest for a python renderer to turn into contact sheets for human
// beard labelling. This script does NOT itself render images.
//
// Run: node app/gaze/bench/beard-sheets.mjs

import fs from 'node:fs';
import path from 'node:path';

const CORPUS = 'Z:/tamescroll-corpus/bank';
const CLUSTERS_PATH = path.join(CORPUS, 'label/clusters.json');
const LABELS_PATH = path.join(CORPUS, 'label/labels.json');
const CROPS_DIR = path.join(CORPUS, 'crops');
const SCRATCH = 'C:/Users/zvcla/AppData/Local/Temp/claude/Z--Apps-Disconnect/a8f2ffec-1fc6-47f7-bbce-c3e90be61c75/scratchpad';
const MANIFEST_PATH = path.join(SCRATCH, 'beard-sheet-manifest.json');
const SIDECAR_PATH = path.join(CORPUS, '..', 'bank', 'beard-sheet-index.json'); // placeholder, fixed below
const SIDECAR_OUT = 'Z:/tamescroll-corpus/bank/beard-sheet-index.json';

const PER_CLUSTER_MAX = 4;
const TARGET_TOTAL = 120;

// ---- minimal PPM loader + jaw-darkness proxy (duplicated from beard-proxy.mjs
// to avoid importing a script whose top level has side effects) ----
function loadPPM(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] !== 0x50 || buf[1] !== 0x36) throw new Error(`not a P6 PPM: ${filePath}`);
  let pos = 2;
  const tokens = [];
  while (tokens.length < 3) {
    while (pos < buf.length && /\s/.test(String.fromCharCode(buf[pos]))) pos++;
    if (buf[pos] === 0x23) { while (pos < buf.length && buf[pos] !== 0x0a) pos++; continue; }
    const start = pos;
    while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]))) pos++;
    tokens.push(buf.toString('ascii', start, pos));
  }
  pos++;
  const width = parseInt(tokens[0], 10);
  const height = parseInt(tokens[1], 10);
  const expected = width * height * 3;
  const pixels = buf.subarray(pos, pos + expected);
  if (pixels.length !== expected) throw new Error(`truncated pixel data: ${filePath}`);
  return { width, height, pixels };
}
function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }
function jawRatioOf(ppm) {
  const { width: w, height: h, pixels } = ppm;
  const x0 = Math.floor(0.20 * w), x1 = Math.floor(0.80 * w);
  const midY0 = Math.floor(0.35 * h), midY1 = Math.floor(0.55 * h);
  const jawY0 = Math.floor(0.68 * h), jawY1 = Math.floor(0.92 * h);
  function bandMean(y0, y1) {
    let sum = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const idx = (y * w + x) * 3;
      sum += luma(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
      n++;
    }
    return sum / n;
  }
  return bandMean(jawY0, jawY1) / bandMean(midY0, midY1);
}

// ---- load corpus, restrict to man clusters ----
const clusters = JSON.parse(fs.readFileSync(CLUSTERS_PATH, 'utf8'));
const labels = JSON.parse(fs.readFileSync(LABELS_PATH, 'utf8'));
const manClusters = clusters.filter((c) => labels[c.id] === 'man');

// ---- per cluster: dedup consecutive same-tag frames within 2s of `t`, compute jawRatio ----
const perClusterCandidates = [];
for (const cluster of manClusters) {
  // group members by tag, sort by t, keep first-of-window per tag
  const byTag = new Map();
  for (const m of cluster.members) {
    if (!byTag.has(m.tag)) byTag.set(m.tag, []);
    byTag.get(m.tag).push(m);
  }
  const deduped = [];
  for (const [, members] of byTag) {
    members.sort((a, b) => a.t - b.t);
    let lastKeptT = -Infinity;
    for (const m of members) {
      if (m.t - lastKeptT >= 2) {
        deduped.push(m);
        lastKeptT = m.t;
      }
    }
  }
  // compute jawRatio for each deduped read
  const withProxy = [];
  for (const m of deduped) {
    const full = path.join(CROPS_DIR, m.crop);
    let ppm;
    try { ppm = loadPPM(full); } catch { continue; }
    withProxy.push({ clusterId: cluster.id, crop: m.crop, tag: m.tag, t: m.t, px: m.px, raw: m.raw, jawRatio: jawRatioOf(ppm) });
  }
  perClusterCandidates.push({ clusterId: cluster.id, reads: withProxy });
}

// ---- pick up to PER_CLUSTER_MAX reads per cluster, spread across that cluster's jawRatio range ----
function pickSpread(reads, k) {
  if (reads.length <= k) return reads;
  const sorted = [...reads].sort((a, b) => a.jawRatio - b.jawRatio);
  const picks = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.round((i * (sorted.length - 1)) / (k - 1));
    picks.push(sorted[idx]);
  }
  // dedup index collisions (can happen if sorted.length is small)
  const seen = new Set();
  return picks.filter((p) => {
    if (seen.has(p.crop)) return false;
    seen.add(p.crop);
    return true;
  });
}

let selected = [];
for (const { reads } of perClusterCandidates) {
  selected.push(...pickSpread(reads, PER_CLUSTER_MAX));
}

// If we overshot/undershot TARGET_TOTAL noticeably, just report it -- do not
// silently pad with unrelated reads or truncate mid-cluster.
console.log(`clusters considered: ${perClusterCandidates.length}`);
console.log(`total deduped candidate reads across all clusters: ${perClusterCandidates.reduce((s, c) => s + c.reads.length, 0)}`);
console.log(`selected: ${selected.length} (target ~${TARGET_TOTAL}, ${PER_CLUSTER_MAX}/cluster x ${perClusterCandidates.length} clusters)`);

// ---- final ordering: sort by jawRatio ascending so the sheets read as a
// visual progression from darkest-jaw to lightest-jaw; row-major index i
// lands at sheet floor(i/30), cell i%30 ----
selected.sort((a, b) => a.jawRatio - b.jawRatio);

const indexMapping = selected.map((r, i) => ({
  index: i,
  sheet: Math.floor(i / 30),
  cell: i % 30,
  clusterId: r.clusterId,
  crop: r.crop,
  cropAbsPath: path.join(CROPS_DIR, r.crop).replace(/\\/g, '/'),
  tag: r.tag,
  t: r.t,
  px: r.px,
  raw: r.raw,
  jawRatio: r.jawRatio,
}));

fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(indexMapping, null, 2));
fs.writeFileSync(SIDECAR_OUT, JSON.stringify(indexMapping, null, 2));

console.log(`manifest written: ${MANIFEST_PATH}`);
console.log(`sidecar (index -> crop mapping) written: ${SIDECAR_OUT}`);
console.log(`sheets needed: ${Math.ceil(indexMapping.length / 30)}`);
console.log('NOTE: ordering is by jawRatio ascending (darkest jaw first), NOT by cluster.');
console.log('NOTE: jawRatio is a dark-lower-third proxy, not a beard label -- see beard-proxy.mjs header.');
