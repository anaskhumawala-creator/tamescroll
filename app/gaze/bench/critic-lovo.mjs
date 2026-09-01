// Held-out check. 5 videos, 10 windows. Is A5's win over A0 spread across
// videos, or concentrated? And does the best poolBar chosen on 4 videos
// still win on the 5th?
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';
const g=process.env.GENDER||'man';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cl=new Map();
for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'))) if(L[c.id]) for(const m of c.members) cl.set(m.crop,L[c.id]);
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
const vids=[...new Set(wins.map(w=>w.vid))];
const A5=armSubject({nmWeight:true,poolBar:0.40});
console.log('PER-VIDEO  (falseCover / phantom / exposure)');
console.log('video            A0 fc    A5 fc   delta |  A0 ph   A5 ph  delta |  A0 ex  A5 ex');
let wins5=0;
for(const v of vids){
  const ws=wins.filter(w=>w.vid===v);
  const a={fc:0,ph:0,ex:0},b={fc:0,ph:0,ex:0};
  for(const w of ws){ const s0=score(ARM_A0(w,g),g,c=>cl.get(c)); const s5=score(A5(w,g),g,c=>cl.get(c));
    a.fc+=s0.falseCoverS;a.ph+=s0.phantomS;a.ex+=s0.exposureS; b.fc+=s5.falseCoverS;b.ph+=s5.phantomS;b.ex+=s5.exposureS;}
  if(b.fc<a.fc) wins5++;
  console.log(v.padEnd(14)+a.fc.toFixed(1).padStart(8)+b.fc.toFixed(1).padStart(9)+(b.fc-a.fc).toFixed(1).padStart(8)+' |'+a.ph.toFixed(1).padStart(7)+b.ph.toFixed(1).padStart(8)+(b.ph-a.ph).toFixed(1).padStart(7)+' |'+a.ex.toFixed(1).padStart(7)+b.ex.toFixed(1).padStart(7));
}
console.log(`\nA5 beats A0 on falseCover in ${wins5} of ${vids.length} videos`);

// leave-one-video-out: pick poolBar on the other 4, score on the held-out one
console.log('\nLOVO: poolBar tuned on the other 4 videos, scored on the held-out one');
const grid=[0.60,0.50,0.45,0.40,0.30,0.20];
for(const v of vids){
  const train=wins.filter(w=>w.vid!==v), test=wins.filter(w=>w.vid===v);
  let bestPb=null,bestScore=Infinity;
  for(const pb of grid){ const arm=armSubject({nmWeight:true,poolBar:pb}); let fc=0,ex=0,ph=0;
    for(const w of train){const s=score(arm(w,g),g,c=>cl.get(c)); fc+=s.falseCoverS;ex+=s.exposureS;ph+=s.phantomS;}
    const obj=fc+ph+10*ex;   // exposure is severest
    if(obj<bestScore){bestScore=obj;bestPb=pb;} }
  const arm=armSubject({nmWeight:true,poolBar:bestPb});
  let a={fc:0,ph:0,ex:0},b={fc:0,ph:0,ex:0};
  for(const w of test){const s0=score(ARM_A0(w,g),g,c=>cl.get(c));const s5=score(arm(w,g),g,c=>cl.get(c));
    a.fc+=s0.falseCoverS;a.ph+=s0.phantomS;a.ex+=s0.exposureS;b.fc+=s5.falseCoverS;b.ph+=s5.phantomS;b.ex+=s5.exposureS;}
  console.log(`  held out ${v.padEnd(13)} chose poolBar ${bestPb}   A0 fc ${a.fc.toFixed(1)} ph ${a.ph.toFixed(1)} ex ${a.ex.toFixed(1)}  ->  A5 fc ${b.fc.toFixed(1)} ph ${b.ph.toFixed(1)} ex ${b.ex.toFixed(1)}`);
}
