"""Where is a frame actually COVERED?  fNNN.png vs fNNN_truth.png.

Scoring by eye from the blurred frame alone invents failures (GOAL.md
says so twice).  This measures it: a pixel is COVERED where the blurred
frame differs from its truth twin, and the connected extent of that
difference is the patch set as the USER sees it -- overlay lerp,
stacking and all -- not as the probe reported it a few hundred ms
earlier.
"""
import sys, json
from PIL import Image, ImageChops

def cover_mask(run, i, thresh=8):
    a = Image.open('%s/f%03d.png' % (run, i)).convert('L')
    b = Image.open('%s/f%03d_truth.png' % (run, i)).convert('L')
    d = ImageChops.difference(a, b)
    return d.point(lambda v: 255 if v > thresh else 0), a.size

def report(run, i, boxes):
    m, (w, h) = cover_mask(run, i)
    px = m.load()
    for name, (x1, y1, x2, y2) in boxes.items():
        X1, Y1, X2, Y2 = int(x1*w), int(y1*h), int(x2*w), int(y2*h)
        tot = cov = 0
        for y in range(Y1, Y2, 2):
            for x in range(X1, X2, 2):
                tot += 1
                if px[x, y]: cov += 1
        print('  %-22s covered %5.1f%%  (%d px sampled)' % (name, 100.0*cov/max(1,tot), tot))

if __name__ == '__main__':
    run = sys.argv[1]
    i = int(sys.argv[2])
    boxes = json.loads(sys.argv[3])
    print('%s f%03d' % (run, i))
    report(run, i, boxes)
