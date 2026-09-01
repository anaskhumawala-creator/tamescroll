import fs from 'fs';
const data = JSON.parse(fs.readFileSync(process.env.CCACHE,'utf8'));
const RATE=10;
// scdet=30 reproduction
for (const SC of [28,30,32,35]) {
  let cutD=[],restD=[],n=0;
  for (const e of data){ const t=e.sc.filter(([s])=>s>=SC).map(([,x])=>x); n+=t.length;
    const idx=new Set(t.map(x=>Math.min(e.n-1,Math.max(1,Math.ceil(x*RATE)))));
    for(let i=1;i<e.n;i++)(idx.has(i)?cutD:restD).push(e.d[i-1]); }
  cutD.sort((a,b)=>a-b);restD.sort((a,b)=>a-b);
  const q=(a,p)=>a[Math.floor(p*(a.length-1))];
  console.log(`SC=${SC} cutFrames ${cutD.length} p05 ${q(cutD,0.05).toFixed(1)} p25 ${q(cutD,0.25).toFixed(1)} p50 ${q(cutD,0.5).toFixed(1)} p95 ${q(cutD,0.95).toFixed(1)} | REST p50 ${q(restD,0.5).toFixed(1)} p90 ${q(restD,0.9).toFixed(1)} p95 ${q(restD,0.95).toFixed(1)} p99 ${q(restD,0.99).toFixed(1)} | ` +
   [28,50,60,75,90].map(t=>`${t}:${(100*cutD.filter(d=>d>=t).length/cutD.length).toFixed(1)}%/${restD.filter(d=>d>=t).length}`).join(' '));
}
// correlation: our 10Hz delta vs max scdet score inside the same 100ms window
let xs=[],ys=[];
for (const e of data){
  const bins=new Map();
  for(const [s,t] of e.sc){const i=Math.min(e.n-1,Math.max(1,Math.ceil(t*RATE)));bins.set(i,Math.max(bins.get(i)||0,s));}
  for(let i=1;i<e.n;i++){xs.push(e.d[i-1]);ys.push(bins.get(i)||0);}
}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const mx=mean(xs),my=mean(ys);
let sxy=0,sxx=0,syy=0;for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;sxy+=a*b;sxx+=a*a;syy+=b*b;}
console.log(`\npearson(our 16x16 luma delta, scdet score) over ${xs.length} 10Hz frames = ${(sxy/Math.sqrt(sxx*syy)).toFixed(3)}`);
// spearman-ish on the subset where scdet reported anything
let xs2=[],ys2=[];for(let i=0;i<xs.length;i++)if(ys[i]>0){xs2.push(xs[i]);ys2.push(ys[i]);}
const m2=mean(xs2),n2=mean(ys2);let a2=0,b2=0,c2=0;for(let i=0;i<xs2.length;i++){const a=xs2[i]-m2,b=ys2[i]-n2;a2+=a*b;b2+=a*a;c2+=b*b;}
console.log(`pearson on the ${xs2.length} frames where scdet reported at all = ${(a2/Math.sqrt(b2*c2)).toFixed(3)}`);
