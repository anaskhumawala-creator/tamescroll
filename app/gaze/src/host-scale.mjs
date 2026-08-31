// A PATCH IS MEASURED IN VIEWPORT PIXELS AND DRAWN IN THE HOST'S OWN.
//
// Both region renderers position a patch by subtracting two
// getBoundingClientRects. That delta is correct -- ancestor transforms
// cancel out of a subtraction -- but it is expressed in VIEWPORT pixels,
// and the number then written to `left`/`width` is interpreted in the
// host's LOCAL coordinate space, which the same ancestor transform
// scales again. Under a scale of s the patch is drawn at s x s.
//
// MEASURED on the miniplayer (probe_mini_patch_scale.py, 2026-08-31):
// with the player parked, host scale 0.56, the same three patches read
// normalized [0.767, 0.523, 0.233, 0.478] full and [0.429, 0.293,
// 0.131, 0.267] mini -- every one of the four numbers 0.559-0.562 of
// its full-size value. The owner's screenshot is that exactly: his face
// on the right of the parked player, the blur up and to the left of it,
// too small. That is an EXPOSURE, not a cosmetic offset.
//
// The fix belongs at the WRITE, not in the arithmetic: everything
// upstream (feather, clip bounds, mask geometry) is consistently in
// viewport units, so converting once at the end keeps them in register.

/** Sanity band for a host scale. Outside it, treat the read as junk. */
var MIN_SCALE = 0.05;
var MAX_SCALE = 20;

/**
 * The scale between a host's local coordinate space and the viewport,
 * from a rect already read for it. `offsetWidth` is the untransformed
 * border-box width, so the ratio IS the accumulated ancestor scale.
 * Returns 1 whenever it cannot be measured -- the old behaviour, and the
 * right answer for every untransformed host.
 */
export function hostScale(host, hostRect) {
  if (!host || !hostRect) return 1;
  var ow = host.offsetWidth;
  if (!(ow > 0) || !(hostRect.width > 0)) return 1;
  var s = hostRect.width / ow;
  if (!(s > MIN_SCALE) || !(s < MAX_SCALE)) return 1;
  return s;
}

/**
 * Viewport-space rect -> the host's local space. Sizes are rounded
 * because the callers hand us integers on purpose (a stable mask string
 * early-outs the ten-property mask write); offsets stay fractional so a
 * sliding patch still slides smoothly.
 */
export function toLocalRect(rect, scale) {
  if (!rect || !scale || scale === 1) return rect;
  var k = 1 / scale;
  return {
    left: rect.left * k,
    top: rect.top * k,
    width: Math.round(rect.width * k),
    height: Math.round(rect.height * k),
  };
}
