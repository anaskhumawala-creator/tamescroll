// LABEL SENSITIVITY.
// (a) 3 of the 31 `notperson` clusters are HANDS and 1 is the BACK OF A HEAD
//     with a cap. This repo's own R21 ruling: "A hand is part of a person, so
//     a patch there is not GHOST". Reclassify and re-score PHANTOM.
// (b) The `mixed` rule lets ONE unlabelled face claim EVERY overlapping patch,
//     while a labelled face claims only its BEST. Make it symmetric.
// (c) RcGyVTAoXEU#0 (193 reads, the biggest cluster in the corpus) is labelled
//     `mixed`; the contact sheet shows one woman throughout. Label her `woman`.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';
const L=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`,'utf8'));
const C=JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`,'utf8'));
const mk=over=>{const m=new Map();for(const c of C){const lab=(over&&over[c.id])||L[c.id];if(lab)for(const x of c.members)m.set(x.crop,lab);}return m;};
const COVER=0.15;
function ov(f,b){const x1=Math.max(f.x1,b.x1),y1=Math.max(f.y1,b.y1),x2=Math.min(f.x2,b.x2),y2=Math.min(f.y2,b.y2);
 if(x2<=x1||y2<=y1)return 0;const a=(f.x2-f.x1)*(f.y2-f.y1);return a>0?((x2-x1)*(y2-y1))/a:0;}
// scorer variant with a switch for symmetric claiming
function sc(frames,g,labelOf,symmetric){
 const dtS=frames.length>1?frames[1].t-frames[0].t:0.5;
 let ex=0,fc=0,ph=0,cv=0,sh=0;
 const should=l=>g==='man'?(l==='woman'||l==='child'):(l==='man'||l==='child');
 for(const fr of frames){const claimed=new Set();
  for(const f of fr.faces){const lab=labelOf(f.crop);
   if(!lab||lab==='mixed'){
     if(symmetric){let best=-1,bf=0;fr.patches.forEach((p,i)=>{const o=ov(f,p);if(o>bf){bf=o;best=i;}});if(bf>=COVER&&best>=0)claimed.add(best);}
     else fr.patches.forEach((p,i)=>{if(ov(f,p)>=COVER)claimed.add(i);});
     continue;}
   let best=-1,bf=0;fr.patches.forEach((p,i)=>{const o=ov(f,p);if(o>bf){bf=o;best=i;}});
   const c2=bf>=COVER; if(c2&&best>=0)claimed.add(best);
   if(lab==='notperson'){if(c2)ph+=dtS;continue;}
   if(should(lab)) c2?cv+=dtS:ex+=dtS; else c2?fc+=dtS:sh+=dtS;}
  fr.patches.forEach((p,i)=>{if(!claimed.has(i))ph+=dtS;});}
 return{ex,fc,ph};}
const g='man';
const wins=fs.readdirSync(`${ROOT}/bank/reads`).filter(f=>f.endsWith('.json')).map(loadWin);
const A5=armSubject({nmWeight:true,poolBar:0.40});
function tot(arm,map,sym){const a={ex:0,fc:0,ph:0};for(const w of wins){const s=sc(arm(w,g),g,c=>map.get(c),sym);for(const k in a)a[k]+=s[k];}return a;}
const show=(n,a)=>console.log(n.padEnd(52)+('exp '+a.ex.toFixed(1)).padStart(9)+('  fc '+a.fc.toFixed(1)).padStart(11)+('  ph '+a.ph.toFixed(1)).padStart(11));
const base=mk();
show('A0  as published',tot(ARM_A0,base,false));
show('A5  as published',tot(A5,base,false));
// (a) hands + cap-back-of-head are people, not ghosts
const bodyParts={'H14bBuluwB8#2':'man','H14bBuluwB8#4':'man','NWoT1ZVd1Lo#2':'man','NWoT1ZVd1Lo#9':'man'};
const mapA=mk(bodyParts);
console.log('\n(a) 4 notperson clusters (35 hand reads + 24 back-of-head) relabelled as a PERSON of the user\'s own gender (so covering them is FALSE COVER, not PHANTOM):');
show('A0  hands/head = person',tot(ARM_A0,mapA,false));
show('A5  hands/head = person',tot(A5,mapA,false));
console.log('\n(b) mixed/unlabelled faces claim only their BEST patch (symmetric with labelled faces):');
show('A0  symmetric claiming',tot(ARM_A0,base,true));
show('A5  symmetric claiming',tot(A5,base,true));
console.log('\n(c) RcGyVTAoXEU#0 (193 reads) relabelled woman (contact sheet shows one woman):');
const mapC=mk({'RcGyVTAoXEU#0':'woman'});
show('A0  biggest cluster = woman',tot(ARM_A0,mapC,false));
show('A5  biggest cluster = woman',tot(A5,mapC,false));
console.log('\n(a)+(b)+(c) together:');
const mapAll=mk({...bodyParts,'RcGyVTAoXEU#0':'woman'});
show('A0',tot(ARM_A0,mapAll,true)); show('A5',tot(A5,mapAll,true));
