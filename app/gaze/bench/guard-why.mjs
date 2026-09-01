// WHICH OF THE THREE GUARDS REFUSES A MEASURED BODY.
//
// boundBodyToSlot already shrinks the synthetic body onto a REJECTED
// MoveNet slot box, and rejectedSlotBoxes has no score floor -- so
// measured boxes already reach the shipped code and mostly do not
// survive. `bodyFromSlot` counts only the successes, so nothing has
// ever said WHICH guard does the refusing, and three constants have
// been unmovable for want of that one number.
//
// The predicate is re-stated here rather than imported because
// boundBodyToSlot returns a BOX and cannot report a reason. It is
// built FROM the shipped constants, so it moves with them.
import fs from 'fs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
const S = await import('./.cache/shipped.mjs');
const { parsePersons, rejectedSlotBoxes, lastSlotDiag, PERSON_MIN_SCORE,
        SLOT_BOUND_FACE_INSIDE, SLOT_BOUND_MIN_FACE_HEIGHTS,
        SLOT_BOUND_FACE_TOP_FRAC } = S;
console.log(`guards: faceInside ${SLOT_BOUND_FACE_INSIDE}  minFaceHeights ${SLOT_BOUND_MIN_FACE_HEIGHTS}  faceTopFrac ${SLOT_BOUND_FACE_TOP_FRAC}`);

const INSIDE = Number(process.env.INSIDE || SLOT_BOUND_FACE_INSIDE);
console.log('sweeping faceInside at ' + INSIDE);
const dir = `${ROOT}/bank/persons`;
const have = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.f32')) : [];
console.log(`windows banked: ${have.length}`);
const tally = { 'no slot box at all': 0, '1 face not inside slot': 0,
  '2 slot too short': 0, '3 face not in slot top': 0, '0 BOUND -- body shrunk': 0 };
let faces = 0;
for (const f of have) {
  const win = loadWin(f.replace('.f32', '.json'));
  const buf = fs.readFileSync(`${dir}/${f}`);
  const per = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const STRIDE = 6 * 56;
  win.frames.forEach((fr, fi) => {
    const off = fi * STRIDE;
    if (off + STRIDE > per.length) return;
    const raw = per.subarray(off, off + STRIDE);
    // parsePersons(data, minScore, aspect, held) -- the first version
    // passed the ASPECT as minScore, so the floor was 1.78, nothing was
    // admitted, and every slot read as "no box at all" on 1,764 faces.
    // A 100% bucket is a harness failure, not a finding.
    let boxes = [];
    try {
      parsePersons(raw, PERSON_MIN_SCORE, W / H, null);
      boxes = rejectedSlotBoxes(lastSlotDiag) || [];
    } catch (e) { boxes = []; }
    for (const face of fr.faces) {
      faces++;
      if (!boxes.length) { tally['no slot box at all']++; continue; }
      const fw = face.x2 - face.x1, fh = face.y2 - face.y1;
      const h = fh / 1.4, cy = (face.y1 + face.y2) / 2;
      let why = null, bound = false;
      for (const b of boxes) {
        const ix = Math.min(b.x2, face.x2) - Math.max(b.x1, face.x1);
        const iy = Math.min(b.y2, face.y2) - Math.max(b.y1, face.y1);
        if (ix <= 0 || iy <= 0 || ix * iy < fw * fh * INSIDE) { why = why || '1 face not inside slot'; continue; }
        const bh = b.y2 - b.y1;
        if (bh < h * SLOT_BOUND_MIN_FACE_HEIGHTS) { why = '2 slot too short'; continue; }
        if (cy > b.y1 + bh * SLOT_BOUND_FACE_TOP_FRAC) { why = '3 face not in slot top'; continue; }
        bound = true; break;
      }
      tally[bound ? '0 BOUND -- body shrunk' : (why || '1 face not inside slot')]++;
    }
  });
}
console.log(`\nfaces ${faces}`);
for (const k of Object.keys(tally).sort())
  console.log('  ' + k.padEnd(24) + String(tally[k]).padStart(6) + '  ' + (100 * tally[k] / (faces || 1)).toFixed(1) + '%');
