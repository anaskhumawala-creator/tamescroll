// COLLECT REAL THUMBNAILS, INCLUDING ONES WITH NO PERSON IN THEM.
//
// THE GAP THIS FILLS. Finding 48 measured the detector's false-fire rate
// on VIDEO FRAMES, and it came out at 5 in 5,451 detections -- the
// detector is nearly innocent there. But that population is frames from
// videos that CONTAIN PEOPLE, and his complaint is about THUMBNAILS:
// "the random blur marks are pretty pretty annoying on random places on
// random thumbnails, like randomly just blur some text." A gaming or
// tech thumbnail often has no person in it at all, and finding 45's
// image-path numbers are still conditional on detection exactly as
// finding 35's were.
//
// So the population has to be thumbnails, and it has to include the
// person-free kind. The queries below are chosen to span both: some
// where a face is near-certain (vlog, interview, reaction) and some where
// it is unlikely (gameplay, landscape, code, whiteboard, unboxing) --
// because a bench that only collects one kind measures its own query
// list.
//
// NOTHING IS RENDERED AND NOTHING IS PUBLISHED. Public search HTML for
// the ids, public i.ytimg.com for the jpegs, straight to disk on Z:.
// Same method probe_faceres_parity.py has used here since 2026-08-31.
//
//   node app/gaze/bench/gpu/fetch-thumbs.mjs
//   node app/gaze/bench/gpu/fetch-thumbs.mjs --per=40
import fs from 'fs';
import path from 'path';

const OUT = 'Z:/tamescroll-corpus/thumbs';
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith('--' + k + '='));
  return h ? h.slice(k.length + 3) : d;
};
const PER = Number(arg('per', '30'));

// `expect` is a HINT for slicing the table afterwards, never a label --
// a gameplay thumbnail often has a facecam and a landscape video often
// has a presenter. The oracle decides, not this list.
const QUERIES = [
  ['minecraft gameplay', 'none'],
  ['gameplay walkthrough no commentary', 'none'],
  ['4k landscape drone footage', 'none'],
  ['coding tutorial screen recording', 'none'],
  ['whiteboard math lecture', 'none'],
  ['keyboard unboxing asmr', 'none'],
  ['car review exterior walkaround', 'none'],
  ['lofi hip hop radio', 'none'],
  ['tech review unboxing', 'mixed'],
  ['podcast interview', 'face'],
  ['vlog daily', 'face'],
  ['reaction video', 'face'],
  ['makeup tutorial', 'face'],
  ['news anchor broadcast', 'face'],
];

fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

const seen = new Set();
const rows = [];
for (const [q, expect] of QUERIES) {
  const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en' } });
    html = await r.text();
  } catch (e) {
    console.log('  ' + q + ' -- FETCH FAILED ' + e.message);
    continue;
  }
  // The search page embeds ytInitialData HEX-ESCAPED (" for a quote),
  // so a plain JSON regex finds 91 occurrences of the word videoId and
  // zero ids -- which reads exactly like "the fetch was blocked". Match
  // both forms.
  const ids = [...new Set([
    ...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g),
    ...html.matchAll(/videoId\\x22:\\x22([A-Za-z0-9_-]{11})/g),
  ].map((m) => m[1]))];
  let n = 0;
  for (const id of ids) {
    if (seen.has(id) || n >= PER) continue;
    seen.add(id);
    rows.push({ id, q, expect });
    n++;
  }
  console.log('  ' + q.padEnd(38) + ids.length + ' ids, took ' + n);
}
console.log('collected ' + rows.length + ' distinct video ids');

// hqdefault is 480x360 -- close to the 640x360 his player decodes and to
// the sizes the feed actually requests, so a detection here is the shape
// of a detection he gets. maxresdefault would be a different regime.
let ok = 0;
const kept = [];
for (const r of rows) {
  const f = path.join(OUT, r.id + '.jpg');
  if (fs.existsSync(f) && fs.statSync(f).size > 2000) { ok++; kept.push(r); continue; }
  try {
    const resp = await fetch('https://i.ytimg.com/vi/' + r.id + '/hqdefault.jpg');
    if (!resp.ok) continue;
    const b = Buffer.from(await resp.arrayBuffer());
    // YouTube serves a 120x90 grey placeholder for a missing thumbnail;
    // it is ~1-2KB and would enter the bench as a person-free image that
    // nobody ever saw. Refuse it on size.
    if (b.length < 2000) continue;
    fs.writeFileSync(f, b);
    ok++;
    kept.push(r);
  } catch { /* a dead id is not a result */ }
  if (ok % 50 === 0) process.stderr.write('  ' + ok + '/' + rows.length + '\n');
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(kept));
console.log('saved ' + ok + ' thumbnails to ' + OUT);
