"""extract_frames.py -- decode corpus frames into a 256x256 RGB numpy bank.

The app feeds MoveNet a 256x256 square built by `crop-geometry.fitBox`
(aspect-preserving, black bars), so the bank is built the same way:
scale-to-fit then pad, never squash. Frames are sampled at a fixed
interval across each corpus video so the bank spans shots rather than
sitting inside one.

Run: venv/Scripts/python extract_frames.py [everyN_seconds] [maxPerVideo]
Writes frames.npy [N,256,256,3] uint8 and frames-index.json.
"""
import json, os, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO_DIR = r"Z:\tamescroll-corpus\video"
SIZE = 256
EVERY = float(sys.argv[1]) if len(sys.argv) > 1 else 12.0
MAXPER = int(sys.argv[2]) if len(sys.argv) > 2 else 16

VF = (f"fps=1/{EVERY},scale=w={SIZE}:h={SIZE}:force_original_aspect_ratio=decrease,"
      f"pad={SIZE}:{SIZE}:(ow-iw)/2:(oh-ih)/2:color=black")

frames, index = [], []
for fn in sorted(os.listdir(VIDEO_DIR)):
    if not fn.endswith(".mp4"):
        continue
    path = os.path.join(VIDEO_DIR, fn)
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-vf", VF,
           "-frames:v", str(MAXPER), "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    n = len(raw) // (SIZE * SIZE * 3)
    if n == 0:
        print(f"  {fn}: NO FRAMES")
        continue
    arr = np.frombuffer(raw[: n * SIZE * SIZE * 3], np.uint8).reshape(n, SIZE, SIZE, 3)
    frames.append(arr)
    for i in range(n):
        index.append({"video": fn, "t": round(i * EVERY, 2)})
    print(f"  {fn}: {n} frames")

allf = np.concatenate(frames, 0)
np.save(os.path.join(HERE, "frames.npy"), allf)
json.dump(index, open(os.path.join(HERE, "frames-index.json"), "w"))
print(f"total {allf.shape}")
