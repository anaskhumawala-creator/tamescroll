# THE LAYER STACK, IN A MODULE THAT IMPORTS NOTHING.
#
# `student_arch.py` needs torch to define its nn.Modules and
# `student-export.py`'s keras stage runs in a venv that HAS NO TORCH --
# tensorflow lives in spikes/native/venv and torch+CUDA lives in
# Z:/ml/venv, and neither has the other. Importing the spec from the
# torch module would drag torch into the TF interpreter and fail.
#
# So the spec is here, alone, and both frameworks import it. The
# alternative -- writing the stack out a second time on the Keras side --
# is the crop-geometry defect: a spec that drifts by one stride produces
# an export whose parity gate fails for a reason nobody can find, or
# worse, one whose gate passes on a model that is not the model trained.


def spec(w=1.0):
    """(kind, filters, stride) per block. 'cbr' full conv, 'dw' separable.

    Filters are rounded to a multiple of 8 -- both TFLite's GPU delegate
    and the tfjs WebGL backend pack channels in fours, and an odd channel
    count costs a padded texture for nothing.
    """
    base = [('cbr', 16, 2), ('dw', 32, 2), ('dw', 64, 2), ('dw', 64, 1),
            ('dw', 128, 2), ('dw', 128, 1), ('dw', 256, 2), ('dw', 256, 1)]
    return [(k, max(8, int(round(f * w / 8)) * 8), s) for k, f, s in base]
