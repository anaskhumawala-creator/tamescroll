// HIS ACTUAL COMPLAINT, MEASURED FOR THE FIRST TIME.
//
// "the random blur marks are pretty pretty annoying on random places on
// random thumbnails, like randomly just blur some text".
//
// EVERY accuracy number this repo owns answers a different question:
// given that a person is there, did we get their gender right. Nothing
// has ever measured how often a patch lands where NOBODY IS. That is a
// precision question and the corpus can answer it -- 32 clusters are
// labelled `notperson` (135 reads) and 4 are `bodypart` (59 reads), all
// crops BlazeFace found a "face" in and faceres then read a gender on.
//
// A patch is minted when the read is NOT cleared. In his man mode the
// clear rule is: same gender (male) AND adult AND score >= the bar. So a
// notperson crop mints a mark whenever it reads female, reads child, or
// reads male too weakly -- and the interesting part is that reading male
// CONFIDENTLY is what saves us, which is luck, not judgement.
//
// TWO GUARDS ALREADY SHIP AND BOTH ARE PRICED HERE:
//   isNullRead   raw in [0.53, 0.72] AND age in [34, 42] -- the model
//                returning its own prior, i.e. "I saw nothing"
//   nm floor     descriptor magnitude >= 5 -- how much the network
//                actually extracted, measured in loop 38 at p50 11.4 on
//                real faces against 3.9 on noise
// Together they refuse the BIRTH of a patch, never an existing one.
//
// WHAT THIS CANNOT SEE, said before the numbers: these are crops
// BlazeFace ALREADY chose to report. A patch that appears on a stretch of
// text the detector never flagged is not in this corpus at all, so this
// is a LOWER bound on the mark rate. And 194 reads over 36 clusters is a
// small sample -- every cell carries a Wilson interval for that reason.
//
// VIDEO rules and IMAGE rules are both printed, because his marks are on
// THUMBNAILS and the image path uses a different bar (0.40, not 0.45) and
// has only carried a null guard since loop 42.
import fs from 'fs';
import {
  isNullRead, GENDER_CLEAR_SCORE, GENDER_IMAGE_MIN_SCORE,
  GENDER_CHILD_MASS, NULL_MINT_NM_FLOOR,
} from '../src/gender-verdict.mjs';

const BANK = 'Z:/tamescroll-corpus/bank';
const labels = JSON.parse(fs.readFileSync(BANK + '/label/labels.json', 'utf8'));
const clusters = JSON.parse(fs.readFileSync(BANK + '/label/clusters.json', 'utf8'));

// The cluster members carry no age/childP, so join to the full read
// objects by crop path -- the same join every other bench in here uses.
const full = new Map();
for (const f of fs.readdirSync(BANK + '/reads').filter(x => x.endsWith('.json'))) {
  const win = JSON.parse(fs.readFileSync(BANK + '/reads/' + f, 'utf8'));
  for (const fr of win.frames) for (const fa of fr.faces || []) {
    if (fa.crop) full.set(fa.crop, fa);
  }
}

const rows = [];
for (const c of clusters) {
  const who = labels[c.id];
  if (!who) continue;
  for (const m of c.members) {
    const fa = full.get(m.crop);
    if (!fa) continue;
    rows.push({ who, cid: c.id, vid: c.vid, f: fa });
  }
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
// Wilson 95% -- a normal interval on 4/59 would run below zero and read
// as certainty this sample cannot support.
function wilson(k, n) {
  if (!n) return '--';
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return `${(100 * Math.max(0, c - h)).toFixed(0)}-${(100 * Math.min(1, c + h)).toFixed(0)}%`;
}

const adult = f => !(typeof f.childP === 'number' && f.childP >= GENDER_CHILD_MASS)
  && (typeof f.age !== 'number' || f.age >= 18);
// The shipped clear rule, quoted from gender-verdict rather than restated.
const clearedVideo = f => f.gender === 'male' && adult(f) && f.score >= GENDER_CLEAR_SCORE;
const clearedImage = f => f.gender === 'male' && adult(f) && f.score >= GENDER_IMAGE_MIN_SCORE;
const refused = f => isNullRead(f) && adult(f) && (typeof f.nm !== 'number' || f.nm < NULL_MINT_NM_FLOOR);

console.log(`reads joined ${rows.length}   (man mode: a patch is minted whenever the read is not cleared)\n`);
console.log('label'.padEnd(11) + 'n'.padStart(6) + 'MARK video'.padStart(12) + '95%'.padStart(11)
  + 'MARK image'.padStart(12) + 'after guard'.padStart(13));
for (const w of ['notperson', 'bodypart', 'child', 'mixed', 'woman', 'man']) {
  const s = rows.filter(r => r.who === w);
  if (!s.length) continue;
  const mv = s.filter(r => !clearedVideo(r.f)).length;
  const mi = s.filter(r => !clearedImage(r.f)).length;
  const mg = s.filter(r => !clearedVideo(r.f) && !refused(r.f)).length;
  console.log(w.padEnd(11) + String(s.length).padStart(6) + pct(mv, s.length).padStart(12)
    + wilson(mv, s.length).padStart(11) + pct(mi, s.length).padStart(12) + pct(mg, s.length).padStart(13));
}

const junk = rows.filter(r => r.who === 'notperson' || r.who === 'bodypart');
console.log(`\nNON-PEOPLE (notperson + bodypart), n ${junk.length}`);
console.log(`  would mint a mark            ${pct(junk.filter(r => !clearedVideo(r.f)).length, junk.length)}`);
console.log(`  ...refused by the null guard ${pct(junk.filter(r => !clearedVideo(r.f) && refused(r.f)).length, junk.length)}`);
console.log(`  ...STILL minted              ${pct(junk.filter(r => !clearedVideo(r.f) && !refused(r.f)).length, junk.length)}`);
console.log('\nwhy a non-person escapes the guard -- the guard only fires on the model\'s own prior:');
const esc = junk.filter(r => !clearedVideo(r.f) && !refused(r.f));
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
for (const k of ['raw', 'score', 'nm', 'age', 'conf', 'px']) {
  console.log('  ' + k.padEnd(7) + 'p10 ' + q(esc.map(r => r.f[k]), 0.1).toFixed(2)
    + '  p50 ' + q(esc.map(r => r.f[k]), 0.5).toFixed(2)
    + '  p90 ' + q(esc.map(r => r.f[k]), 0.9).toFixed(2));
}
console.log('\n  reading FEMALE ' + pct(esc.filter(r => r.f.gender === 'female').length, esc.length)
  + '   weak male ' + pct(esc.filter(r => r.f.gender === 'male' && r.f.score < GENDER_CLEAR_SCORE).length, esc.length)
  + '   child-flagged ' + pct(esc.filter(r => !adult(r.f)).length, esc.length));

console.log('\nwhat a HARDER nm floor would buy and cost (OTA-tunable, no build):');
console.log('  ' + 'floor'.padStart(6) + 'junk marks'.padStart(12) + 'MAN false cover'.padStart(17) + 'WOMAN exposure'.padStart(16));
const men = rows.filter(r => r.who === 'man'), women = rows.filter(r => r.who === 'woman');
for (const fl of [5, 6, 7, 8, 10]) {
  const ref = f => isNullRead(f) && adult(f) && (typeof f.nm !== 'number' || f.nm < fl);
  const mark = r => !clearedVideo(r.f) && !ref(r.f);
  console.log('  ' + String(fl).padStart(6) + pct(junk.filter(mark).length, junk.length).padStart(12)
    + pct(men.filter(mark).length, men.length).padStart(17)
    + pct(women.filter(r => clearedVideo(r.f) || ref(r.f)).length, women.length).padStart(16));
}
