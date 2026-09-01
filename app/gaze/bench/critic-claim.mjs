// How much phantom is hidden by unlabelled/mixed faces claiming patches?
// Also: a MIXED face claims ALL overlapping patches; a LABELLED face claims
// only its BEST one. Asymmetry check.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';
const g=process.env.GENDER||'man';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cl=new Map();
for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'))) if(L[c.id]) for(const m of c.members) cl.set(m.crop,L[c.id]);
const COVER=0.15;
function ov(f,b){const x1=Math.max(f.x1,b.x1),y1=Math.max(f.y1,b.y1),x2=Math.min(f.x2,b.x2),y2=Math.min(f.y2,b.y2);
 if(x2<=x1||y2<=y1)return 0; const a=(f.x2-f.x1)*(f.y2-f.y1); return a>0?((x2-x1)*(y2-y1))/a:0;}
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
for(const [nm,arm] of [['A0',ARM_A0],['A5',armSubject({nmWeight:true,poolBar:0.40})]]){
 let dt0=0, totPhantom=0, hiddenByUnlab=0, hiddenExclusive=0, unlabClaims=0, labClaims=0, extraByAll=0;
 for(const w of wins){ const frames=arm(w,g); const dtS=frames.length>1?frames[1].t-frames[0].t:0.5; dt0=dtS;
  for(const fr of frames){
   const labClaimed=new Set(), unlabClaimed=new Set();
   let multi=0;
   for(const f of fr.faces){ const lab=cl.get(f.crop);
    if(!lab||lab==='mixed'){ let n=0; fr.patches.forEach((p,i)=>{ if(ov(f,p)>=COVER){unlabClaimed.add(i); n++;} }); if(n>1) multi+=n-1; unlabClaims+=n; }
    else { let best=-1,bf=0; fr.patches.forEach((p,i)=>{const o=ov(f,p); if(o>bf){bf=o;best=i;}}); if(bf>=COVER&&best>=0){labClaimed.add(best); labClaims++;} }
   }
   extraByAll+=multi;
   fr.patches.forEach((p,i)=>{
     const byLab=labClaimed.has(i), byUn=unlabClaimed.has(i);
     if(!byLab&&!byUn) totPhantom+=dtS;
     else if(!byLab&&byUn){ hiddenByUnlab+=dtS; }
   });
  }}
 console.log(`${nm}: phantom reported ${totPhantom.toFixed(1)}s  |  patches claimed ONLY by mixed/unlabelled faces = ${hiddenByUnlab.toFixed(1)}s  (would be phantom under the OLD rule)`);
 console.log(`    mixed-face claims: ${unlabClaims}  labelled-face claims: ${labClaims}  extra patches absorbed by the all-vs-best asymmetry: ${extraByAll}`);
}
