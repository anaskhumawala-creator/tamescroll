"""movenet_decode_port.py -- the SHAPE the Kotlin port will have, run in
numpy so its numerics can be checked before anyone writes Kotlin.

Two changes from movenet_decode.decode, both of which a scalar port wants
and both of which could in principle move a result:

  A. BOX-RESTRICTED SEARCH. Stage 4's score is zero outside the
     instance's own box (the in-box mask), so the argmax only has to scan
     the box. On this bank the boxes cover a median 22% of the frame, so
     it is the difference between 418k cells and ~90k. EXACTNESS: TF's
     ArgMax returns the LOWEST flat index among equal maxima, and every
     out-of-box cell is exactly 0. So if the in-box maximum is > 0 it is
     the global argmax; if it is <= 0 the global argmax is flat index 0.
     Reproduced literally below.

  B. SEPARABLE WEIGHT. exp(-((y-sy)^2 + (x-sx)^2)/s) factors into
     exp(-(y-sy)^2/s) * exp(-(x-sx)^2/s), which turns 418k exp() calls
     into 13k plus a multiply -- the single biggest win available to a
     CPU port, since exp() is ~20-40 cycles and a multiply is 1.
     RISK, and the reason this file exists: exp(a+b) and exp(a)*exp(b)
     differ in the last ulp, and an ulp can flip an argmax tie. Measured
     rather than assumed -- see heads_port_parity.py.

Everything else is identical to movenet_decode.py.
"""
import numpy as np

from movenet_decode import (KP_SCORE_THRESHOLD, KP_SIGMA_FRAC, MAX_INSTANCES,
                            NMS_KSIZE, NUM_KEYPOINTS, PEAK_EPS, _max_pool_same,
                            _top_k)


def decode(center, kpt_heat, kpt_regress, kpt_offset, box_scale, box_offset,
           separable=True, box_restricted=True):
    center = np.asarray(center, np.float32)[0]
    kpt_heat = np.asarray(kpt_heat, np.float32)[0]
    kpt_regress = np.asarray(kpt_regress, np.float32)[0]
    kpt_offset = np.asarray(kpt_offset, np.float32)[0]
    box_scale = np.asarray(box_scale, np.float32)[0]
    box_offset = np.asarray(box_offset, np.float32)[0]
    H, W, _ = center.shape
    K, N = NUM_KEYPOINTS, MAX_INSTANCES

    peak = np.abs(center - _max_pool_same(center, NMS_KSIZE)) < PEAK_EPS
    center_scores, flat_idx = _top_k((center * peak).reshape(-1), N)
    cy_i = flat_idx // W
    cx_i = flat_idx - cy_i * W

    hw = np.maximum(box_scale[cy_i, cx_i], 0.0)
    off = box_offset[cy_i, cx_i]
    ccy = cy_i.astype(np.float32) + off[:, 0]
    ccx = cx_i.astype(np.float32) + off[:, 1]
    ymin = np.clip(ccy - hw[:, 0] * 0.5, 0.0, float(H))
    xmin = np.clip(ccx - hw[:, 1] * 0.5, 0.0, float(W))
    ymax = np.clip(ccy + hw[:, 0] * 0.5, 0.0, float(H))
    xmax = np.clip(ccx + hw[:, 1] * 0.5, 0.0, float(W))
    boxes = np.clip(np.stack([ymin / H, xmin / W, ymax / H, xmax / W], 1), 0, 1).astype(np.float32)

    reg = kpt_regress[cy_i, cx_i].reshape(N, K, 2)
    seed_y = cy_i.astype(np.float32)[:, None] + reg[:, :, 0]
    seed_x = cx_i.astype(np.float32)[:, None] + reg[:, :, 1]

    sigma = np.float32(float(min(H, W)) * KP_SIGMA_FRAC)
    ys = np.arange(H, dtype=np.float32)
    xs = np.arange(W, dtype=np.float32)

    # the "instance-max" score plane the graph gathers from, built the
    # same way but only over the rows/cols any instance can reach.
    inst_max = np.zeros((H, W, K), np.float32)
    best_flat = np.zeros(N * K, np.int64)
    per_inst = []
    for n in range(N):
        y0 = int(np.ceil(ymin[n]))                       # gy >= ymin
        y1 = int(np.ceil(ymax[n]))                       # gy <  ymax
        x0 = int(np.ceil(xmin[n]))
        x1 = int(np.ceil(xmax[n]))
        y0, y1 = max(y0, 0), min(y1, H)
        x0, x1 = max(x0, 0), min(x1, W)
        if y1 <= y0 or x1 <= x0:
            per_inst.append(None)
            continue
        dy = ys[y0:y1, None] - seed_y[n][None, :]        # [h,K]
        dx = xs[x0:x1, None] - seed_x[n][None, :]        # [w,K]
        if separable:
            wy = np.exp(-(dy * dy) / sigma)
            wx = np.exp(-(dx * dx) / sigma)
            wgt = wy[:, None, :] * wx[None, :, :]        # [h,w,K]
        else:
            wgt = np.exp(-((dy * dy)[:, None, :] + (dx * dx)[None, :, :]) / sigma)
        sc = kpt_heat[y0:y1, x0:x1, :] * wgt              # [h,w,K]
        per_inst.append((y0, y1, x0, x1, sc))
        np.maximum(inst_max[y0:y1, x0:x1, :], sc, out=inst_max[y0:y1, x0:x1, :])
        # ArgMax semantics: lowest flat index among equal maxima, and every
        # cell outside the box is 0, so a non-positive in-box maximum means
        # the global argmax is flat index 0.
        flat = sc.reshape(-1, K)
        loc = np.argmax(flat, 0)
        val = flat[loc, np.arange(K)]
        by = y0 + loc // (x1 - x0)
        bx = x0 + loc % (x1 - x0)
        gflat = np.where(val > 0, by * W + bx, 0)
        best_flat[n * K:(n + 1) * K] = gflat
    if not box_restricted:
        raise NotImplementedError("box_restricted=False is movenet_decode.decode")
    for n in range(N):
        if per_inst[n] is None:
            best_flat[n * K:(n + 1) * K] = 0

    by = (best_flat // W).astype(np.int64)
    bx = (best_flat - by * W).astype(np.int64)
    kidx = np.tile(np.arange(K), N)
    ko = kpt_offset.reshape(H, W, K, 2)[by, bx, kidx]
    kp_y = (by.astype(np.float32) + ko[:, 0]).reshape(N, K) / H
    kp_x = (bx.astype(np.float32) + ko[:, 1]).reshape(N, K) / W
    kp_score = inst_max[by, bx, kidx].reshape(N, K)

    above = kp_score > KP_SCORE_THRESHOLD
    n_valid = np.maximum(above.sum(1).astype(np.float32), 1.0)
    inst_score = center_scores * (np.where(above, kp_score, 0.0).sum(1) / n_valid)

    out = np.empty((1, N, 56), np.float32)
    out[0, :, 0:51:3] = kp_y
    out[0, :, 1:51:3] = kp_x
    out[0, :, 2:51:3] = kp_score
    out[0, :, 51:55] = boxes
    out[0, :, 55] = inst_score
    return out
