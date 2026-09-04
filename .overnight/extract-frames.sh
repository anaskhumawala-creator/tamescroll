#!/bin/bash
# Frames for the DETECTOR FALSE-FIRE bench. Every 4s across all ten corpus
# videos, at their native 640x360 -- which is exactly what his player
# decodes, so no rescaling is introduced between here and production.
OUT=Z:/tamescroll-corpus/frames-scan
cd /z/tamescroll-corpus/video
for f in *.mp4; do
  v="${f%.mp4}"
  mkdir -p "$OUT/$v"
  ffmpeg -v error -i "$f" -vf fps=1/4 -pix_fmt rgb24 "$OUT/$v/f%05d.ppm" -y
  echo "$v $(ls "$OUT/$v" | wc -l) frames"
done
echo "EXTRACT DONE"
