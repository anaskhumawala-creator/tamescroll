// FIDELITY: the corpus banks 2 reads/second and the replay treats EVERY frame
// as a full verdict pass. His measured device cadence is ~1.45s per verdict
// (CLAUDE.md loop 35, 1073) -> ~0.7 Hz. So the replay gives A5's pooling
// 2-3x more votes than his phone would. Does A5 still win at his rate?
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';
const g='man';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cl=new Map();for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8')))if(L[c.id])for(const m of c.members)cl.set(m.crop,L[c.id]);
const base=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
// mark every k-th frame as a READ frame, the rest position-only
function thin(win,k){const w={...win,frames:win.frames.map((fr,i)=>({...fr,
  faces:fr.faces.map(f=>(i%k===0)?f:{...f,_noRead:true})}))}; return w;}
const A5=armSubject({nmWeight:true,poolBar:0.40});
console.log('read every k-th 0.5s frame      arm  EXPOSURE  FALSECOVER  PHANTOM');
for(const k of [1,2,3,4]){
 for(const [n,a] of [['A0',ARM_A0],['A5',A5]]){
  const x={exposureS:0,falseCoverS:0,phantomS:0};
  for(const w of base){const s=score(a(thin(w,k),g),g,c=>cl.get(c));for(const kk in x)x[kk]+=s[kk];}
  console.log(`k=${k} (${(0.5*k).toFixed(1)}s/verdict)`.padEnd(32)+n.padEnd(5)+x.exposureS.toFixed(1).padStart(8)+x.falseCoverS.toFixed(1).padStart(12)+x.phantomS.toFixed(1).padStart(10));
 }}
