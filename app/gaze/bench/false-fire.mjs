// HOW OFTEN DOES THE DETECTOR FIRE ON SOMETHING THAT IS NOT A PERSON?
//
// HIS OLDEST AND LOUDEST COMPLAINT: "the random blur marks are pretty
// pretty annoying on random places on random thumbnails, like randomly
// just blur some text."
//
// *** THE GAP THIS CLOSES, AND IT IS NAMED IN THREE SEPARATE FINDINGS.
// Every junk-mark number this repo owns is CONDITIONAL ON DETECTION.
// bank/crops holds only crops BlazeFace already fired on, so finding 35's
// 19.1% (video) and finding 45's 7.6% (image) are shares OF DETECTIONS --
// lower bounds on a base rate nobody has measured. Finding 38 measured
// detector RECALL and says in its own words that it is "structurally
// blind to false POSITIVES", because a face was present in every frame
// it scored. So "how often does the detector hallucinate" has been open
// since this file began, and it is the half his complaint lives in.
//
// THE POPULATION: 3,809 frames, one every 4 seconds across all ten
// corpus videos, at their production 640x360 -- the resolution his player
// actually decodes (finding 37). A detection here is a detection he gets.
//
// THE ORACLE, AND ITS LIMIT STATED UP FRONT: MoveNet decides whether
// anybody is present. That is defensible only because findings 25 and 38
// established it works on a real GPU (the Adreno blindness was the WebGL
// runtime, not the model) and that its recall is not the problem. It is
// still an ORACLE, not ground truth: a person MoveNet misses reads as a
// false fire here, and that error runs in the direction that INFLATES
// this table. So this reports an UPPER BOUND, and section 5 names the
// frames to open before anybody quotes it.
//
// THE SHIPPED RULES ARE IMPORTED, NEVER RE-DERIVED (phase-g G1: an
// instrument that re-implements a shipped rule is a check that cannot
// fail, and I built three in one session). isNullRead, the nm floor, the
// clear bars and the image bar come out of gender-verdict.mjs and
// PFF_FRAME_KP_FLOOR out of person-gate.mjs, so a constant that moves
// moves this table with it.
//
//   node app/gaze/bench/false-fire.mjs
//   node app/gaze/bench/false-fire.mjs --gender=woman
import fs from 'fs';
import {
  isNullRead, NULL_MINT_NM_FLOOR, GENDER_IMAGE_MIN_SCORE,
  GENDER_CHILD_MASS, GENDER_ADULT_AGE, clearScoreFor, FACE_MIN_NATIVE_PX,
} from '../src/gender-verdict.mjs';
import { PFF_FRAME_KP_FLOOR } from '../src/person-gate.mjs';

const NL = String.fromCharCode(10);
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith('--' + k + '='));
  return h ? h.slice(k.length + 3) : d;
};
const USER = arg('gender', 'man');
const OPP = USER === 'man' ? 'female' : 'male';
const SRC = 'Z:/tamescroll-corpus/bank/' + arg('src', 'gpu-frames-detect') + '.json';
const rows = JSON.parse(fs.readFileSync(SRC, 'utf8'));
// The bar the ghost gate actually uses. Overridable so the leak finding 21
// named -- typography sits at 0.05-0.11, so 0.1 leaks about one frame in
// ten -- can be re-priced against a cost column instead of argued about.
const KPBAR = Number(arg('kp', String(PFF_FRAME_KP_FLOOR)));

// Rebuild the face record the shipped predicates expect. The bench banked
// raw/age/childP/nm off the same classifyFaceGenders call the app makes,
// so these ARE the app's numbers, not a reconstruction of them.
const rec = (f) => ({
  gender: f.g, score: f.s, raw: f.raw, age: f.age,
  childP: f.childP, shape: { norm: f.nm },
});
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '  -  ');
const q = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

console.log(NL + 'DETECTOR FALSE FIRES -- the base rate under every junk number');
console.log('  frames ' + rows.length + '   videos ' + new Set(rows.map((r) => r.vid)).size
  + '   user gender ' + USER);

// ---------------------------------------------------------- 1. base rate
let framesWithFace = 0; let dets = 0;
let noBody = 0; let noBodyDet = 0; let ghostFrames = 0;
for (const r of rows) {
  if (r.faces.length) { framesWithFace++; dets += r.faces.length; }
  if (r.nPersons === 0) {
    noBody++;
    noBodyDet += r.faces.length;
    if (r.maxKp < PFF_FRAME_KP_FLOOR) ghostFrames++;
  }
}
console.log(NL + '  1. WHAT THE TWO MODELS SEE');
console.log('     frames with >=1 face detection      ' + framesWithFace + '  (' + pct(framesWithFace, rows.length) + ')');
console.log('     face detections total               ' + dets);
console.log('     frames where MoveNet admits NOBODY  ' + noBody + '  (' + pct(noBody, rows.length) + ')');
console.log('       ...of those, carrying a detection ' + noBodyDet + ' detections');
console.log('     frames under PFF_FRAME_KP_FLOOR ' + PFF_FRAME_KP_FLOOR + '   ' + ghostFrames
  + '  (the ghost gate CAN fire only here)');

// ------------------------------------------------- 2. the suspect class
// A detection is a FALSE-FIRE CANDIDATE when it sits outside every person
// box MoveNet admitted. Two tiers, because different code refuses them:
// the frame where MoveNet admits nobody at all (the ghost gate's regime,
// finding 21) and the frame where it admits someone but not HERE.
const cand = []; const outOnly = []; const corrob = [];
for (const r of rows) {
  for (const f of r.faces) {
    const o = Object.assign({ vid: r.vid, frame: r.frame, nPersons: r.nPersons, maxKp: r.maxKp }, f);
    if (f.inP) corrob.push(o);
    // *** THE FIRST VERSION OF THIS BENCH USED `nPersons === 0` AND IT WAS
    // WRONG, in the direction that manufactures a result. Section 6 caught
    // it on the first run: the top candidates were 385-435px faces at
    // detector confidence 0.85-0.90 with frame maxKp 0.67 -- MoveNet
    // plainly saw a human shape and the person GATE refused the slot.
    // That is the CLOSE-UP regime PFF_CLOSEUP_H and the face fallback
    // exist for (a head filling the frame has too few keypoints to clear
    // PERSON_MIN_SCORE), not a hallucination. `nPersons` answers "did the
    // gate admit anybody", which is a different question.
    //
    // The SHIPPED ghost gate keys on the frame keypoint MAXIMUM against
    // PFF_FRAME_KP_FLOOR, so that is the quantity, and it is the one
    // finding 21 measured its two populations on.
    else if (r.maxKp < KPBAR) cand.push(o);
    else outOnly.push(o);
  }
}
const line = (name, a) => console.log('     ' + name.padEnd(34) + String(a.length).padStart(6)
  + '   px p50 ' + String(q(a.map((x) => x.px), 0.5)).padStart(4)
  + '   conf p50 ' + (q(a.map((x) => x.conf), 0.5) || 0).toFixed(2)
  + '   nm p50 ' + (q(a.map((x) => (x.nm == null ? 0 : x.nm)), 0.5)).toFixed(2));
console.log(NL + '  2. WHERE THE DETECTIONS LAND');
line('inside a MoveNet person', corrob);
line('outside, human shape in frame', outOnly);
line('outside, NO human shape maxKp<' + KPBAR, cand);
console.log('     -> the last row is the false-fire candidate class:');
console.log('        ' + cand.length + ' of ' + dets + ' detections = ' + pct(cand.length, dets)
  + ' of everything the detector reports');
console.log('        ' + (cand.length / rows.length).toFixed(3) + ' per sampled frame');

// ------------------------------------------ 3. what actually reaches him
// A candidate is only a MARK if the shipped rules mint a patch from it,
// and the VIDEO and IMAGE rules run in OPPOSITE directions (finding 45):
// the video path refuses a weak read, the image path PATCHES one.
function videoMints(f) {
  const r = rec(f);
  // Under the native-pixel floor the read abstains, and an abstention
  // fails CLOSED -- so it still covers. Counted as a mark.
  if (f.px < FACE_MIN_NATIVE_PX) return true;
  const adult = !(r.childP >= GENDER_CHILD_MASS) && !(r.age < GENDER_ADULT_AGE);
  if (adult && isNullRead(r) && (r.shape.norm == null || r.shape.norm < NULL_MINT_NM_FLOOR)) return false;
  if (f.g === OPP) return true;
  return !(f.s >= clearScoreFor(f.g));
}
function imageMints(f) {
  // flaggedFaceIndices: patched unless CONFIDENTLY his own gender.
  if (f.px < FACE_MIN_NATIVE_PX) return true;
  if (f.g === OPP) return true;
  return !(f.s >= GENDER_IMAGE_MIN_SCORE);
}
const vMark = cand.filter(videoMints);
const iMark = cand.filter(imageMints);
const vAll = corrob.concat(outOnly, cand).filter(videoMints);
const iAll = corrob.concat(outOnly, cand).filter(imageMints);
console.log(NL + '  3. WHICH CANDIDATES BECOME A PATCH');
console.log('     VIDEO rule (null guard + clear bar)  ' + vMark.length + ' of ' + cand.length
  + '  (' + pct(vMark.length, cand.length) + ' survive the guard)');
console.log('     IMAGE rule (a weak read IS a mark)   ' + iMark.length + ' of ' + cand.length
  + '  (' + pct(iMark.length, cand.length) + ')');
console.log(NL + '     *** THE NUMBER FINDING 35 COULD NOT PRODUCE ***');
console.log('     junk share of ALL video patches ' + vMark.length + ' / ' + vAll.length
  + ' = ' + pct(vMark.length, vAll.length));
console.log('     junk share of ALL image patches ' + iMark.length + ' / ' + iAll.length
  + ' = ' + pct(iMark.length, iAll.length));
console.log('     junk video patches per minute of playback: '
  + (vMark.length / (rows.length * 4 / 60)).toFixed(2));

// ---------------------------------- 4. what the two dials would buy here
// The nm floor is his open ruling (5 -> 5.5 over OTA, 6 needs a build).
// Finding 35 priced it on detections; this prices it on the base rate.
console.log(NL + '  4. WHAT THE nm FLOOR WOULD BUY ON THIS POPULATION');
for (const floor of [0, 5, 5.5, 6, 7]) {
  const kept = cand.filter((f) => {
    const r = rec(f);
    if (f.px < FACE_MIN_NATIVE_PX) return true;
    const adult = !(r.childP >= GENDER_CHILD_MASS) && !(r.age < GENDER_ADULT_AGE);
    if (adult && isNullRead(r) && (r.shape.norm == null || r.shape.norm < floor)) return false;
    if (f.g === OPP) return true;
    return !(f.s >= clearScoreFor(f.g));
  });
  // THE COST SIDE, AND THE OBVIOUS VERSION OF IT IS WRONG. The floor
  // refuses a BIRTH, never a refresh (loop 37b). A face sitting inside an
  // admitted person box already has a person-derived track covering it,
  // so refusing its face-derived mint costs nothing -- counting those as
  // exposure overstated the cost by 572 on the first run of this bench.
  // The floor can only uncover somebody where the FACE IS THE ONLY
  // EVIDENCE, which is the face-fallback class: outside every person box.
  const lost = outOnly.filter((f) => {
    const r = rec(f);
    if (f.px < FACE_MIN_NATIVE_PX) return false;
    const adult = !(r.childP >= GENDER_CHILD_MASS) && !(r.age < GENDER_ADULT_AGE);
    const wouldMint = f.g === OPP || !(f.s >= clearScoreFor(f.g));
    if (!wouldMint) return false;
    return adult && isNullRead(r) && (r.shape.norm == null || r.shape.norm < floor);
  });
  console.log('     floor ' + String(floor).padEnd(5) + 'junk marks ' + String(kept.length).padStart(5)
    + '   REAL people refused ' + String(lost.length).padStart(4)
    + (floor === NULL_MINT_NM_FLOOR ? '   <- SHIPPED' : ''));
}
console.log('     (a "real person refused" is a FACE-ONLY subject whose patch the');
console.log('      floor deletes -- the only case where the floor can uncover');
console.log('      anybody, because it refuses a BIRTH and never a refresh. This');
console.log('      is the column finding 35 never had.)');

// ---------------------------------------------- 7. THE CLASS THAT LEAKS
// *** THE ACTUAL FINDING, AND IT IS NOT WHAT THIS BENCH WAS BUILT TO
// LOOK FOR. The detector barely hallucinates where the ghost gate can
// SEE it: 5 of 5,451 detections. But 653 detections -- 12% of everything
// -- land OUTSIDE every admitted person box in a frame that DOES carry a
// human shape, and NO GATE IN THE PIPELINE CAN TOUCH THEM:
//
//   the ghost gate is FRAME-level, and the frame has a person in it
//   the null guard only refuses a read carrying no descriptor signal
//   the person gate never saw this box at all
//
// That is the shape of his complaint on real footage. A tech video is a
// presenter PLUS a product photo, a screen share, a thumbnail-in-a-
// thumbnail and a title card, all in one frame. The presenter holds
// maxKp high, so every graphic in the frame rides through on his
// keypoints.
//
// THIS CLASS IS NOT ALL JUNK, and that is exactly why it is the next
// round rather than a fix: a close-up the person gate refused lands here
// too (section 2 caught me treating those as hallucinations), and so
// does a second person MoveNet missed. Nobody has separated them.
console.log(NL + '  7. THE UNGATED CLASS -- outside every person box, human shape in frame');
const oMark = outOnly.filter(videoMints);
const qq = (a, f) => (q(a, 0.05) === undefined ? '-' : f(q(a, 0.05)) + ' / ' + f(q(a, 0.5)) + ' / ' + f(q(a, 0.95)));
console.log('     detections ' + outOnly.length + '  (' + pct(outOnly.length, dets) + ' of all)');
console.log('     of those, MINT a video patch ' + oMark.length
  + '  = ' + pct(oMark.length, vAll.length) + ' of every video patch');
console.log('     px    p05/p50/p95  ' + qq(oMark.map((x) => x.px), (v) => String(v)));
console.log('     conf  p05/p50/p95  ' + qq(oMark.map((x) => x.conf), (v) => v.toFixed(2)));
console.log('     nm    p05/p50/p95  ' + qq(oMark.map((x) => (x.nm == null ? 0 : x.nm)), (v) => v.toFixed(2)));
console.log('     NO GATE TOUCHES THIS CLASS. Frames to open, biggest first:');
for (const w of [...oMark].sort((a, b) => b.px - a.px).slice(0, 8)) {
  console.log('       ' + w.vid + '/' + w.frame + '  ' + String(w.px).padStart(4)
    + 'px conf ' + w.conf.toFixed(2) + ' ' + w.g + ' s' + w.s.toFixed(2)
    + ' nm' + (w.nm == null ? '-' : w.nm.toFixed(1)) + ' maxKp ' + w.maxKp
    + ' nP ' + w.nPersons);
}
console.log('     ...and smallest, which is where a graphic is most likely:');
for (const w of [...oMark].sort((a, b) => a.px - b.px).slice(0, 6)) {
  console.log('       ' + w.vid + '/' + w.frame + '  ' + String(w.px).padStart(4)
    + 'px conf ' + w.conf.toFixed(2) + ' ' + w.g + ' s' + w.s.toFixed(2)
    + ' nm' + (w.nm == null ? '-' : w.nm.toFixed(1)) + ' maxKp ' + w.maxKp
    + ' nP ' + w.nPersons);
}

// ------------------------------------- 4b. the ghost gate's own bar
// Finding 21 shipped PFF_FRAME_KP_FLOOR at 0.1, wrote down that
// typography sits at 0.05-0.11 so 0.1 leaks about one frame in ten, and
// REFUSED the critic's 0.12 -- because the nearest real case (forearms at
// a workbench, two people's hands filling the lower third) measures 0.120
// and refusing it is exposure. That argument was made on a handful of
// hand-read frames. Both columns, over 3,809:
console.log(NL + '  4b. THE GHOST-GATE BAR SWEPT (finding 21 refused 0.12 on 3 frames)');
for (const bar of [0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.3]) {
  let junk = 0;
  let lost = 0;
  for (const r of rows) {
    if (r.maxKp >= bar) continue;
    for (const f of r.faces) {
      if (!videoMints(f)) continue;
      // The gate refuses the whole frame. A refused face INSIDE a person
      // box was a real one, so that column is exposure.
      if (f.inP) lost++;
      else junk++;
    }
  }
  console.log('     bar ' + String(bar).padEnd(6)
    + 'junk marks refused ' + String(junk).padStart(4)
    + '   REAL faces refused ' + String(lost).padStart(4)
    + (bar === PFF_FRAME_KP_FLOOR ? '   <- SHIPPED' : ''));
}

// ------------------------------------------------------- 5. per video
console.log(NL + '  5. PER VIDEO -- ten videos is the unit, not 3,809 frames.');
console.log('     A single video carrying the whole rate is the shape phase-g G2');
console.log('     and finding 21a were both caught by.');
console.log('     ' + 'video'.padEnd(14) + 'frames'.padStart(7) + 'dets'.padStart(7)
  + 'cand'.padStart(7) + 'vidMark'.padStart(9) + 'imgMark'.padStart(9) + 'cand/det'.padStart(10));
for (const v of [...new Set(rows.map((r) => r.vid))].sort()) {
  const rs = rows.filter((r) => r.vid === v);
  const d = rs.reduce((a, r) => a + r.faces.length, 0);
  const c = cand.filter((x) => x.vid === v);
  console.log('     ' + v.padEnd(14) + String(rs.length).padStart(7) + String(d).padStart(7)
    + String(c.length).padStart(7) + String(c.filter(videoMints).length).padStart(9)
    + String(c.filter(imageMints).length).padStart(9) + pct(c.length, d).padStart(10));
}

// --------------------------------------------------- 6. named, for eyes
console.log(NL + '  6. THE WORST CANDIDATES -- OPEN THESE BEFORE QUOTING ANYTHING ABOVE.');
console.log('     MoveNet is an oracle, not a label. A person it missed reads as a');
console.log('     false fire, and that error INFLATES every number in this file.');
const worst = [...vMark].sort((a, b) => b.conf - a.conf).slice(0, 15);
for (const w of worst) {
  console.log('     Z:/tamescroll-corpus/frames-scan/' + w.vid + '/' + w.frame
    + '  ' + String(w.px).padStart(4) + 'px conf ' + w.conf.toFixed(2)
    + ' ' + w.g + ' s' + w.s.toFixed(2) + ' nm' + (w.nm == null ? '-' : w.nm.toFixed(1))
    + ' maxKp ' + w.maxKp);
}
console.log('');
