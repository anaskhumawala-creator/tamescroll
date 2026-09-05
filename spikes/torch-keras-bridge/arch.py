# ONE architecture spec, two frameworks. Keras is the shipping form; torch trains it on the GPU.
import numpy as np
def spec(w=1.0):
    # (kind, filters, stride)  kind: 'cbr' full conv, 'dw' depthwise-separable
    return [('cbr',16,2),('dw',32,2),('dw',64,2),('dw',64,1),('dw',128,2),('dw',128,1),('dw',256,2),('dw',256,1)]
