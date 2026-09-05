#!/bin/sh
# Bank faceres' 1024-d descriptor for every student training crop, for
# FEATURE DISTILLATION.
#
# WAITS FOR THE TRAINER, and the first version did not: it guarded with
# `pgrep`, which Git Bash does not have, so the guard fell through and
# two GPU jobs ran at once -- the banking rate collapsed to 7.4 crop/s
# against the ~75 crop/s this bench does alone. "Two GPU jobs at once"
# is already a recorded gotcha in this repo; this is the same one wearing
# a missing binary.
cd /z/Apps/Disconnect
while tasklist -FI "IMAGENAME eq python.exe" 2>/dev/null | grep -qi "python.exe"; do
  sleep 30
done
echo "trainer done at $(date), banking descriptors"
node app/gaze/bench/gpu/run.mjs --pop=student --backend=webgl --arms=grey \
  --desc=1 --out=student-desc
