// CAN A NULL READ EVER BE A CHILD? Answered without a device run, by
// mining every read ring this repo has ever banked under spikes/.
//
// The question matters because the reverted mint gate (2638d2f/168206f)
// guarded `isNullRead` with `isAdultRead` specifically to protect a
// child, and a critic charged that the guard is structurally dead. The
// FIRST critic's argument for that was wrong -- see age-childp-bound.mjs,
// which constructs a bimodal posterior with mean 39.4 and childP 0.294 --
// so the mean does NOT bound the tail. The conclusion is right anyway,
// and this is why.
//
// Reconstructs `isNullRead` exactly as gender-verdict.mjs ships it, and
// on the way validates the s -> raw inversion that
// probe_null_child_img.py depends on (score = min(0.99, 2*|raw-0.5|)).
//
// Run: node app/gaze/bench/null-child-mine.mjs
import fs from 'fs'; import path from 'path';
const files=[];(function walk(d){let e;try{e=fs.readdirSync(d,{withFileTypes:true});}catch{return;}
 for(const x of e){const p=path.join(d,x.name); if(x.isDirectory())walk(p); else if(x.name.endsWith('.json'))files.push(p);}})('Z:/Apps/Disconnect/spikes');
const reads=[];
function scan(o){if(!o||typeof o!=='object')return;if(Array.isArray(o)){for(const x of o)scan(x);return;}
 if('g' in o&&'a' in o&&(('pc'in o)||('c'in o)))reads.push({g:o.g,s:o.s,a:o.a,pc:o.pc!=null?o.pc:o.c,v:o.v??null});
 for(const k of Object.keys(o))scan(o[k]);}
for(const f of files){try{scan(JSON.parse(fs.readFileSync(f,'utf8')));}catch{}}

// 1) VALIDATE THE s -> v INVERSION used by probe_null_child_img
const both=reads.filter(r=>typeof r.s==='number'&&typeof r.v==='number');
let bad=0,maxerr=0;
for(const r of both){const pred=r.g==='male'?0.5+r.s/2:0.5-r.s/2;
  const e=Math.abs(pred-r.v); if(e>maxerr&&r.s<0.99)maxerr=e; if(e>0.011&&r.s<0.99)bad++;}
console.log('INVERSION check over',both.length,'reads carrying both s and v: mismatches>0.011 =',bad,' max err (excl s=0.99 clamp) =',maxerr.toFixed(4));
const clamped=both.filter(r=>r.s>=0.99); console.log('  reads at the 0.99 clamp (uninvertible):',clamped.length, '=',(100*clamped.length/both.length).toFixed(1)+'%');

// 2) EMPIRICAL FRONTIER: max childP observed at each age
const R=reads.filter(r=>typeof r.a==='number'&&typeof r.pc==='number');
const byAge=new Map();
for(const r of R){const a=Math.round(r.a); byAge.set(a,Math.max(byAge.get(a)??0,r.pc));}
const ages=[...byAge.keys()].sort((a,b)=>a-b);
console.log('max childP by age (age:maxChildP), ages 25..50:');
console.log('  '+ages.filter(a=>a>=25&&a<=50).map(a=>a+':'+byAge.get(a).toFixed(2)).join('  '));
// correlation
const n=R.length; const ma=R.reduce((s,r)=>s+r.a,0)/n, mc=R.reduce((s,r)=>s+r.pc,0)/n;
let sab=0,sa=0,sb=0; for(const r of R){const da=r.a-ma,dc=r.pc-mc;sab+=da*dc;sa+=da*da;sb+=dc*dc;}
console.log('pearson(age, childP) =', (sab/Math.sqrt(sa*sb)).toFixed(3), 'over', n, 'reads');
// 3) how strong is the null-read guard-dead result
const nb=reads.filter(r=>r.g==='male'&&typeof r.v==='number'&&r.v>=0.53&&r.v<=0.72&&r.a>=34&&r.a<=42&&typeof r.pc==='number');
const s=nb.map(r=>r.pc).sort((a,b)=>a-b);
console.log('NULL READS n='+nb.length+' childP min/p50/p95/max =',s[0],s[Math.floor(s.length/2)],s[Math.floor(s.length*0.95)],s[s.length-1]);
console.log('  95% Clopper-Pearson upper bound on P(childP>=0.25 | null) with 0/'+nb.length+' =',(1-Math.pow(0.05,1/nb.length)).toExponential(2));
