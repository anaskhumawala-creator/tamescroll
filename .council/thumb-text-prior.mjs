import fs from 'fs';

const bank = JSON.parse(fs.readFileSync('Z:/tamescroll-corpus/bank/gpu-thumbs-detect.json', 'utf8'));

// gather all faces across all thumbnails, tagged with q
let allFaces = [];
for (const row of bank) {
  const q = row.q;
  for (const f of (row.faces || [])) {
    allFaces.push({ q, g: f.g, s: f.s, raw: f.raw, nm: f.nm, px: f.px });
  }
}

console.log('total thumbnails:', bank.length);
console.log('total faces:', allFaces.length);

// gender label counts overall
const genderCounts = {};
for (const f of allFaces) genderCounts[f.g] = (genderCounts[f.g] || 0) + 1;
console.log('overall gender counts:', genderCounts);

const total = allFaces.length;
const maleTotal = allFaces.filter(f => f.g === 'male').length;
const femaleTotal = allFaces.filter(f => f.g === 'female').length;
const pooledMaleRate = maleTotal / (maleTotal + femaleTotal);
console.log('pooled male rate (of male+female):', pooledMaleRate.toFixed(4), `(${maleTotal}/${maleTotal+femaleTotal})`);

// group by q
const byQ = {};
for (const f of allFaces) {
  if (!byQ[f.q]) byQ[f.q] = [];
  byQ[f.q].push(f);
}

console.log('\n--- per-query breakdown ---');
const rows = [];
for (const [q, faces] of Object.entries(byQ)) {
  const n = faces.length;
  const counts = {};
  for (const f of faces) counts[f.g] = (counts[f.g] || 0) + 1;
  const male = counts['male'] || 0;
  const female = counts['female'] || 0;
  const other = n - male - female;
  const mf = male + female;
  const maleRate = mf > 0 ? male / mf : null;
  rows.push({ q, n, male, female, other, maleRate });
}
rows.sort((a,b) => (b.maleRate ?? -1) - (a.maleRate ?? -1));
for (const r of rows) {
  const dev = r.maleRate !== null ? (r.maleRate - pooledMaleRate).toFixed(3) : 'n/a';
  console.log(`${r.q.padEnd(32)} n=${String(r.n).padEnd(4)} male=${String(r.male).padEnd(3)} female=${String(r.female).padEnd(3)} other=${String(r.other).padEnd(3)} maleRate=${r.maleRate !== null ? r.maleRate.toFixed(3) : 'n/a'} dev=${dev}`);
}

// mutual information between query and gender (male/female only, drop 'other'/none)
function log2(x) { return Math.log(x) / Math.log(2); }

const mfFaces = allFaces.filter(f => f.g === 'male' || f.g === 'female');
const Nmf = mfFaces.length;
const byQmf = {};
for (const f of mfFaces) {
  if (!byQmf[f.q]) byQmf[f.q] = { male: 0, female: 0 };
  byQmf[f.q][f.g]++;
}
let H_Y = 0;
const pMale = maleTotal / Nmf, pFemale = femaleTotal / Nmf;
for (const p of [pMale, pFemale]) if (p > 0) H_Y -= p * log2(p);

let H_Y_given_X = 0;
for (const [q, c] of Object.entries(byQmf)) {
  const n = c.male + c.female;
  const pX = n / Nmf;
  const pM = c.male / n, pF = c.female / n;
  let h = 0;
  for (const p of [pM, pF]) if (p > 0) h -= p * log2(p);
  H_Y_given_X += pX * h;
}
const MI = H_Y - H_Y_given_X;
console.log('\nH(gender) =', H_Y.toFixed(4), 'bits');
console.log('H(gender|query) =', H_Y_given_X.toFixed(4), 'bits');
console.log('Mutual information I(gender;query) =', MI.toFixed(4), 'bits  (', (MI/H_Y*100).toFixed(1), '% of entropy explained)');

// also compute per-thumbnail (not per-face) composition, since decision is presumably about thumbnail-level exposure
console.log('\n--- thumbnails with >=1 face, by query ---');
const thumbByQ = {};
for (const row of bank) {
  if (!row.faces || row.faces.length === 0) continue;
  if (!thumbByQ[row.q]) thumbByQ[row.q] = [];
  thumbByQ[row.q].push(row);
}
for (const [q, thumbs] of Object.entries(thumbByQ)) {
  console.log(q, 'thumbnails with faces:', thumbs.length);
}
