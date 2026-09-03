"""movenet_decode.py -- the CenterNet decode tail of MoveNet MultiPose
Lightning, in numpy, from the six conv heads.

WHY. On the TFLite GPU delegate the shipped single-graph model runs 112
of 237 nodes on the GPU in TWO partitions (spikes/native/GPU-REPORT.md):
this tail -- TopKV2, GatherNd, ArgMax, Range, Select -- has no GPU
kernels, so it executes on the CPU sandwiched between two delegate
boundaries and costs ~120ms of a 160ms pass. `out/movenet-heads.tflite`
(convert.py `movenet-heads`) stops at the heads and is 101 ops of
conv / depthwise / add / resize / logistic, which the delegate takes
whole; this module reproduces the tail so the [1,6,56] the page reads
does not change.

DERIVED FROM THE GRAPH, NOT FROM A PAPER. Every constant below was read
out of `stage/movenet-multipose/movenet-multipose.json` (the tail is the
324 nodes downstream of the six heads; `graph_dump2.py` prints them).
Where the graph disagrees with the published reference, THE GRAPH WINS
and the disagreement is noted -- there are two, both flagged inline
(a 5x5 NMS window, and an instance-max score gather).

The structure mirrors TensorFlow Models' CenterNet meta-architecture
(Apache-2.0, object_detection/meta_architectures/center_net_meta_arch.py):
`top_k_feature_map_locations` for step 1, `prediction_tensors_to_boxes`
for step 2, and the MoveNet multi-instance path
`prediction_tensors_to_multi_instance_kpts` /
`_process_keypoints_for_multi_instance` (candidate search with the
regression-distance weighting and an in-box mask) for steps 3-5. Read
for structure only; written from the graph, nothing copied.

OUTPUT LAYOUT, confirmed against the shipped consumer
(app/gaze/src/person-gate.mjs `parsePersons`, which reads
`data[o + k*3]`, `+1`, `+2` for keypoint k, `o+51..54` for the box and
`o+55` for the score):

    [1, 6, 56] = per instance:
      0 .. 50   17 x (y, x, score)   keypoints, y/x normalized 0..1
      51 .. 54  ymin, xmin, ymax, xmax   normalized 0..1
      55        instance score
"""
import numpy as np

# ---- constants, all read out of the graph -------------------------------

# StatefulPartitionedCall/MaxPool, ksize [1,5,5,1], padding SAME. The task
# brief said 3x3; the graph says 5. Reference CenterNet defaults to 3, so
# this model was exported with a wider NMS window -- 5 is what ships.
NMS_KSIZE = 5
# StatefulPartitionedCall/Less/y. A location survives NMS when
# |center - maxpool(center)| < this, i.e. it IS its own window maximum.
# The odd value is the f16 quantization of 1e-6 in the shipped weights.
PEAK_EPS = 1.013279e-06
# StatefulPartitionedCall/TopKV2/k -- MoveNet MultiPose emits 6 instances.
MAX_INSTANCES = 6
NUM_KEYPOINTS = 17
# StatefulPartitionedCall/mul_6/y. The candidate-search weight is
# exp(-d^2 / (KP_SIGMA_FRAC * min(H, W))) with d in stride-4 grid units:
# at H=W=64 the denominator is 19.2, so a candidate 4 grid cells (16px)
# from the regressed seed keeps exp(-16/19.2) = 0.43 of its heat.
# f16 quantization of 0.3.
KP_SIGMA_FRAC = 0.300049
# StatefulPartitionedCall/Greater_1/y. A keypoint below this scores 0 in
# the instance-score mean AND is excluded from its denominator -- but its
# raw score is still what lands in the output tensor (the graph feeds
# ExpandDims_6 from the UNthresholded Reshape_20, not from Select).
# f16 quantization of 0.127.
KP_SCORE_THRESHOLD = 0.126953


def _max_pool_same(x, k):
    """MaxPool2D, ksize k, stride 1, SAME padding, on [H, W, C]."""
    pad_before = (k - 1) // 2
    pad_after = k - 1 - pad_before
    p = np.pad(x, ((pad_before, pad_after), (pad_before, pad_after), (0, 0)),
               mode="constant", constant_values=-np.inf)
    h, w, c = x.shape
    # sliding_window_view is a view: no copy of the k*k expansion.
    win = np.lib.stride_tricks.sliding_window_view(p, (k, k), axis=(0, 1))
    return win.reshape(h, w, c, k * k).max(-1)


def _top_k(values, k):
    """TF TopKV2(sorted=True) on a 1-D array: descending by value, and on
    a tie the LOWER index first. np.argsort(kind='stable') on the negated
    values gives exactly that; argpartition would not."""
    order = np.argsort(-values, kind="stable")[:k]
    return values[order], order


def decode(center, kpt_heat, kpt_regress, kpt_offset, box_scale, box_offset):
    """The six heads -> [1, 6, 56], identical to the full model's output.

    Shapes as TFLite delivers them (NHWC float32, batch 1):
      center      [1, H, W, 1]     sigmoid, person-centre heatmap
      kpt_heat    [1, H, W, 17]    sigmoid, per-keypoint heatmap
      kpt_regress [1, H, W, 34]    (dy, dx) per keypoint from the centre
      kpt_offset  [1, H, W, 34]    (dy, dx) sub-cell refinement per keypoint
      box_scale   [1, H, W, 2]     (height, width) in stride-4 grid units
      box_offset  [1, H, W, 2]     (dy, dx) of the true centre in the cell
    H = W = 64 for the shipped 256x256 input (output stride 4).
    """
    center = np.asarray(center, np.float32)[0]        # [H, W, 1]
    kpt_heat = np.asarray(kpt_heat, np.float32)[0]    # [H, W, K]
    kpt_regress = np.asarray(kpt_regress, np.float32)[0]
    kpt_offset = np.asarray(kpt_offset, np.float32)[0]
    box_scale = np.asarray(box_scale, np.float32)[0]
    box_offset = np.asarray(box_offset, np.float32)[0]
    H, W, _ = center.shape
    K = NUM_KEYPOINTS
    N = MAX_INSTANCES

    # --- 1. instance centres: local-max NMS then top-k --------------------
    # graph: MaxPool -> sub_2 -> Abs -> Less -> Cast_1 -> mul_2 -> Reshape_2
    #        -> TopKV2. Note this SUPPRESSES by zeroing rather than by
    # masking, so a genuine peak of exactly 0 and a suppressed cell are
    # indistinguishable -- which is why ties must break on index.
    peak = (np.abs(center - _max_pool_same(center, NMS_KSIZE)) < PEAK_EPS)
    suppressed = center * peak.astype(np.float32)
    center_scores, flat_idx = _top_k(suppressed.reshape(-1), N)   # [N]
    # flat index over [H, W, C] with C == 1; the graph divides by C first
    # (floordiv/y = 1) and takes the remainder as the class channel.
    cy_i = flat_idx // W                                          # [N] int
    cx_i = flat_idx - cy_i * W                                    # [N] int

    # --- 2. boxes ---------------------------------------------------------
    # graph: GatherNd(box_scale) -> Maximum(.,0) -> +-half; GatherNd(box_offset)
    #        added to the integer cell; clip to [0,H]/[0,W]; *4 / imgSize.
    hw = np.maximum(box_scale[cy_i, cx_i], 0.0)                   # [N,2] h,w
    off = box_offset[cy_i, cx_i]                                  # [N,2] dy,dx
    ccy = cy_i.astype(np.float32) + off[:, 0]
    ccx = cx_i.astype(np.float32) + off[:, 1]
    ymin = np.clip(ccy - hw[:, 0] * 0.5, 0.0, float(H))
    xmin = np.clip(ccx - hw[:, 1] * 0.5, 0.0, float(W))
    ymax = np.clip(ccy + hw[:, 0] * 0.5, 0.0, float(H))
    xmax = np.clip(ccx + hw[:, 1] * 0.5, 0.0, float(W))
    # The graph scales by 4 then divides by the 256px input, which is the
    # same as dividing by H/W -- kept explicit so a non-square input would
    # still be right.
    boxes = np.stack([ymin / H, xmin / W, ymax / H, xmax / W], 1)  # [N,4]
    boxes = np.clip(boxes, 0.0, 1.0).astype(np.float32)

    # --- 3. keypoint seeds from the regression head -----------------------
    reg = kpt_regress[cy_i, cx_i].reshape(N, K, 2)                # [N,K,2]
    seed_y = cy_i.astype(np.float32)[:, None] + reg[:, :, 0]      # [N,K]
    seed_x = cx_i.astype(np.float32)[:, None] + reg[:, :, 1]

    # --- 4. candidate search on the keypoint heatmap ----------------------
    # score(y,x,n,k) = heat(y,x,k)
    #                  * exp(-((y-seed_y[n,k])^2 + (x-seed_x[n,k])^2)
    #                        / (0.3 * min(H,W)))
    #                  * inBox(y,x,n)
    # then argmax over (y,x) per (n,k). Cost is the H*W*N*K tensor: at
    # 64*64*6*17 that is 417,792 floats -- the whole reason this is worth
    # doing in one vectorised pass.
    ys = np.arange(H, dtype=np.float32)[:, None, None, None]       # [H,1,1,1]
    xs = np.arange(W, dtype=np.float32)[None, :, None, None]       # [1,W,1,1]
    d2 = ((ys - seed_y[None, None, :, :]) ** 2
          + (xs - seed_x[None, None, :, :]) ** 2)                  # [H,W,N,K]
    weight = np.exp(-d2 / (float(min(H, W)) * KP_SIGMA_FRAC))
    # in-box mask, half-open on the max edge exactly as the graph does
    # (GreaterEqual on min, Less on max) -- and against the CLIPPED,
    # grid-unit box, not the normalized one.
    gy = np.arange(H, dtype=np.float32)[:, None, None]             # [H,1,1]
    gx = np.arange(W, dtype=np.float32)[None, :, None]             # [1,W,1]
    inbox = ((gy >= ymin[None, None, :]) & (gy < ymax[None, None, :])
             & (gx >= xmin[None, None, :]) & (gx < xmax[None, None, :]))
    scored = kpt_heat[:, :, None, :] * weight * inbox[:, :, :, None].astype(np.float32)

    flat = scored.reshape(H * W, N * K)
    best = np.argmax(flat, 0)                                      # [N*K]
    by = best // W
    bx = best - by * W

    # --- 5. sub-cell offset, and the score ---------------------------------
    kidx = np.tile(np.arange(K), N)                                # [N*K]
    ko = kpt_offset.reshape(H, W, K, 2)[by, bx, kidx]              # [N*K,2]
    kp_y = (by.astype(np.float32) + ko[:, 0]).reshape(N, K) / H
    kp_x = (bx.astype(np.float32) + ko[:, 1]).reshape(N, K) / W

    # THE GRAPH GATHERS FROM THE INSTANCE-MAX, NOT FROM THE INSTANCE.
    # `Max` reduces `mul_9` over the INSTANCE axis before GatherNd_4, so a
    # keypoint's reported score is max over all 6 instances of
    # (heat * weight * inbox) at ITS chosen cell -- which can exceed this
    # instance's own value when a neighbouring instance's seed sits closer
    # to that cell. It reads like an upstream bug; it is what the shipped
    # model does, and reproducing it is the whole point.
    inst_max = scored.max(2)                                       # [H,W,K]
    kp_score = inst_max[by, bx, kidx].reshape(N, K)

    # --- 6. instance score --------------------------------------------------
    # center_score * mean over keypoints ABOVE threshold of their score.
    # Denominator is max(count, 1); a slot with no keypoint over the bar
    # scores 0 rather than dividing by zero.
    above = kp_score > KP_SCORE_THRESHOLD
    n_valid = np.maximum(above.sum(1).astype(np.float32), 1.0)
    inst_score = center_scores * (np.where(above, kp_score, 0.0).sum(1) / n_valid)

    out = np.empty((1, N, 56), np.float32)
    out[0, :, 0:51:3] = kp_y
    out[0, :, 1:51:3] = kp_x
    # the UNthresholded score is what reaches the tensor -- see the
    # KP_SCORE_THRESHOLD note above.
    out[0, :, 2:51:3] = kp_score
    out[0, :, 51:55] = boxes
    out[0, :, 55] = inst_score
    return out
