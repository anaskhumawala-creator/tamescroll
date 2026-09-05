# MORE OF HIS OWN FOOTAGE, at the resolution his player runs.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/student-frames.py --fps 2
#
# WHY. The student trained on 103,149 images reaches AUC 0.9398 on
# held-out FairFace and 0.785 on HIS corpus. That gap is not capacity and
# it is no longer volume -- it is DOMAIN. Fold A's training set carried
# 1,190 in-domain crops out of 92,689, which is 1.3%; the rest is
# portraits. Finding 50 already measured what a FairFace-tuned head does
# on his videos, and the answer was "wins on FairFace, loses on his
# corpus".
#
# `frames-scan/` sampled ONE FRAME EVERY FOUR SECONDS -- 3,809 frames out
# of roughly 380,000 in 4.23 hours of video. At 2 fps the same ten files
# give ~30,000 frames, and Z: has 1.4 TB free.
#
# THE HONEST LIMIT, STATED BEFORE THE RUN RATHER THAN AFTER: more frames
# are not more people. His corpus is ~46 distinct identities however
# finely it is sampled, and finding 51 is the standing warning about what
# happens when a fit sees 1,024 inputs on 46 faces. What this buys is
# DOMAIN STATISTICS -- codec artefacts, motion blur, stage lighting,
# broadcast colour, the sizes his detector actually emits -- not
# diversity. If the student's corpus AUC moves and its FairFace AUC does
# not, that was the missing thing. If neither moves, the answer is a
# labelling run over real video with thousands of identities, and that is
# a project rather than an afternoon.
#
# 640x360 IS HIS PLAYER'S OWN SIZE, matching frames-scan, so a detection
# here is a detection he would get. Frames are written per video and
# DELETED after their crops are cut, so peak disk stays near one video's
# worth rather than 20 GB.
import argparse
import json
import os
import shutil
import subprocess
import time

VIDEO = 'Z:/tamescroll-corpus/video'
OUT = 'Z:/tamescroll-corpus/frames-dense'
W, H = 640, 360

ap = argparse.ArgumentParser()
ap.add_argument('--fps', type=float, default=2.0)
ap.add_argument('--max-per-video', type=int, default=6000)
ap.add_argument('--keep', action='store_true',
                help='keep the ppm frames instead of deleting after cropping')
a = ap.parse_args()

os.makedirs(OUT, exist_ok=True)
FF = shutil.which('ffmpeg') or (
    'C:/Users/zvcla/AppData/Local/Microsoft/WinGet/Packages/'
    'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/'
    'ffmpeg-8.1.2-full_build/bin/ffmpeg.exe')
print('ffmpeg %s' % FF)

# SCALE-TO-FIT AND PAD, never squash. `crop-geometry.mjs` records the
# defect this guards: the whole-frame video path once did a four-argument
# drawImage with no source rectangle, so a 640x360 stream became a square
# and every face arrived 1.78x taller than wide. A frame bank built by
# squashing would train the student on that same distortion.
VF = ('fps=%g,scale=w=%d:h=%d:force_original_aspect_ratio=decrease,'
      'pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=black' % (a.fps, W, H, W, H))

index = []
t0 = time.time()
for fn in sorted(os.listdir(VIDEO)):
    if not fn.endswith('.mp4'):
        continue
    vid = fn[:-4]
    d = os.path.join(OUT, vid)
    os.makedirs(d, exist_ok=True)
    have = len([f for f in os.listdir(d) if f.endswith('.ppm')])
    if have:
        print('%-14s %5d frames already on disk, skipping' % (vid, have))
        index += [{'vid': vid, 'frame': f} for f in sorted(os.listdir(d))
                  if f.endswith('.ppm')]
        continue
    cmd = [FF, '-v', 'error', '-i', os.path.join(VIDEO, fn), '-vf', VF,
           '-frames:v', str(a.max_per_video),
           '-pix_fmt', 'rgb24', '-f', 'image2',
           '-c:v', 'ppm', os.path.join(d, 'f%06d.ppm')]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print('%-14s FFMPEG FAILED: %s' % (vid, r.stderr.decode()[:200]))
        continue
    got = sorted(f for f in os.listdir(d) if f.endswith('.ppm'))
    index += [{'vid': vid, 'frame': f} for f in got]
    print('%-14s %5d frames  (%.0fs)' % (vid, len(got), time.time() - t0), flush=True)

json.dump(index, open(OUT + '/index.json', 'w'))
gb = sum(os.path.getsize(os.path.join(OUT, r['vid'], r['frame'])) for r in index[:50])
print('')
print('%d frames over %d videos, ~%.1f GB'
      % (len(index), len({r['vid'] for r in index}),
         gb / 50 * len(index) / 1e9))
print('  against frames-scan: 3,809 frames at 1 per 4s')
print('banked %s/index.json' % OUT)
