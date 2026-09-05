#!/bin/sh
# THE LEVERS LEFT, in order of measured prior.
#
# Baseline to beat: --feat 1.0 --width 1.0 --size 112 --epochs 25 gave
# pooled AUC 0.9564 / false cover 50.5% against the shipped 0.9855 /
# 18.2%. Its no-feature control on the same split gave 0.8739 / 66.9%,
# so feature distillation is worth +0.083 AUC -- the largest single
# lever in this project.
#
#  1. MORE FEATURE WEIGHT. If copying faceres' representation is worth
#     0.083 at weight 1.0, weight 3.0 is the cheapest question on the
#     list and it has never been asked.
#  2. LONGER. Fold A was still climbing at epoch 20 (0.877 -> 0.905) and
#     the run stopped at 25.
#  3. WIDTH. 139,681 params against faceres' 3.5M. Even width 2.0 is
#     538k -- 6.5x smaller than what ships and ~25M MACs. Compute is not
#     the constraint here; it never was.
#  4. RESOLUTION. His faces read p50 99px native and the net sees 112.
#     128 costs 30% more MACs and nothing else.
cd /z/Apps/Disconnect
PY=/z/ml/venv/Scripts/python.exe
export TEMP=/z/ml/tmp HF_HOME=/z/ml/hf PYTHONUNBUFFERED=1
run() {
  echo ""
  echo "=== feat=$1 width=$2 size=$3 epochs=$4 ==="
  $PY app/gaze/bench/student-train.py --width $2 --size $3 --input grey \
      --domain-oversample 3 --epochs $4 --feat $1 \
      > .overnight/S-f$1-w$2-s$3-e$4.log 2>&1
  grep -E "^pooled" .overnight/S-f$1-w$2-s$3-e$4.log
}
run 3.0 1.0 112 25
run 1.0 1.0 112 45
run 1.0 2.0 112 25
run 1.0 1.0 128 25
echo ""
echo "sweep done $(date)"
