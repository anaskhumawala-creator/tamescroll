// Who owns the patch that covers Linus?
import fs from 'fs';
import { faceMeta, personFromFace, dedupeObservations, updatePersonTracks, setVerdictCadence } from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { loadWin, armSubject } from './arch-arms.mjs';
const ASPECT=W/H,D=1024,COVER=0.15;
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const C=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'));
const cl=new Map(); for(const c of C) if(L[c.id]) for(const m of c.members) cl.set(m.crop,L[c.id]);
const mine=new Set(C.find(c=>c.id==='NWoT1ZVd1Lo#1').members.map(m=>m.crop));
function ov(f,b){const x1=Math.max(f.x1,b.x1),y1=Math.max(f.y1,b.y1),x2=Math.min(f.x2,b.x2),y2=Math.min(f.y2,b.y2);
 if(x2<=x1||y2<=y1)return 0;const a=(f.x2-f.x1)*(f.y2-f.y1);return a>0?((x2-x1)*(y2-y1))/a:0;}
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin).filter(w=>w.vid==='NWoT1ZVd1Lo');
const arm=armSubject({poolBar:0.40});
const owner={};
for(const w of wins){ const frames=arm(w,'man');
 for(const fr of frames){
  for(const f of fr.faces){ if(!mine.has(f.crop)) continue;
   for(const p of fr.patches){ if(ov(f,p)<COVER) continue;
    // who else is inside this patch?
    let who='(nobody else in it)';
    let bo=0;
    for(const o of fr.faces){ if(o===f||mine.has(o.crop)) continue; const q=ov(o,p); if(q>bo){bo=q;who=(cl.get(o.crop)||'UNLABELLED');} }
    if(bo<COVER) who='(patch contains no other labelled face)';
    owner[who]=(owner[who]||0)+1;
   }}}}
console.log('A5: for each Linus-covering patch, the label of the OTHER face inside it:');
for(const k of Object.keys(owner).sort((a,b)=>owner[b]-owner[a])) console.log('  ',k.padEnd(38),owner[k]);
