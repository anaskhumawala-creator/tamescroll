// THE MISSING CONTROL. A5's gain decomposes into (a) pooling and (b) lowering
// the pooled bar 0.60 -> <=0.45. (b) is `clear-bar-roc.mjs`'s already-refuted
// move. So: what does the SHIPPED per-frame A0 do with the same bar lowered?
// If A0-lowbar gets most of A5's win, the "per-subject architecture" is not
// what is buying it.
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { ROOT, W, H } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, armSubject, ARM_A0, POOL_BAR } from './arch-arms.mjs';
import { patchConsts, shippedBar } from './_patch.mjs';
const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url),'utf8');
const g=process.env.GENDER||'man';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const cl=new Map();
for(const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'))) if(L[c.id]) for(const m of c.members) cl.set(m.crop,L[c.id]);
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
const ASPECT=W/H, D=1024;
const readOf=(f)=>({gender:f.gender,score:f.score,raw:f.raw,age:f.age,childP:f.childP,shape:f.shape,desc:null});
function descOf(win,i){if(i==null||i<0)return null;const o=i*D;return o+D<=win.desc.length?win.desc.subarray(o,o+D):null;}
function run(a){const agg={exposureS:0,falseCoverS:0,phantomS:0,coveredS:0,sharpOkS:0};
 for(const w of wins){const s=score(a(w,g),g,c=>cl.get(c)); for(const k in agg)agg[k]+=s[k];} return agg;}
const line=(n,af)=>{const a=run(af);console.log(n.padEnd(38)+a.exposureS.toFixed(1).padStart(8)+a.falseCoverS.toFixed(1).padStart(12)+a.phantomS.toFixed(1).padStart(9)+a.coveredS.toFixed(1).padStart(10)+a.sharpOkS.toFixed(1).padStart(9));};
console.log('arm                                 EXPOSURE  FALSECOVER  PHANTOM   covered   sharp');
const [SHIP_M, SHIP_F] = shippedBar(src);
line(`A0 shipped (bar ${SHIP_M}/${SHIP_F})`, ARM_A0);
for(const [m,f] of [[0.45,0.35],[0.40,0.30],[0.30,0.25],[0.25,0.25]]){
  // BY NAME, not by literal: the sweep used to patch `0.6`, and loop 39
  // shipped 0.45 -- so this file has been exiting on its own guard.
  // The FIRST row of the sweep is now the shipped pair, which makes it a
  // self-check: it must reproduce ARM_A0 above it, line for line.
  const patched = patchConsts(src,
    { GENDER_CLEAR_SCORE: m, GENDER_CLEAR_SCORE_FEMALE: f });
  // MODULE-RELATIVE, not cwd-relative. It was './.cache/critic-lb.mjs',
  // so this arm only ran from inside bench/ and threw ENOENT from the
  // repo root -- which is where every other bench in this repo is run.
  const p = fileURLToPath(new URL('./.cache/critic-lb.mjs', import.meta.url));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, patched);
  const mod = await import(pathToFileURL(p).href + '?v=' + m);
  const arm=(win,gg)=>{let tracks=[];const out=[],dt=1000/win.fps;mod.setVerdictCadence(dt);
    for(const fr of win.frames){const meta=mod.faceMeta(gg,fr.faces.map(readOf));
      let obs=fr.faces.map((ff,i)=>{const mm=meta[i]||{};return{box:mod.personFromFace(ff,ASPECT),
        flagged:mm.flagged,certain:mm.certain,abstained:mm.abstained,instant:mm.instant,weak:mm.weak,
        nullMint:!!mm.nullRead,faceFound:true,verdictDt:dt,desc:descOf(win,ff.descIdx)};});
      obs=mod.dedupeObservations(obs); tracks=mod.updatePersonTracks(tracks,obs,dt,null);
      out.push({t:fr.t,faces:fr.faces,patches:tracks.filter(t=>t.state!=='cleared').map(t=>({...t.box}))});}
    return out;};
  line(`A0 per-frame, clear bar ${m}/${f}`, arm);
}
// THESE TWO WERE THE SAME ARM. `poolBar` was never read, so "bar .60"
// and "bar .40" both ran at the module constant 0.40 and printed
// identical rows -- 5.5 / 210.0 / 314.0. Labelled by the number that is
// actually applied now.
line(`A1 pool, bar ${POOL_BAR.toFixed(2)} (default)`, armSubject({}));
line('A1 pool, bar 0.60', armSubject({poolBar:0.60}));
