import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, ARM_A0 } from './arch-arms.mjs';
import { faceMeta, personFromFace, dedupeObservations, updatePersonTracks, setVerdictCadence } from './.cache/shipped.mjs';
import { W, H } from './corpus-lib.mjs';
const ASPECT=W/H,D=1024;
const logit=v=>Math.log(Math.max(1e-6,v)/Math.max(1e-6,1-v)),sigm=z=>1/(1+Math.exp(-z));
const readOf=f=>({gender:f.gender,score:f.score,raw:f.raw,age:f.age,childP:f.childP,shape:f.shape,desc:null});
const descOf=(w,i)=>{if(i==null||i<0)return null;const o=i*D;return o+D<=w.desc.length?w.desc.subarray(o,o+D):null;};
const cos=(a,b)=>{let s=0;for(let i=0;i<D;i++)s+=a[i]*b[i];return s;};
function arm({SIM=0.60,NM=5,MINV=3,BAR=0.40,CLEAR=0.60}){return function(win,g){
 let tracks=[];const out=[],dt=1000/win.fps;setVerdictCadence(dt);const subs=[];
 const match=d=>{if(!d)return null;let best=null,bs=SIM;for(const s of subs){const c=cos(d,s.proto);if(c>bs){bs=c;best=s;}}
  if(best){for(let i=0;i<D;i++)best.proto[i]=best.proto[i]*0.9+d[i]*0.1;return best;}
  const s={proto:Float32Array.from(d),votes:0,sumLogit:0,decided:null};subs.push(s);return s;};
 for(const fr of win.frames){
  const base=faceMeta(g,fr.faces.map(readOf));
  const meta=fr.faces.map((f,i)=>{const b=base[i]||{};const s=match(descOf(win,f.descIdx));if(!s)return b;
   if(f.nm>=NM){s.sumLogit+=logit(g==='man'?1-f.raw:f.raw);s.votes++;}
   if(s.votes>=MINV){const p=sigm(s.sumLogit/s.votes);const c2=2*Math.abs(p-0.5);
    if(c2>=Math.max(BAR,CLEAR/Math.sqrt(s.votes)))s.decided=p>0.5?'cover':'clear';}
   if(s.decided==='clear')return{...b,flagged:false,certain:true,abstained:false};
   return{...b,flagged:true,certain:true,abstained:false,instant:true};});
  let obs=fr.faces.map((f,i)=>({box:personFromFace(f,ASPECT),...(meta[i]||{}),
    nullMint:!!(meta[i]&&meta[i].nullRead),faceFound:true,verdictDt:dt,desc:descOf(win,f.descIdx)}));
  obs=dedupeObservations(obs);tracks=updatePersonTracks(tracks,obs,dt,null);
  out.push({t:fr.t,faces:fr.faces,patches:tracks.filter(t=>t.state!=='cleared').map(t=>({...t.box}))});}
 return out;};}
const g='man';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cl=new Map();for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8')))if(L[c.id])for(const m of c.members)cl.set(m.crop,L[c.id]);
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
const run=a=>{const x={exposureS:0,falseCoverS:0,phantomS:0};for(const w of wins){const s=score(a(w,g),g,c=>cl.get(c));for(const k in x)x[k]+=s[k];}return x;};
const p=(n,x)=>console.log(n.padEnd(30)+('exp '+x.exposureS.toFixed(1)).padStart(9)+('  fc '+x.falseCoverS.toFixed(1)).padStart(11)+('  ph '+x.phantomS.toFixed(1)).padStart(11));
p('A0 shipped',run(ARM_A0));
console.log('--- SIM (identity merge threshold) ---');
for(const s of [0.40,0.50,0.55,0.60,0.65,0.70,0.80,0.90]) p('  SIM='+s,run(arm({SIM:s})));
console.log('--- MIN_VOTES ---');
for(const v of [1,2,3,4,6,10]) p('  MIN_VOTES='+v,run(arm({MINV:v})));
console.log('--- NM_FLOOR (the pooling weight) ---');
for(const n of [0,3,5,8,12,1e9]) p('  NM_FLOOR='+n,run(arm({NM:n})));
