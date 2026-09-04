// DOES GREY BREAK THE IDENTITY MEMORY? -- finding 44's precondition on
// shipping grey, and the only thing standing between four independent
// confirmations and an actual release.
//
// faceres is multi-head. The SAME forward pass that produces the gender
// sigmoid produces the [1024] descriptor the identity memory matches on at
// `MEM_SIM` 0.6 -- and that module's own notes already record 0.6 as near
// its edge. Grey changes the input to that pass, so it changes the
// descriptor too. Nobody has ever checked what it does to the matching.
//
// TWO FAILURE DIRECTIONS AND THEY ARE NOT SYMMETRIC:
//
//   SAME person falls BELOW 0.6   -> memory miss. The subject is treated
//                                    as new and must earn a clear again.
//                                    Costs false cover. Annoying, safe.
//   DIFFERENT people land ABOVE 0.6 -> FALSE IDENTITY MATCH, and this one
//                                    is an EXPOSURE: a remembered CLEAR can
//                                    be inherited by the wrong face, so a
//                                    woman can be cleared by a man's
//                                    memory. This is the number that gates
//                                    the ship.
//
// Reads the two banked descriptor sets straight off disk -- no inference,
// no device, seconds. `cid` is the corpus cluster, which is this repo's
// identity proxy (107 hand-labelled clusters over ~52 identities).
//
// *** THE ABSOLUTE FALSE-MATCH LEVEL IS UNINTERPRETABLE ON THIS DATA, AND
// ONLY THE rgb-vs-grey DELTA SURVIVES. Read this before quoting a number.
//
// `cid` is a GENDER cluster, not an identity. Checked per video:
//
//     1L_R0MB2W5A   2 clusters, BOTH man, 206 reads   -> 20.1% "false match"
//     H14bBuluwB8   4 clusters, ALL woman, 211 reads  -> 10.7%
//     KAWvDsghyc8  14 clusters, mixed,     294 reads  ->  0.15%
//
// The videos with a "high false-match rate" are exactly the ones with a
// handful of same-gender clusters -- the signature of ONE person split
// across several clusters by pose or lighting. For those, a cross-cluster
// pair is the SAME PERSON and a high similarity is the descriptor working
// correctly. The 14-cluster video, which genuinely holds many people, reads
// 0.15%. So the pooled 6.5% is contamination, not a leak, and it must not
// be reported as an identity-memory exposure.
//
// WHAT SURVIVES: the contamination is IDENTICAL for both arms, because both
// are scored against the same cluster assignment. So the DELTA between rgb
// and grey is still a fair comparison even though neither LEVEL is. That is
// the only claim this bench may make, and it is the only one the grey gate
// needs.
//
// TO MEASURE THE LEVEL PROPERLY you need identity labels, which this corpus
// does not have. Do not build on the absolute number.
//
// THE CONFOUND, STATED UP FRONT AND IT RUNS IN GREY'S DISFAVOUR: the
// clusters were BUILT by similarity on the RGB descriptors, so "same
// cluster" is partly circular for the rgb arm and not at all for grey.
// That biases the comparison TOWARD rgb. So an rgb win is uninformative,
// and grey holding up anyway is strong evidence. Do not read the rgb
// column as a measurement of rgb.
//
//   node app/gaze/bench/grey-identity.mjs
//   node app/gaze/bench/grey-identity.mjs --mem=0.6
import fs from 'fs';

const NL = String.fromCharCode(10);
const BANK = 'Z:/tamescroll-corpus/bank/';
const arg = (k, d) => {
  const h = process.argv.find(a => a.startsWith('--' + k + '='));
  return h ? h.slice(k.length + 3) : d;
};
const MEM_SIM = Number(arg('mem', '0.6'));
const SRC = BANK + arg('src', 'gpu-corpus-desc') + '.json';

const rows = JSON.parse(fs.readFileSync(SRC, 'utf8')).filter(r =>
  r.cid && Array.isArray(r.rgbDesc) && Array.isArray(r.greyDesc));

// The descriptors are banked L2-normalised, so cosine is a dot product.
// VERIFIED rather than assumed -- a non-unit vector would silently rescale
// every similarity below and the whole table would be wrong.
function norm(v) { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; return Math.sqrt(s); }
const nchk = rows.slice(0, 200).map(r => norm(r.rgbDesc));
const nmin = Math.min(...nchk), nmax = Math.max(...nchk);
console.log(NL + 'GREY vs THE IDENTITY MEMORY   MEM_SIM ' + MEM_SIM);
console.log('  rows ' + rows.length + '   clusters ' + new Set(rows.map(r => r.cid)).size
  + '   videos ' + new Set(rows.map(r => r.vid)).size);
console.log('  L2 norm check over 200 rows: ' + nmin.toFixed(4) + '..' + nmax.toFixed(4)
  + (nmin > 0.99 && nmax < 1.01 ? '  (unit -- cosine is a dot product)' : '  *** NOT UNIT: cosine below is WRONG ***'));

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN);

// Cap the pair count deterministically -- 2,159 rows is 2.3M pairs, which
// is affordable, but a stride keeps it honest if the bank grows.
const STRIDE = Number(arg('stride', '1'));
const use = rows.filter((_, i) => i % STRIDE === 0);

for (const kind of ['rgbDesc', 'greyDesc']) {
  const same = [], diff = [];
  // SAME-VIDEO pairs only for the different-person set. Across videos the
  // faces are different people AND different footage, so a cross-video
  // pair is easy and would flatter the number; the memory's real job is
  // telling two people in the SAME shot apart.
  for (let i = 0; i < use.length; i++) {
    for (let j = i + 1; j < use.length; j++) {
      if (use[i].vid !== use[j].vid) continue;
      const s = dot(use[i][kind], use[j][kind]);
      (use[i].cid === use[j].cid ? same : diff).push(s);
    }
  }
  same.sort((a, b) => a - b);
  diff.sort((a, b) => a - b);
  const miss = same.filter(s => s < MEM_SIM).length;
  const falseMatch = diff.filter(s => s >= MEM_SIM).length;
  // AUC: P(a same-person pair scores above a different-person pair).
  let lo = 0, acc = 0;
  for (const s of same) { while (lo < diff.length && diff[lo] < s) lo++; acc += lo; }
  const auc = acc / (same.length * diff.length);

  console.log(NL + '  ' + (kind === 'rgbDesc' ? 'RGB (ships)' : 'GREY'));
  console.log('    same-person pairs ' + same.length
    + '   cos p05/p50/p95 ' + q(same, 0.05).toFixed(3) + ' / ' + q(same, 0.5).toFixed(3) + ' / ' + q(same, 0.95).toFixed(3));
  console.log('    diff-person pairs ' + diff.length + ' (same video only)'
    + '   cos p05/p50/p95 ' + q(diff, 0.05).toFixed(3) + ' / ' + q(diff, 0.5).toFixed(3) + ' / ' + q(diff, 0.95).toFixed(3));
  console.log('    MEMORY MISS   same-person below ' + MEM_SIM + ':  '
    + (100 * miss / same.length).toFixed(2) + '%   (costs false cover -- safe)');
  console.log('    FALSE MATCH   diff-person at/above ' + MEM_SIM + ':  '
    + (100 * falseMatch / diff.length).toFixed(2) + '%   *** THIS IS THE EXPOSURE ***');
  console.log('    separability AUC ' + auc.toFixed(4));
}

// PER VIDEO, because the pooled table above is 93,968 pairs drawn from
// 2,159 rows and those pairs are NOT independent -- a binomial interval on
// them would be roughly ten times too tight and would dress a one-video
// artifact as a result. Ten videos is the real unit. If grey is worse in
// nine of ten that is an effect; five of ten is noise, and a single video
// carrying the whole difference is the shape phase-g G2 and finding 21a
// were both caught by.
{
  const vids = [...new Set(use.map(r => r.vid))].sort();
  console.log(NL + '  PER VIDEO -- false match at ' + MEM_SIM + ' (the exposure direction)');
  console.log('    ' + 'video'.padEnd(14) + 'pairs'.padStart(9) + 'rgb'.padStart(9) + 'grey'.padStart(9) + 'delta'.padStart(9));
  let greyWorse = 0, n = 0;
  for (const v of vids) {
    const rs = use.filter(r => r.vid === v);
    const out = {};
    for (const kind of ['rgbDesc', 'greyDesc']) {
      let hit = 0, tot = 0;
      for (let i = 0; i < rs.length; i++) {
        for (let j = i + 1; j < rs.length; j++) {
          if (rs[i].cid === rs[j].cid) continue;
          tot++;
          if (dot(rs[i][kind], rs[j][kind]) >= MEM_SIM) hit++;
        }
      }
      out[kind] = tot ? hit / tot : null;
      out.tot = tot;
    }
    if (out.tot === 0 || out.rgbDesc === null) continue;
    n++;
    const d = out.greyDesc - out.rgbDesc;
    if (d > 0) greyWorse++;
    console.log('    ' + v.padEnd(14) + String(out.tot).padStart(9)
      + (100 * out.rgbDesc).toFixed(2).padStart(8) + '%'
      + (100 * out.greyDesc).toFixed(2).padStart(8) + '%'
      + ((d >= 0 ? '+' : '') + (100 * d).toFixed(2)).padStart(9));
  }
  console.log('    grey worse in ' + greyWorse + ' of ' + n + ' videos'
    + (greyWorse * 2 > n ? '  -- consistent direction' : '  -- no consistent direction, read as noise'));
}

console.log(NL + 'GATE FOR SHIPPING GREY (finding 44):');
console.log('  READ THE DELTA COLUMN, NEVER THE LEVEL -- cid is a gender cluster,');
console.log('  not an identity, so cross-cluster pairs inside a same-gender video');
console.log('  are largely the SAME PERSON and the absolute rate is contamination.');
console.log('  Both arms carry it identically, so the comparison is fair.');
console.log('  Grey may ship if its FALSE MATCH rate at MEM_SIM is not worse than');
console.log('  rgb\'s. A higher memory-miss rate is acceptable -- it fails toward');
console.log('  covering. A higher false-match rate is not: a remembered clear');
console.log('  inherited by the wrong face uncovers somebody.');
console.log('  Remember the confound: clusters were built on rgb similarity, so');
console.log('  this comparison is biased in rgb\'s favour. Grey merely tying is a');
console.log('  pass.' + NL);
