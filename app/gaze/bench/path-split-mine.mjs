// IS IT THE DEVICE, OR IS IT THE VIDEO PATH?
//
// On his phone (1078, 111 reads over one watch page) the male raw
// sigmoid sits at p50 0.616 with a MAX of 0.745, against
// GENDER_CLEAR_SCORE 0.6 -- so |v-0.5| never reaches 0.3 and NOT ONE MAN
// CAN EVER BE CLEARED. The banked corpus reads male p50 0.71-0.75 with
// thousands at or above 0.6. Two things differ at once between those
// numbers: the DEVICE and the PIXEL PATH (his figure is the player; the
// corpus is overwhelmingly thumbnails).
//
// This separates the second one WITHOUT a device run, by keeping the
// JSON path each banked read was found under. A player ring lives under
// a `player`/`reads` key or a `vread`-shaped record; an image ring lives
// under imgdiag. If player reads are weak on machines where image reads
// are strong, the defect is in the video path and no bench on his phone
// is needed to say so.
import fs from 'fs'; import path from 'path';
const files=[];(function walk(d){let e;try{e=fs.readdirSync(d,{withFileTypes:true});}catch{return;}
 for(const x of e){const p=path.join(d,x.name); if(x.isDirectory())walk(p); else if(x.name.endsWith('.json'))files.push(p);}})('Z:/Apps/Disconnect/spikes');

const reads=[];
function scan(o,file,trail){
  if(!o||typeof o!=='object')return;
  if(Array.isArray(o)){for(const x of o)scan(x,file,trail);return;}
  // A gender read: gender + score, plus at least one of the heads.
  if('g' in o && ('s' in o) && (('a' in o)||('v' in o))){
    reads.push({g:o.g,s:o.s,a:o.a,v:o.v??null,px:o.px??null,file,trail:trail.join('.')});
  }
  for(const k of Object.keys(o))scan(o[k],file,trail.concat(k));
}
for(const f of files){try{scan(JSON.parse(fs.readFileSync(f,'utf8')),f,[]);}catch{}}

function rawOf(r){
  if(typeof r.v==='number')return r.v;
  if(typeof r.s!=='number'||r.s>=0.99)return null;      // the clamp is uninvertible
  return r.g==='male'?0.5+r.s/2:0.5-r.s/2;
}
function q(a,p){if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];}
function row(name,rs){
  const male=rs.filter(r=>r.g==='male').map(rawOf).filter(v=>v!=null);
  const fem =rs.filter(r=>r.g==='female').map(rawOf).filter(v=>v!=null);
  const clearable=male.filter(v=>2*Math.abs(v-0.5)>=0.6).length;
  console.log(
    name.padEnd(22),
    'n',String(rs.length).padStart(6),
    '| male n',String(male.length).padStart(5),
    'v p05/p50/p95/max',
    [q(male,.05),q(male,.5),q(male,.95),male.length?Math.max(...male):null]
      .map(v=>v==null?'  -  ':v.toFixed(3)).join(' '),
    '| clearable',String(clearable).padStart(5),
    '=' , male.length?((100*clearable/male.length).toFixed(1)+'%').padStart(6):'  -  ',
    '| female n',String(fem.length).padStart(5),'p50',fem.length?q(fem,.5).toFixed(3):'  -  '
  );
}

// Classify by where in the JSON the read was found. `trail` is the key
// chain, so a player ring and an image ring are distinguishable even
// when both sit in one artifact.
const isPlayer=r=>/player|vread|\breads\b|gate/i.test(r.trail)&&!/img/i.test(r.trail);
const isImage =r=>/img/i.test(r.trail);

console.log('files scanned', files.length, ' reads found', reads.length);
row('ALL', reads);
row('PLAYER ring', reads.filter(isPlayer));
row('IMAGE ring',  reads.filter(isImage));
row('unclassified', reads.filter(r=>!isPlayer(r)&&!isImage(r)));

// Size is the other confound: a player face is often smaller than a
// thumbnail face, so compare inside a size band where both exist.
for(const [lo,hi] of [[40,64],[64,100],[100,1e9]]){
  const band=r=>typeof r.px==='number'&&r.px>=lo&&r.px<hi;
  console.log('-- px',lo,'..',hi===1e9?'inf':hi);
  row('  player',reads.filter(r=>isPlayer(r)&&band(r)));
  row('  image', reads.filter(r=>isImage(r)&&band(r)));
}
