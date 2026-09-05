#!/bin/sh
# The no-feature control on the SAME split as the --feat run.
#
# The validation-video fix changed which videos land in which role, so
# the previous no-feat number (fold A 0.8504) is no longer a matched
# comparison. An A/B whose two arms differ in the named change AND in
# the split is the defect arch-arms.mjs records: "half of them were
# carrying CUT_DELTA 28 and none carried the loop-41 birth verdict".
cd /z/Apps/Disconnect
PY=/z/ml/venv/Scripts/python.exe
export TEMP=/z/ml/tmp HF_HOME=/z/ml/hf PYTHONUNBUFFERED=1
while tasklist -FI "IMAGENAME eq python.exe" 2>/dev/null | grep -qi "python.exe"; do
  sleep 30
done
echo "feat run done at $(date), starting the control"
$PY app/gaze/bench/student-train.py --width 1.0 --size 112 --input grey \
  --domain-oversample 3 --epochs 25 --feat 0 > .overnight/S-nofeat-fix.log 2>&1
grep -E "FINAL|pooled" .overnight/S-nofeat-fix.log
