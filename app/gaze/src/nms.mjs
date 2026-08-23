// Greedy non-max suppression over flat box/score arrays, in plain JS.
//
// Why not tf.image.nonMaxSuppressionAsync: on the webgl backend it
// downloads boxes AND scores internally, then detectFaceBoxes downloaded
// them again for the decode — 3+ GPU->CPU round trips per frame. Each
// round trip is a fence wait (worst case a full second when the page is
// hidden and Chrome clamps nested timers — found 2026-08-23). 896
// candidates is trivial CPU work, so one combined download + this
// function replaces all of it.

/**
 * boxes: flat Float32Array-like, [x1,y1,x2,y2] per row.
 * scores: parallel array, one score per row.
 * Returns kept row indices, highest score first.
 */
export function nonMaxSuppression(boxes, scores, maxOutput, iouThreshold, scoreThreshold) {
  var order = [];
  for (var i = 0; i < scores.length; i++) {
    if (scores[i] >= scoreThreshold) order.push(i);
  }
  order.sort(function (a, b) {
    return scores[b] - scores[a];
  });
  var kept = [];
  for (var o = 0; o < order.length && kept.length < maxOutput; o++) {
    var idx = order[o];
    var suppressed = false;
    for (var k = 0; k < kept.length; k++) {
      if (iou(boxes, idx, kept[k]) > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(idx);
  }
  return kept;
}

function iou(boxes, a, b) {
  var ax1 = boxes[a * 4], ay1 = boxes[a * 4 + 1], ax2 = boxes[a * 4 + 2], ay2 = boxes[a * 4 + 3];
  var bx1 = boxes[b * 4], by1 = boxes[b * 4 + 1], bx2 = boxes[b * 4 + 2], by2 = boxes[b * 4 + 3];
  var areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  var areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
  if (areaA <= 0 || areaB <= 0) return 0;
  var ix = Math.min(ax2, bx2) - Math.max(ax1, bx1);
  var iy = Math.min(ay2, by2) - Math.max(ay1, by1);
  var inter = Math.max(0, ix) * Math.max(0, iy);
  return inter / (areaA + areaB - inter);
}
