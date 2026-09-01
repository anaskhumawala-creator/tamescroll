// WHO IS ACTUALLY PUSHING THE EDGE? The clamp is only as safe as the
// population allowed to move it. The score cannot answer this -- a
// graphic or a hand carries no label, so the strip it uncovers costs
// nothing in the table. Ask the labels directly instead.
import fs from 'fs';
import { faceMeta, personFromFace, setVerdictCadence } from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
const ASPECT=W/H, D=1024, SIM=.6, NM=5, CLEAR=.6, MINV=3, BAR=.4;
const lg=v=>Math.log(Math.max(1e-6,v)/Math.max(1e-6,1-v)), sg=z=>1/(1+Math.exp(-z));
const labels=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cropId=new Map();
for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8')))
  for(const m of c.members) cropId.set(m.crop,c.id);
const dOf=(w,i)=>{const o=i*D;return (i!=null&&i>=0&&o+D<=w.desc.length)?w.desc.subarray(o,o+D):null;};
const cs=(a,b)=>{let s=0;for(let i=0;i<D;i++)s+=a[i]*b[i];return s;};
const rd=f=>({gender:f.gender,score:f.score,raw:f.raw,age:f.age,childP:f.childP,shape:f.shape,desc:null});
const tally=new Map(); let events=0;
for(const file of fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json'))){
  const win=loadWin(file); const dt=1000/win.fps; setVerdictCadence(dt); const subs=[];
  for(const fr of win.frames){
    const base=faceMeta('man',fr.faces.map(rd)); const dec=[];
    fr.faces.forEach((f,i)=>{ const d=dOf(win,f.descIdx); if(!d){dec.push(null);return;}
      let best=null,bs=SIM; for(const s of subs){const c=cs(d,s.proto); if(c>bs){bs=c;best=s;}}
      if(best) for(let k=0;k<D;k++) best.proto[k]=best.proto[k]*.9+d[k]*.1;
      else {best={proto:Float32Array.from(d),votes:0,sumLogit:0,decided:null};subs.push(best);}
      if(f.nm>=NM){best.sumLogit+=lg(1-f.raw);best.votes++;}
      if(best.votes>=MINV){const p=sg(best.sumLogit/best.votes);
        if(2*Math.abs(p-.5)>=Math.max(BAR,CLEAR/Math.sqrt(best.votes))) best.decided=p>.5?'cover':'clear';}
      dec.push(best.decided); void base;
    });
    const clears=fr.faces.filter((f,i)=>dec[i]==='clear'&&f.nm>=NM);
    fr.faces.forEach((f,i)=>{ if(dec[i]==='clear') return;
      const body=personFromFace(f,ASPECT);
      for(const o of clears){ if(o===f) continue;
        if(o.y2<body.y1||o.y1>body.y2) continue;
        const ocx=(o.x1+o.x2)/2, fcx=(f.x1+f.x2)/2;
        const moves = ocx<fcx ? (Math.min(f.x1,o.x2)>body.x1) : (Math.max(f.x2,o.x1)<body.x2);
        if(!moves) continue;
        events++;
        const lab=labels[cropId.get(o.crop)]||'UNLABELLED';
        tally.set(lab,(tally.get(lab)||0)+1);
      }
    });
  }
}
console.log('clamp events',events,'-- label of the face that pushed the edge:');
[...tally.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>
  console.log('  '+k.padEnd(14)+String(v).padStart(5)+'   '+(100*v/events).toFixed(0)+'%'));
