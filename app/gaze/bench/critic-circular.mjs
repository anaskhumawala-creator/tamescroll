// IS THE IDENTITY GROUPING CIRCULAR WITH THE GENDER DECISION?
// faceres identity head and gender head share a trunk. Two tests:
//  T1 cross-cluster: are same-gender DIFFERENT-PEOPLE pairs more similar than
//     cross-gender pairs? (descriptor encodes gender -> grouping is biased)
//  T2 within-subject: does cos(i,j) predict |logit raw_i - logit raw_j|?
//     If reads that group together also READ alike, the votes are correlated
//     and the 1/sqrt(n) standard-error argument behind the pooled bar is void.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
const D=1024;
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const C=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'));
// load descriptors keyed by crop
const desc=new Map();
for(const f of fs.readdirSync(`${ROOT}/bank/reads`).filter(x=>x.endsWith('.json'))){
  const w=JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${f}`,'utf8'));
  const b=fs.readFileSync(`${ROOT}/bank/reads/${f.replace(/\.json$/,'.desc')}`);
  const d=new Float32Array(b.buffer,b.byteOffset,b.length/4);
  for(const fr of w.frames) for(const face of fr.faces){ if(face.descIdx>=0 && (face.descIdx+1)*D<=d.length)
    desc.set(face.crop,{d:d.subarray(face.descIdx*D,(face.descIdx+1)*D), raw:face.raw, nm:face.nm, px:face.px}); }
}
const cos=(a,b)=>{let s=0;for(let i=0;i<D;i++)s+=a[i]*b[i];return s;};
const logit=v=>Math.log(Math.max(1e-6,v)/Math.max(1e-6,1-v));

// ---- T1 ----
const rep={}; // one representative sample per cluster (up to 12)
for(const c of C){ const lab=L[c.id]; if(lab!=='man'&&lab!=='woman') continue;
  const step=Math.max(1,Math.floor(c.members.length/12)); const arr=[];
  for(let i=0;i<c.members.length&&arr.length<12;i+=step){const e=desc.get(c.members[i].crop); if(e)arr.push(e);}
  if(arr.length) rep[c.id]={lab,arr,vid:c.vid}; }
const ids=Object.keys(rep);
let same=[],diff=[],sameV=[],diffV=[];
for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
  let m=-2; for(const x of rep[ids[a]].arr) for(const y of rep[ids[b]].arr){const s=cos(x.d,y.d); if(s>m)m=s;}
  const sameVid = rep[ids[a]].vid===rep[ids[b]].vid;
  (rep[ids[a]].lab===rep[ids[b]].lab?same:diff).push(m);
  if(sameVid)(rep[ids[a]].lab===rep[ids[b]].lab?sameV:diffV).push(m);
}
const st=a=>{a=a.slice().sort((x,y)=>x-y);return`n=${a.length} p50 ${a[a.length>>1].toFixed(3)} p95 ${a[Math.floor(a.length*0.95)].toFixed(3)} max ${a[a.length-1].toFixed(3)} >=0.60: ${a.filter(v=>v>=0.6).length}`;};
console.log('T1 CROSS-CLUSTER max-cosine between two DIFFERENT labelled people');
console.log('  same gender label :',st(same));
console.log('  diff gender label :',st(diff));
console.log('  (same video only) same:',st(sameV));
console.log('  (same video only) diff:',st(diffV));

// ---- T2 ----
console.log('\nT2 WITHIN-SUBJECT: cos(i,j) vs |logit raw_i - logit raw_j|, per labelled person cluster');
let allC=[],allG=[];
for(const c of C){ const lab=L[c.id]; if(lab!=='man'&&lab!=='woman') continue;
  const arr=c.members.map(m=>desc.get(m.crop)).filter(Boolean); if(arr.length<20)continue;
  const step=Math.max(1,Math.floor(arr.length/40)); const s=[]; for(let i=0;i<arr.length;i+=step)s.push(arr[i]);
  const cs=[],gs=[];
  for(let a=0;a<s.length;a++)for(let b=a+1;b<s.length;b++){cs.push(cos(s[a].d,s[b].d));gs.push(Math.abs(logit(s[a].raw)-logit(s[b].raw)));}
  const mc=cs.reduce((x,y)=>x+y,0)/cs.length, mg=gs.reduce((x,y)=>x+y,0)/gs.length;
  let num=0,d1=0,d2=0; for(let i=0;i<cs.length;i++){num+=(cs[i]-mc)*(gs[i]-mg);d1+=(cs[i]-mc)**2;d2+=(gs[i]-mg)**2;}
  const r=num/Math.sqrt(d1*d2);
  allC=allC.concat(cs); allG=allG.concat(gs);
  console.log(`  ${c.id.padEnd(16)} ${lab.padEnd(6)} n=${String(s.length).padStart(3)} pearson(cos, |dlogit|) = ${r.toFixed(3)}`);
}
{const mc=allC.reduce((x,y)=>x+y,0)/allC.length,mg=allG.reduce((x,y)=>x+y,0)/allG.length;
 let n=0,d1=0,d2=0;for(let i=0;i<allC.length;i++){n+=(allC[i]-mc)*(allG[i]-mg);d1+=(allC[i]-mc)**2;d2+=(allG[i]-mg)**2;}
 console.log(`  POOLED over all subjects: pearson = ${(n/Math.sqrt(d1*d2)).toFixed(3)}  (n pairs ${allC.length})`);}
