// The constructed case: a `mixed` cluster is one where identity clustering
// MERGED TWO THINGS. RcGyVTAoXEU#6's contact sheet shows a woman AND pure
// blue-background crops with no face. Patches over the graphic half are real
// PHANTOM and are now claimed away. Split the mixed-only claims by whether the
// claiming read carries descriptor signal (nm >= NULL_MINT_NM_FLOOR 5).
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const C=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'));
const cl=new Map(),cid=new Map();
for(const c of C){ if(L[c.id]) for(const m of c.members){cl.set(m.crop,L[c.id]);cid.set(m.crop,c.id);} }
const COVER=0.15;
function ov(f,b){const x1=Math.max(f.x1,b.x1),y1=Math.max(f.y1,b.y1),x2=Math.min(f.x2,b.x2),y2=Math.min(f.y2,b.y2);
 if(x2<=x1||y2<=y1)return 0;const a=(f.x2-f.x1)*(f.y2-f.y1);return a>0?((x2-x1)*(y2-y1))/a:0;}
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
for(const [n,arm] of [['A0',ARM_A0],['A5',armSubject({poolBar:0.40})]]){
 const byCluster={}; let lowNm=0, hiNm=0;
 for(const w of wins){const frames=arm(w,'man'); const dtS=0.5;
  for(const fr of frames){
   const labClaimed=new Set(); const unl=new Map();
   for(const f of fr.faces){const lab=cl.get(f.crop);
    if(!lab||lab==='mixed'){fr.patches.forEach((p,i)=>{if(ov(f,p)>=COVER&&!unl.has(i))unl.set(i,f);});}
    else{let b=-1,bf=0;fr.patches.forEach((p,i)=>{const o=ov(f,p);if(o>bf){bf=o;b=i;}});if(bf>=COVER&&b>=0)labClaimed.add(b);}}
   for(const [i,f] of unl){ if(labClaimed.has(i)) continue;
    const k=cid.get(f.crop)||'UNLABELLED'; byCluster[k]=(byCluster[k]||0)+dtS;
    if((f.nm||0)<5) lowNm+=dtS; else hiNm+=dtS; }
  }}
 const tot=Object.values(byCluster).reduce((a,b)=>a+b,0);
 console.log(`${n}: ${tot.toFixed(1)}s of patch-time is claimed ONLY by a mixed/unlabelled face (was PHANTOM before the fix)`);
 console.log(`    of that, the claiming read carries NO descriptor signal (nm<5): ${lowNm.toFixed(1)}s   with signal: ${hiNm.toFixed(1)}s`);
 for(const k of Object.keys(byCluster).sort((a,b)=>byCluster[b]-byCluster[a]).slice(0,6))
   console.log(`      ${k.padEnd(18)} ${byCluster[k].toFixed(1)}s   label=${L[k]||'(none)'}`);
}
