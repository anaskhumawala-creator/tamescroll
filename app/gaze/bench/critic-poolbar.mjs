// (1) Is the sqrt(votes) term DEAD for poolBar=0.40?  (2) Are A4..A7 identical
// because the conf distribution is bimodal, or because the parameter is inert?
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, armSubject } from './arch-arms.mjs';
const g=process.env.GENDER||'man';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cl=new Map();
for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'))) if(L[c.id]) for(const m of c.members) cl.set(m.crop,L[c.id]);
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
console.log('bar = max(poolBar, 0.60/sqrt(votes)); MIN_VOTES=3 so sqrt term <= 0.6/sqrt(3)=0.3464');
for(const v of [3,4,5,10,30]) console.log('  votes',v,'-> sqrt term',(0.6/Math.sqrt(v)).toFixed(4));
console.log('');
console.log('poolBar   EXPOSURE  FALSECOVER  PHANTOM   covered   sharp');
for(const pb of [0.60,0.50,0.45,0.40,0.3464,0.30,0.20,0.10,0.05,0.01,1e-9]){
  const a={exposureS:0,falseCoverS:0,phantomS:0,coveredS:0,sharpOkS:0};
  const arm=armSubject({poolBar:pb});
  for(const w of wins){const s=score(arm(w,g),g,c=>cl.get(c)); for(const k in a)a[k]+=s[k];}
  console.log(String(pb).padEnd(9)+a.exposureS.toFixed(1).padStart(8)+a.falseCoverS.toFixed(1).padStart(12)+a.phantomS.toFixed(1).padStart(9)+a.coveredS.toFixed(1).padStart(10)+a.sharpOkS.toFixed(1).padStart(9));
}
