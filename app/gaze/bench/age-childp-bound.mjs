// THE ANALYTIC HALF: does an age MEAN in [NULL_AGE_LO 34, NULL_AGE_HI 42]
// bound childP below GENDER_CHILD_MASS 0.25? It does NOT.
//
// age = sum(a * p(a)) and childP = sum_{a<18} p(a) over the same 100-bin
// softmax (detector.js), so the mean constrains the tail only weakly: an
// LP bound gives childP <= 0.79 at mean 34, and an ordinary bimodal
// posterior (child mode near 10, adult mode near 52) reaches mean 39.4
// with childP 0.294. detector.js documents this model emitting exactly
// that shape. So "childP is small BY CONSTRUCTION for a null read" is
// only true for a UNIMODAL posterior, which nobody established.
//
// Run: node app/gaze/bench/age-childp-bound.mjs
// Does age (mean of a 100-bin softmax) in [34,42] bound childP = P(a<18)?
// Maximize childP subject to mean in [34,42]. LP: put child mass at a=17
// (max age still counted as child), adult mass at a=99 (max mean pull).
function maxChildP(meanLo){ return (99 - meanLo) / (99 - 17); }
console.log('LP upper bound on childP:');
for (const m of [34, 37, 42]) console.log('  mean =', m, '-> childP <=', maxChildP(m).toFixed(3));

// Explicit realizable bimodal posterior: child mode + adult prior mode.
function stats(bins){ let mean=0,cp=0,peak=0,pb=0,ent=0;
  for(let a=0;a<100;a++){const p=bins[a]||0; mean+=a*p; if(a<18)cp+=p;
    if(p>peak){peak=p;pb=a;} if(p>1e-9)ent-=p*Math.log(p);} 
  return {mean:+mean.toFixed(2),childP:+cp.toFixed(3),peakBin:pb,peakMass:+peak.toFixed(3),ent:+ent.toFixed(2)};}

// A: two spikes
const A=new Array(100).fill(0); A[8]=0.30; A[49]=0.70;
console.log('A two-spike  ', JSON.stringify(stats(A)));

// B: smooth, realistic — gaussian child mode (mu 10, sd 4) + adult mode (mu 50, sd 12)
function gauss(mu,sd){const b=new Array(100).fill(0);let s=0;
  for(let a=0;a<100;a++){const v=Math.exp(-((a-mu)**2)/(2*sd*sd));b[a]=v;s+=v;}
  return b.map(v=>v/s);}
const c=gauss(10,4), ad=gauss(52,13);
for(const w of [0.25,0.30,0.35]){
  const B=c.map((v,i)=>w*v+(1-w)*ad[i]);
  console.log('B w='+w+'      ', JSON.stringify(stats(B)));
}
// C: what a UNIMODAL prior centred on 37 actually gives
for(const sd of [8,12,16,20,25]){
  console.log('C unimodal 37 sd='+sd, JSON.stringify(stats(gauss(37,sd))));
}
