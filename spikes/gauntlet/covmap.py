"""Coarse ASCII map of where a frame is covered (see cover.py)."""
import sys
from PIL import Image, ImageChops
run, i = sys.argv[1], int(sys.argv[2])
a = Image.open('%s/f%03d.png' % (run, i)).convert('L')
b = Image.open('%s/f%03d_truth.png' % (run, i)).convert('L')
d = ImageChops.difference(a, b).point(lambda v: 255 if v > 8 else 0)
W, H = 40, 20
s = d.resize((W, H), Image.BILINEAR).load()
print('   ' + ''.join(str((c*10//W) % 10) for c in range(W)))
for y in range(H):
    print('%2d ' % (y*100//H) + ''.join('#' if s[x, y] > 40 else ('+' if s[x, y] > 8 else '.') for x in range(W)))
