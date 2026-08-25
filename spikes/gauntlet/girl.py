"""Coverage of the CHILD's face and body -- the EXPOSURE side of the bar.

A fix that lifts blur off the cleared man is only a fix if it lifts none
off her.  Boxes read off the truth twins.
"""
import sys
from PIL import Image, ImageChops
GIRL = {
 0:(0.58,0.36,0.73,0.60), 1:(0.63,0.30,0.74,0.47), 2:(0.50,0.31,0.62,0.53),
 3:(0.55,0.30,0.64,0.46), 4:(0.58,0.29,0.68,0.47), 5:(0.57,0.30,0.68,0.48),
 6:(0.58,0.30,0.68,0.48),
}
def covered(run, i, box, thresh=8):
    a = Image.open('%s/f%03d.png' % (run, i)).convert('L')
    b = Image.open('%s/f%03d_truth.png' % (run, i)).convert('L')
    d = ImageChops.difference(a, b).point(lambda v: 255 if v > thresh else 0)
    w, h = a.size; px = d.load()
    X1, Y1, X2, Y2 = int(box[0]*w), int(box[1]*h), int(box[2]*w), int(box[3]*h)
    tot = cov = 0
    for y in range(Y1, Y2):
        for x in range(X1, X2):
            tot += 1
            if px[x, y]: cov += 1
    return 100.0*cov/max(1, tot)
for run in sys.argv[1:]:
    print(run, ' '.join('f%03d:%.0f%%' % (i, covered(run, i, GIRL[i])) for i in sorted(GIRL)))
