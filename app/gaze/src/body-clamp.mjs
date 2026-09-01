// THE ADJACENCY CLAMP: stop a synthetic body patch short of a face the
// app has decided to leave sharp.
//
// WHY THIS EXISTS. `personFromFace` paints a body 7.4 face-heights wide
// for a face with no measured person behind it, and on his phone that is
// EVERY body -- MoveNet admits nobody there (loop 35/36/37, all twelve
// slots n:0). In a two-shot that width swallows the person standing
// next to the subject, so a man the pipeline correctly CLEARED is
// covered by his neighbour's patch. Measured on the banked corpus, that
// is the dominant remaining error: FALSE COVER 152.5s at his real
// verdict cadence, against EXPOSURE 3.5s.
//
// WHY NOT A BLANKET NARROWING. Scaling the body box down prices well on
// the corpus (97s -> 71.5s) and cannot ship: the corpus only holds
// labels where BlazeFace found a FACE, so it is structurally blind to
// body exposure, and the renders show a podium speaker losing her dress
// and legs at 0.70. A single scale trades the two-shot case against the
// full-body case. Adjacency does not: nothing moves unless a cleared
// face is actually inside the patch.
//
// THIS IS NOT CUTTING A HOLE. The owner has ruled twice that patches are
// SOLID and that this class of fix belongs in "better association,
// refusing a merge, tighter observation geometry". This moves ONE EDGE
// of ONE RECTANGLE. Nothing is subtracted, split, windowed or
// silhouetted.
//
// TWO REFUSALS THAT ARE LOAD BEARING, both found by LOOKING at renders
// rather than at the score:
//
//  1. A face with no descriptor signal may never push an edge. On the
//     RcGyVTAoXEU stage a projected GRAPHIC on the backdrop is detected
//     as a face, reads clear, and pulls the speaker's patch in off her
//     side. The score cannot see that harm at all -- a graphic carries
//     no label, so the strip it uncovers contains no labelled face and
//     costs zero. `nm` (the faceres descriptor magnitude before L2) is
//     the axis that separates them: p50 12.66 on reads that carry
//     signal, 2.88 on the model's prior.
//
//  2. The edge never passes the subject's OWN face. A person standing
//     directly in front of a cleared man keeps her full patch and he
//     stays covered -- the cost the owner has already accepted,
//     unchanged.

/** Normalised gap left between the patch edge and the cleared face. */
export var BODY_CLAMP_PAD = 0.02;

/**
 * Pull `body`'s left/right edge back so it stops short of each box in
 * `others`, never past `face` itself.
 *
 * HORIZONTAL ONLY. A cleared person BESIDE the subject is the measured
 * case; pulling the BOTTOM edge up would give away the torso of the
 * person the patch is for, which is the exposure direction.
 */
export function clampAway(body, face, others, pad) {
  var x1 = body.x1;
  var x2 = body.x2;
  var fcx = (face.x1 + face.x2) / 2;
  for (var i = 0; i < others.length; i++) {
    var o = others[i];
    // Only a face that actually shares this patch's vertical band can be
    // swallowed by its width. A face far above or below is not what the
    // side extension is covering.
    if (o.y2 < body.y1 || o.y1 > body.y2) continue;
    var ocx = (o.x1 + o.x2) / 2;
    if (ocx < fcx) x1 = Math.max(x1, Math.min(face.x1, o.x2 + pad));
    else x2 = Math.min(x2, Math.max(face.x2, o.x1 - pad));
  }
  if (x1 === body.x1 && x2 === body.x2) return body;
  // COPIED, never mutated. dedupeObservations was caught laundering a
  // tag by mutating a shared box in loop 37c; the same shape here would
  // hand a clamped box to a track that never asked for one.
  var out = {};
  for (var k in body) if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  out.x1 = x1;
  out.x2 = x2;
  return out;
}

/**
 * Apply the clamp across one pass's observations.
 *
 * An observation may PUSH an edge only when the pipeline decided to
 * leave it sharp AND its read carried descriptor signal. An observation
 * is CLAMPED only when its own box was extrapolated from a face
 * (`fromFace`) -- a MoveNet-measured body is a measurement, not a guess,
 * and narrowing it would be discarding evidence.
 *
 * Returns a new array; observations that do not move are passed through
 * by reference.
 */
export function clampBodies(observations, pad, mode) {
  if (!observations || observations.length < 2) return observations;
  var gap = typeof pad === 'number' ? pad : BODY_CLAMP_PAD;
  // 'cleared' (default) -- only a face the pipeline decided to leave
  // SHARP may push an edge. 'signal' -- any DETECTED face carrying
  // descriptor signal may push, whatever its verdict. The second is
  // safe only because a face that needs covering mints its OWN patch in
  // the same pass, so the strip a clamp uncovers is covered by that
  // face's own rectangle rather than by its neighbour's guess. It is
  // priced in bench/clamp-mode.mjs before it is allowed to default.
  var any = mode === 'signal';
  var pushers = [];
  for (var i = 0; i < observations.length; i++) {
    var o = observations[i];
    var ok = any ? o && o.signal === true : o && o.flagged === false && o.signal === true;
    if (ok && o.box && o.box.faceBox) {
      pushers.push({ obs: o, face: o.box.faceBox });
    }
  }
  if (!pushers.length) return observations;
  return observations.map(function (obs) {
    if (!obs || !obs.box || !obs.box.fromFace || !obs.box.faceBox) return obs;
    var others = [];
    for (var j = 0; j < pushers.length; j++) {
      if (pushers[j].obs !== obs) others.push(pushers[j].face);
    }
    if (!others.length) return obs;
    var box = clampAway(obs.box, obs.box.faceBox, others, gap);
    if (box === obs.box) return obs;
    var out = {};
    for (var k in obs) if (Object.prototype.hasOwnProperty.call(obs, k)) out[k] = obs[k];
    out.box = box;
    return out;
  });
}
