# ONE ARCHITECTURE SPEC, SHARED BY THE TRAINER AND THE EXPORTER.
#
# `student-train.py` builds it in PyTorch to train on the 3060 Ti;
# `student-export.py` builds the same shape in Keras and transports the
# weights across. Two hand-written copies of a layer stack is the
# crop-geometry defect in a new place -- a spec that drifts by one stride
# produces an export whose parity gate fails for a reason nobody can find,
# or worse, one whose gate passes on a model that is not the model that
# was trained.
#
# MobileNetV1-shaped, because it is the ONE topology the torch -> Keras ->
# tflite bridge is verified on end to end (5.96e-06 max abs delta on
# TRAINED weights, `spikes/torch-keras-bridge/`). Authoring in a shape the
# converter is known to handle is load-bearing here: every other route off
# this machine is blocked (litert-torch is Linux-only, onnx2tf needs a pip
# install and PyPI is unreachable, the local TF is CPU-only).
import torch
import torch.nn as nn


def spec(w=1.0):
    """(kind, filters, stride) per block. 'cbr' full conv, 'dw' separable.

    Filters are rounded to a multiple of 8 -- both TFLite's GPU delegate
    and the tfjs WebGL backend pack channels in fours, and an odd channel
    count costs a padded texture for nothing.
    """
    base = [('cbr', 16, 2), ('dw', 32, 2), ('dw', 64, 2), ('dw', 64, 1),
            ('dw', 128, 2), ('dw', 128, 1), ('dw', 256, 2), ('dw', 256, 1)]
    return [(k, max(8, int(round(f * w / 8)) * 8), s) for k, f, s in base]


class TFPad(nn.Module):
    """TF 'SAME' padding computed from the ACTUAL input size.

    pad_total = max((ceil(n/s) - 1) * s + k - n, 0); before = pad_total // 2.

    A FIXED (0,1,0,1) IS RIGHT ONLY FOR AN EVEN INPUT. On an odd one TF
    pads (1,1), and at 112px this net runs 112->56->28->14->7->4 -- that
    last stride-2 layer sees an ODD 7. The bridge's first parity run
    hardcoded the even rule, reported 6.4e-04 (which reads like success)
    on random weights whose outputs spanned 1e-5, and gave 3.6e-01 with
    anti-correlated outputs the moment the weights were trained.
    """

    def __init__(self, stride, k=3):
        super().__init__()
        self.s = stride
        self.k = k

    def forward(self, x):
        out = []
        for d in (3, 2):                       # width then height -> (l, r, t, b)
            n = x.shape[d]
            o = -(-n // self.s)
            tot = max((o - 1) * self.s + self.k - n, 0)
            out += [tot // 2, tot - tot // 2]
        return nn.functional.pad(x, tuple(out))


def cbr(cin, f, st):
    return nn.Sequential(TFPad(st), nn.Conv2d(cin, f, 3, st, 0, bias=False),
                         nn.BatchNorm2d(f, eps=1e-3, momentum=0.01), nn.ReLU6())


def dw(cin, f, st):
    return nn.Sequential(
        TFPad(st), nn.Conv2d(cin, cin, 3, st, 0, groups=cin, bias=False),
        nn.BatchNorm2d(cin, eps=1e-3, momentum=0.01), nn.ReLU6(),
        nn.Conv2d(cin, f, 1, 1, 0, bias=False),
        nn.BatchNorm2d(f, eps=1e-3, momentum=0.01), nn.ReLU6())


class Student(nn.Module):
    """Returns a LOGIT. The loss applies its own sigmoid (numerically
    stable); the exporter's Keras twin appends one so the shipped model
    emits a probability like faceres does."""

    def __init__(self, width=1.0):
        super().__init__()
        mods = []
        c = 3
        for kind, f, st in spec(width):
            mods.append(cbr(c, f, st) if kind == 'cbr' else dw(c, f, st))
            c = f
        self.body = nn.Sequential(*mods)
        self.head = nn.Linear(c, 1)

    def forward(self, x):
        x = self.body(x)
        x = x.mean((2, 3))
        return self.head(x)


if __name__ == '__main__':
    for w in (0.5, 1.0, 2.0):
        m = Student(w)
        n = sum(p.numel() for p in m.parameters())
        with torch.no_grad():
            y = m(torch.zeros(2, 3, 112, 112))
        print('width %.2f  params %7d  out %s' % (w, n, tuple(y.shape)))
    print('faceres ships at 3.5M params.')
