// THE GREY DIAL. It lives in its own module rather than in detector.js
// because detector.js pulls in tfjs, which the node test process cannot
// load -- so a dial declared there is a dial the tuning tests cannot
// reach, and the OTA whitelist would be untestable. Every other dial
// module here exists for the same reason.
//
// GREY: feed faceres Rec.601 luma instead of colour. SHIPS AT 0 --
// nothing changes until the number is pushed, exactly the way the 1098
// dials shipped, so the switch AND the revert both travel over OTA and
// neither needs an install.
//
// MEASURED SIX INDEPENDENT WAYS (findings 39, 41, 44, 45, 47, 49):
//
//   FairFace 1,348      women 36.0% -> 30.0% wrong, z 4.16
//   his corpus 2,159    25.8% -> 19.0% wrong, z 5.56
//   the image path      junk marks 2.5-3x lower at matched protection
//   matched exposure    3.6 points of false cover; costs men 0.2% -> 1.0%
//   10,580 faces x 5 native sizes: better in ALL 35 (race x size) cells
//     and worse in NONE, and AUC -- which no threshold can move -- rises
//     at every size and by MORE as faces shrink (+0.013 at 224px,
//     +0.038 at 24px). So it is a better INPUT, not a bar shift.
//
// NOBODY HAS A MECHANISM, and every one proposed has been tested and
// refused (finding 41): tone equalisation is worse; the between-group gap
// does not move (27.3 -> 27.2); and blueOnly, which should strip tone
// best, is the WORST single channel while redOnly is the best. `invert`
// collapses women to 84.5% wrong while preserving all structure, so
// faceres reads tone and polarity rather than geometry. Ship it on the
// measurement or not at all.
//
// *** IT ALSO CHANGES THE IDENTITY MEMORY, because faceres is multi-head
// and the same pass produces the [1024] descriptor matched at MEM_SIM
// 0.6. That was finding 44's precondition on shipping and it is CLEARED
// (bench/grey-identity.mjs): false-match delta within +-0.6 points in 8
// of 9 videos, separability AUC 0.8914 -> 0.8895, memory-miss slightly
// BETTER. Read that bench's header before quoting its absolute level --
// only the rgb-vs-grey delta is interpretable there.
//
// WHAT IT DOES NOT FIX, so nobody reads the six confirmations as a
// solution: grey at 48px still reads a Black woman wrong 51.9% of the
// time (finding 49). It is the right thing to ship and it does not close
// the global gap.
export var GENDER_GREY = 1;
export function setGenderGrey(v) { GENDER_GREY = v; }
