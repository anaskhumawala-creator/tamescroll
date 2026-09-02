// THE ASSIGNMENT, PULLED OUT SO IT CAN BE MEASURED.
//
// E5, re-derived in his regime (spikes/gauntlet/births-hisregime.txt),
// says `birthContended` is the LARGEST class of birth in both gender
// arms -- 65 of 147 (man), 75 of 147 (woman) -- where the published
// number was 32 of 310 and the published conclusion was that geometry
// dominated. A contended birth is an observation that overlapped a live
// track well enough to match and LOST that track to another observation,
// so the subject is re-minted and loses whatever clear they had earned.
// That is FALSE COVER, and false cover is the second-biggest number on
// the corpus (139.0s, man).
//
// `updatePersonTracks` assigns greedily: sort every eligible (track,
// observation) pair by IoU descending and claim down the list. Greedy is
// not optimal, and its failure mode is exactly the one that produces a
// contended birth:
//
//     track A overlaps obs2 at 0.50 and obs1 at 0.45
//     track B overlaps obs2 at 0.48 and obs1 not at all
//
// Greedy takes A-obs2 first (0.50 is the highest number on the list),
// which leaves B with nothing and obs1 with nothing: B coasts toward
// death and obs1 is BORN, contended. The pairing A-obs1 + B-obs2 matches
// both and loses 0.02 of IoU doing it.
//
// THE OBJECTIVE IS CARDINALITY FIRST, THEN OVERLAP -- not total IoU. A
// pure max-weight matching would take a single 0.90 edge over two 0.20
// edges and make the birth count WORSE, which is the opposite of the
// thing being bought. Lexicographic order is had for free by weighting
// each eligible edge `CARD_WEIGHT + iou`: with CARD_WEIGHT far above the
// largest total IoU any frame can carry, one extra match always beats
// any redistribution of overlap.
//
// Nothing here changes what is eligible. `PTRACK_IOU_MIN` and
// `sizeCompatible` still decide which pairs exist; this only decides
// which of the surviving pairs are taken.

// One IoU is at most 1, and a frame carries at most a handful of tracks.
// 1e3 is three orders above any total this can reach.
var CARD_WEIGHT = 1e3;

// The shipped behaviour, extracted verbatim so an A/B differs in one
// function and not in a rewrite. `pairs` is claimed in the caller's own
// order after the sort, and V8's sort is stable, so a tie between two
// pairs of equal IoU resolves the way it always has -- track-major, then
// observation. Returns claims in claim order.
export function greedyAssign(pairs, nTracks, nObs) {
  var sorted = pairs.slice().sort(function (a, b) { return b.iou - a.iou; });
  var trackClaimed = new Array(nTracks).fill(false);
  var obsClaimed = new Array(nObs).fill(false);
  var out = [];
  for (var p = 0; p < sorted.length; p++) {
    var pair = sorted[p];
    if (trackClaimed[pair.t] || obsClaimed[pair.o]) continue;
    trackClaimed[pair.t] = true;
    obsClaimed[pair.o] = true;
    out.push(pair);
  }
  return out;
}

// Hungarian / Kuhn-Munkres, the O(n^3) potentials formulation, on a
// rectangular cost matrix with rows = tracks and columns = observations.
// Ineligible pairs get a cost so large that taking one is always worse
// than leaving both endpoints unmatched, and any assignment landing on
// one is dropped afterwards -- which is how a rectangular problem with
// forbidden cells is solved with a square-ish algorithm without
// inventing a match that no pair permitted.
var FORBIDDEN = 1e9;

// AN O(n^3) IN A PATH THAT RUNS PER VERDICT NEEDS A CEILING, even one it
// is not expected to reach. MoveNet emits at most six persons and the
// face fallback adds a handful, so a real frame is well under ten a side
// and costs 26 microseconds at twelve; there is nothing in the tracker
// that BOUNDS the track list, though, and an unbounded cubic on a device
// already measured as cap-limited is not a thing to leave to chance.
// Above the ceiling this falls back to the shipped greedy loop, so the
// worst case is the behaviour that has always shipped rather than a
// stall.
var OPTIMAL_MAX_SIDE = 32;

export function optimalAssign(pairs, nTracks, nObs) {
  if (!pairs.length) return [];
  if (nTracks > OPTIMAL_MAX_SIDE || nObs > OPTIMAL_MAX_SIDE)
    return greedyAssign(pairs, nTracks, nObs);
  // Cost, because the classical formulation minimises. A better pair is
  // a lower cost, and an eligible pair always beats a forbidden one.
  var n = nTracks, m = nObs;
  var M0 = nObs; // the key width, fixed before any transpose
  var cost = [];
  for (var i = 0; i < n; i++) {
    var row = new Array(m).fill(FORBIDDEN);
    cost.push(row);
  }
  var byPair = new Map();
  for (var k = 0; k < pairs.length; k++) {
    var pr = pairs[k];
    var c = -(CARD_WEIGHT + pr.iou);
    // Two pairs for the same cell cannot happen -- iou is computed once
    // per (track, obs) -- but taking the better one is the safe read.
    if (c < cost[pr.t][pr.o]) {
      cost[pr.t][pr.o] = c;
      byPair.set(pr.t * m + pr.o, pr);
    }
  }

  // e-maxx formulation: 1-indexed potentials, rows padded implicitly by
  // running only over the real rows. Requires n <= m, so the shorter side
  // drives the loop and the result is transposed back if it was columns.
  var flip = n > m;
  if (flip) {
    var t2 = [];
    for (var a = 0; a < m; a++) {
      var r2 = new Array(n);
      for (var b = 0; b < n; b++) r2[b] = cost[b][a];
      t2.push(r2);
    }
    cost = t2;
    var tmp = n; n = m; m = tmp;
  }

  var INF = Infinity;
  var u = new Array(n + 1).fill(0);
  var v = new Array(m + 1).fill(0);
  var p = new Array(m + 1).fill(0);
  var way = new Array(m + 1).fill(0);
  for (var i2 = 1; i2 <= n; i2++) {
    p[0] = i2;
    var j0 = 0;
    var minv = new Array(m + 1).fill(INF);
    var used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      var i0 = p[j0], delta = INF, j1 = 0;
      for (var j = 1; j <= m; j++) {
        if (used[j]) continue;
        var cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (var j2 = 0; j2 <= m; j2++) {
        if (used[j2]) { u[p[j2]] += delta; v[j2] -= delta; } else { minv[j2] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      var j3 = way[j0];
      p[j0] = p[j3];
      j0 = j3;
    } while (j0);
  }

  var out = [];
  for (var jj = 1; jj <= m; jj++) {
    if (!p[jj]) continue;
    var rr = p[jj] - 1, cc = jj - 1;
    var tIdx = flip ? cc : rr;
    var oIdx = flip ? rr : cc;
    var got = byPair.get(tIdx * M0 + oIdx);
    // A cell the algorithm filled because the matrix had to be complete
    // is not a pair anyone offered. Drop it rather than inventing a
    // match -- that is the whole reason FORBIDDEN is finite.
    if (got) out.push(got);
  }
  // Claim order is what the caller iterates, and a stable order keeps a
  // diff of two arms readable. Highest overlap first, as greedy leaves it.
  out.sort(function (a, b) { return b.iou - a.iou; });
  return out;
}
