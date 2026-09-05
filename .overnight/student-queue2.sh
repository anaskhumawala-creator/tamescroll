#!/bin/sh
# Waits for the FairFace train extraction, then sweeps the student.
# ORDER IS BY WHAT THE FIRST TWO RUNS SAID IS UNKNOWN, not by what is
# cheapest: the failure was capacity-or-data, and only more data plus a
# stopping rule can tell those apart. So the first arm is the SAME
# configuration that scored 0.657 -- if it does not move with 6x the
# data, the answer is not data.
cd /z/Apps/Disconnect
PY=/z/ml/venv/Scripts/python.exe
export TEMP=/z/ml/tmp HF_HOME=/z/ml/hf PYTHONUNBUFFERED=1
until grep -qE "banked|Traceback" .overnight/fftrain.log 2>/dev/null; do sleep 20; done
grep -q banked .overnight/fftrain.log || { echo "extraction failed"; exit 1; }
echo "extraction done $(date)"
for cfg in "1.0 112 4" "2.0 112 4" "2.0 128 4" "1.0 112 1"; do
  set -- $cfg
  echo ""
  echo "=== width $1  size $2  oversample $3 ==="
  $PY app/gaze/bench/student-train.py --width $1 --size $2 --input grey \
      --domain-oversample $3 --epochs 25 \
      > .overnight/student-w$1-s$2-ov$3.log 2>&1
  grep -E "BASELINE|gate|best validation|FINAL|pooled" .overnight/student-w$1-s$2-ov$3.log
done
echo "queue done $(date)"
