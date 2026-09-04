#!/bin/bash
cd /z/Apps/Disconnect
for S in 24 32 40 48 64 96 128 192; do
  echo "=== native ${S}px ==="
  node app/gaze/bench/gpu/run.mjs --pop=fairfull --backend=webgl --arms=rgb,grey \
    --desc=1 --sizes=$S --port=8937 --out=gpu-ff-s$S 2>&1 | tail -3
done
echo "ALL SIZES DONE"
