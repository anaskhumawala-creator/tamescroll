// Does passing `desc` to the tracker help or HURT A0? The author's comment
// says it "lets a re-appearing face inherit a clear". person-track uses desc
// ONLY for identityBroken -> reset to blurred. Measure both ways.
import fs from 'fs';
import { faceMeta, personFromFace, dedupeObservations, updatePersonTracks, setVerdictCadence } from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin } from './arch-arms.mjs';
const ASPECT = W/H, D = 1024;
const readOf = (f) => ({ gender:f.gender, score:f.score, raw:f.raw, age:f.age, childP:f.childP, shape:f.shape, desc:null });
function descOf(win,i){ if(i==null||i<0) return null; const o=i*D; return o+D<=win.desc.length?win.desc.subarray(o,o+D):null; }
function armShipped(useDesc, hold){ return function(win,g){
  let tracks=[]; const out=[], dt=1000/win.fps; setVerdictCadence(dt); let held=null;
  for(const fr of win.frames){
    const meta = faceMeta(g, fr.faces.map(readOf));
    let obs = fr.faces.map((f,i)=>{ const m=meta[i]||{}; return {
      box: personFromFace(f, ASPECT), flagged:m.flagged, certain:m.certain, abstained:m.abstained,
      instant:m.instant, weak:m.weak, nullMint:!!m.nullRead, faceFound:true, verdictDt:dt,
      desc: useDesc ? descOf(win,f.descIdx) : null }; });
    obs = dedupeObservations(obs);
    tracks = updatePersonTracks(tracks, obs, dt, hold?held:null);
    if(hold) held = tracks.nullHeld || [];
    out.push({t:fr.t, faces:fr.faces, patches:tracks.filter(t=>t.state!=='cleared').map(t=>({...t.box}))});
  } return out; };}
const g=process.env.GENDER||'man';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cl=new Map();
for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'))) if(L[c.id]) for(const m of c.members) cl.set(m.crop,L[c.id]);
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
for(const [name,arm] of [['A0 desc=null  hold=off',armShipped(false,false)],
                         ['A0 desc=REAL  hold=off',armShipped(true,false)],
                         ['A0 desc=REAL  hold=ON (=1079)',armShipped(true,true)],
                         ['A0 desc=null  hold=ON',armShipped(false,true)]]){
  const a={exposureS:0,falseCoverS:0,phantomS:0,coveredS:0,sharpOkS:0};
  for(const w of wins){ const s=score(arm(w,g),g,c=>cl.get(c)); for(const k in a) a[k]+=s[k]; }
  console.log(name.padEnd(32)+('exp '+a.exposureS.toFixed(1)).padStart(10)+('  falseCover '+a.falseCoverS.toFixed(1))+('  phantom '+a.phantomS.toFixed(1)));
}
