// TURN ~1800 CROPS INTO ~40 QUESTIONS.
//
// Requirement 3 of the handoff is labels from a human, once -- and the
// reason the repo has never had them is that labelling every read is
// hours of the owner's time. faceres already emits a 1024-d IDENTITY
// descriptor beside every read, and identity is INDEPENDENT of the
// gender/verdict decision being scored, so clustering on it is not
// circular: it groups by who the face is, never by what the pipeline
// decided about them.
//
// Each cluster is shown as a grid of its own crops so a merge of two
// people is visible at a glance -- there is a "mixed" answer for
// exactly that, and a mixed cluster is DROPPED from scoring rather
// than guessed at.
import fs from 'fs';
import { encodePNG, readPPM } from './png.mjs';
import { ROOT } from './corpus-lib.mjs';

const SIM = Number(process.env.CLUSTER_SIM || 0.6);   // MEM_SIM_CLEAR
const GRID = 12;                                      // crops shown per cluster

const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const byVid = {};
for (const f of files) {
  const w = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${f}`, 'utf8'));
  const tag = f.replace(/\.json$/, '');
  const descBuf = fs.readFileSync(`${ROOT}/bank/reads/${tag}.desc`);
  const desc = new Float32Array(descBuf.buffer, descBuf.byteOffset, descBuf.length / 4);
  (byVid[w.vid] = byVid[w.vid] || []).push({ tag, w, desc });
}

const dot = (a, ai, b, bi) => { let s = 0; for (let i = 0; i < 1024; i++) s += a[ai * 1024 + i] * b[bi * 1024 + i]; return s; };

const clusters = [];
for (const vid of Object.keys(byVid)) {
  // Centroids kept as plain arrays; descriptors are already L2-normed,
  // so cosine is a dot product and a centroid is re-normalised on add.
  const cents = [];
  for (const win of byVid[vid]) {
    for (const fr of win.w.frames) {
      for (const face of fr.faces) {
        if (face.descIdx < 0) continue;
        let best = -1, bestS = -2;
        for (let c = 0; c < cents.length; c++) {
          let s = 0; for (let i = 0; i < 1024; i++) s += cents[c].v[i] * win.desc[face.descIdx * 1024 + i];
          if (s > bestS) { bestS = s; best = c; }
        }
        let ci;
        if (bestS >= SIM) { ci = best; } else {
          cents.push({ v: new Float64Array(1024), n: 0, vid, members: [] }); ci = cents.length - 1;
        }
        const c = cents[ci];
        for (let i = 0; i < 1024; i++) c.v[i] = (c.v[i] * c.n + win.desc[face.descIdx * 1024 + i]) / (c.n + 1);
        let nrm = 0; for (let i = 0; i < 1024; i++) nrm += c.v[i] * c.v[i];
        nrm = Math.sqrt(nrm) || 1; for (let i = 0; i < 1024; i++) c.v[i] /= nrm;
        c.n++;
        c.members.push({ tag: win.tag, t: fr.t, crop: face.crop, px: Math.round(face.px),
          gender: face.gender, score: face.score, raw: face.raw, nm: face.nm });
      }
    }
  }
  cents.forEach((c, i) => clusters.push({ id: `${vid}#${i}`, vid, n: c.n, members: c.members }));
}

clusters.sort((a, b) => b.n - a.n);
console.log('clusters', clusters.length, 'faces', clusters.reduce((a, c) => a + c.n, 0));

// Crops as PNG data URIs so the page is ONE self-contained file the
// owner can open from anywhere with no server running.
fs.mkdirSync(`${ROOT}/bank/label`, { recursive: true });
const png = (crop) => {
  const p = readPPM(fs.readFileSync(`${ROOT}/bank/crops/${crop}`));
  return 'data:image/png;base64,' + encodePNG(p.rgb, p.w, p.h).toString('base64');
};
const rows = clusters.map((c) => {
  const step = Math.max(1, Math.floor(c.members.length / GRID));
  const shown = [];
  for (let i = 0; i < c.members.length && shown.length < GRID; i += step) shown.push(c.members[i]);
  const px = c.members.map((m) => m.px).sort((a, b) => a - b);
  return { id: c.id, vid: c.vid, n: c.n,
    pxP50: px[px.length >> 1], pxMin: px[0], pxMax: px[px.length - 1],
    imgs: shown.map((m) => png(m.crop)) };
});
fs.writeFileSync(`${ROOT}/bank/label/clusters.json`, JSON.stringify(clusters.map((c) => ({ id: c.id, vid: c.vid, members: c.members }))));

const html = `<!doctype html><meta charset=utf-8><title>tamescroll corpus labels</title>
<style>
body{background:#111;color:#eee;font:14px system-ui;margin:0;padding:16px}
.c{border:1px solid #333;border-radius:8px;padding:10px;margin:0 0 12px}
.g{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}
.g img{width:76px;height:76px;image-rendering:pixelated;border-radius:4px}
.m{color:#999;font-size:12px}
button{font:13px system-ui;padding:6px 10px;margin-right:6px;border-radius:6px;border:1px solid #444;background:#1c1c1c;color:#eee;cursor:pointer}
button.on{background:#2d6;color:#000;border-color:#2d6}
#bar{position:sticky;top:0;background:#111;padding:8px 0;border-bottom:1px solid #333;z-index:9}
</style>
<div id=bar><b>Label each cluster.</b> <span id=prog></span>
<button onclick=save()>Download labels.json</button></div>
<div id=list></div>
<script>
const DATA = ${JSON.stringify(rows)};
const ans = {};
function draw(){
  document.getElementById('list').innerHTML = DATA.map(c=>\`
   <div class=c id="c_\${c.id}">
    <div><b>\${c.id}</b> <span class=m>\${c.n} reads · px \${c.pxMin}/\${c.pxP50}/\${c.pxMax}</span></div>
    <div class=g>\${c.imgs.map(s=>'<img src="'+s+'">').join('')}</div>
    <div>
      <button data-i="\${c.id}" data-v="man">Man</button>
      <button data-i="\${c.id}" data-v="woman">Woman</button>
      <button data-i="\${c.id}" data-v="child">Child</button>
      <button data-i="\${c.id}" data-v="notperson">Not a person</button>
      <button data-i="\${c.id}" data-v="mixed">Mixed / unsure</button>
    </div></div>\`).join('');
  document.getElementById('list').onclick = e=>{
    const b=e.target.closest('button[data-i]'); if(!b) return;
    ans[b.dataset.i]=b.dataset.v;
    [...document.querySelectorAll('[data-i="'+CSS.escape(b.dataset.i)+'"]')].forEach(x=>x.classList.toggle('on',x===b));
    prog();
  };
  prog();
}
function prog(){document.getElementById('prog').textContent=Object.keys(ans).length+' / '+DATA.length+' done  ';}
function save(){
  const blob=new Blob([JSON.stringify(ans,null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='labels.json';a.click();
}
draw();
</script>`;
fs.writeFileSync(`${ROOT}/bank/label/label.html`, html);
console.log('wrote', `${ROOT}/bank/label/label.html`);
