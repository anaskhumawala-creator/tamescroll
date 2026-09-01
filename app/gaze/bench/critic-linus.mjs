// CLAIM 3: "A5 does not fix Linus even though his pooled confidence is 0.731
// clear. The tracker re-blurs him at every birth."  Test it, don't argue it.
import fs from 'fs';
import { faceMeta, personFromFace, dedupeObservations, updatePersonTracks, setVerdictCadence, iou } from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
const ASPECT=W/H, D=1024, SIM=0.60, NM=5, CLEAR=0.60, MINV=3;
const logit=v=>Math.log(Math.max(1e-6,v)/Math.max(1e-6,1-v)), sigm=z=>1/(1+Math.exp(-z));
const readOf=f=>({gender:f.gender,score:f.score,raw:f.raw,age:f.age,childP:f.childP,shape:f.shape,desc:null});
const descOf=(w,i)=>{if(i==null||i<0)return null;const o=i*D;return o+D<=w.desc.length?w.desc.subarray(o,o+D):null;};
const cos=(a,b)=>{let s=0;for(let i=0;i<D;i++)s+=a[i]*b[i];return s;};
const C=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'));
const TARGET=process.env.WHO||'NWoT1ZVd1Lo#1';
const mine=new Set(C.find(c=>c.id===TARGET).members.map(m=>m.crop));
const vid=TARGET.split('#')[0];
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin).filter(w=>w.vid===vid);
const COVER=0.15;
function ov(f,b){const x1=Math.max(f.x1,b.x1),y1=Math.max(f.y1,b.y1),x2=Math.min(f.x2,b.x2),y2=Math.min(f.y2,b.y2);
 if(x2<=x1||y2<=y1)return 0;const a=(f.x2-f.x1)*(f.y2-f.y1);return a>0?((x2-x1)*(y2-y1))/a:0;}
const g='man';
function run(pooled){
 let tot=0,cov=0, metaClearButCovered=0, metaFlagged=0, coveredByOwn=0, coveredByOther=0,
     birthsWhileClear=0, blurredNewborn=0, decidedClearFrames=0, identBroke=0, seenIds=new Set();
 let voteLog=[];
 for(const win of wins){
  let tracks=[]; const dt=1000/win.fps; setVerdictCadence(dt);
  const subs=[];
  const match=d=>{if(!d)return null;let best=null,bs=SIM;for(const s of subs){const c=cos(d,s.proto);if(c>bs){bs=c;best=s;}}
    if(best){for(let i=0;i<D;i++)best.proto[i]=best.proto[i]*0.9+d[i]*0.1;return best;}
    const s={proto:Float32Array.from(d),votes:0,sumLogit:0,decided:null};subs.push(s);return s;};
  for(const fr of win.frames){
   const base=faceMeta(g,fr.faces.map(readOf));
   const meta=fr.faces.map((f,i)=>{ const b=base[i]||{}; if(!pooled) return b;
    const s=match(descOf(win,f.descIdx)); if(!s) return b;
    if(f.nm>=NM){ s.sumLogit+=logit(1-f.raw); s.votes++; }
    if(s.votes>=MINV){const p=sigm(s.sumLogit/s.votes);const conf=2*Math.abs(p-0.5);
      if(conf>=Math.max(0.40,CLEAR/Math.sqrt(s.votes))) s.decided=p>0.5?'cover':'clear';
      if(mine.has(f.crop)) voteLog.push({v:s.votes,p:+p.toFixed(3),conf:+conf.toFixed(3),d:s.decided});}
    if(s.decided==='clear') return {...b,flagged:false,certain:true,abstained:false};
    return {...b,flagged:true,certain:true,abstained:false,instant:true}; });
   let obs=fr.faces.map((f,i)=>({box:personFromFace(f,ASPECT),...(meta[i]||{}),
     nullMint:!!(meta[i]&&meta[i].nullRead),faceFound:true,verdictDt:dt,desc:descOf(win,f.descIdx),
     _crop:f.crop}));
   obs=dedupeObservations(obs);
   const before=new Set(tracks.map(t=>t.id));
   tracks=updatePersonTracks(tracks,obs,dt,null);
   const newIds=tracks.filter(t=>!before.has(t.id));
   for(const f of fr.faces){
    if(!mine.has(f.crop)) continue;
    tot++;
    const i=fr.faces.indexOf(f); const m=meta[i]||{};
    if(m.flagged) metaFlagged++; if(m.flagged===false&&m.certain) decidedClearFrames++;
    let best=-1,bf=0; tracks.forEach((t,k)=>{const o=ov(f,t.box); if(o>bf){bf=o;best=k;}});
    const covering = tracks.filter(t=>t.state!=='cleared').filter(t=>ov(f,t.box)>=COVER);
    if(covering.length){ cov++;
      if(!m.flagged) metaClearButCovered++;
      const own = best>=0?tracks[best]:null;
      if(own && covering.some(t=>t.id===own.id)) coveredByOwn++; else coveredByOther++;
      if(newIds.some(t=>covering.some(c2=>c2.id===t.id))) blurredNewborn++;
    }
    for(const t of newIds) if(ov(f,t.box)>=COVER) { birthsWhileClear++; break; }
   }
  }
 }
 return {tot,cov,pct:(100*cov/tot).toFixed(1),metaClearButCovered,metaFlagged,decidedClearFrames,
   coveredByOwn,coveredByOther,blurredNewborn,birthsOnHim:birthsWhileClear,voteLog};
}
for(const [n,p] of [['A0 (per-frame)',false],['A5 (pooled)',true]]){
 const r=run(p);
 console.log(`${n}: his reads ${r.tot}, COVERED ${r.cov} (${r.pct}%)`);
 console.log(`   meta said FLAG on ${r.metaFlagged} reads; meta said CLEAR-certain on ${r.decidedClearFrames}`);
 console.log(`   covered while meta said CLEAR: ${r.metaClearButCovered}   <- tracker's doing`);
 console.log(`   covered by HIS OWN best-overlap track: ${r.coveredByOwn}   by a DIFFERENT track: ${r.coveredByOther}`);
 console.log(`   of the covered reads, ${r.blurredNewborn} were covered by a track BORN this frame`);
 console.log(`   frames in which a NEW track was born on top of him: ${r.birthsOnHim}`);
 if(r.voteLog.length) console.log('   pooled trace (last 6):',JSON.stringify(r.voteLog.slice(-6)));
 console.log('');
}
