"""Coverage of the CLEARED man's face, frame by frame, before vs after.

Face boxes read off the truth twins by eye (runs/r19-man and r19c-man are
the same instants to within 0.05s).  Measured, not eyeballed, because a
patch edge two percent off a face is invisible in a screenshot and
decisive for the owner's bar.
"""
import sys
from PIL import Image, ImageChops

LINUS = {
 0:(0.19,0.10,0.36,0.42), 1:(0.43,0.10,0.55,0.35), 2:(0.33,0.18,0.47,0.52),
 3:(0.35,0.11,0.50,0.36), 4:(0.34,0.13,0.49,0.40), 5:(0.31,0.12,0.46,0.40),
 6:(0.31,0.13,0.46,0.40), 7:(0.47,0.20,0.70,0.60), 8:(0.40,0.15,0.62,0.52),
 9:(0.36,0.17,0.58,0.55),
}

def covered(run, i, box, thresh=8):
    a = Image.open('%s/f%03d.png' % (run, i)).convert('L')
    b = Image.open('%s/f%03d_truth.png' % (run, i)).convert('L')
    d = ImageChops.difference(a, b).point(lambda v: 255 if v > thresh else 0)
    w, h = a.size
    px = d.load()
    X1, Y1, X2, Y2 = int(box[0]*w), int(box[1]*h), int(box[2]*w), int(box[3]*h)
    tot = cov = 0
    for y in range(Y1, Y2):
        for x in range(X1, X2):
            tot += 1
            if px[x, y]: cov += 1
    return 100.0*cov/max(1, tot)

for run in sys.argv[1:]:
    print(run)
    for i in sorted(LINUS):
        try:
            print('  f%03d  man-face covered %5.1f%%' % (i, covered(run, i, LINUS[i])))
        except FileNotFoundError:
            pass
