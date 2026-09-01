# WHAT PRECISION DOES THE FRAGMENT SHADER ACTUALLY GET?
#
# On his phone the gender model's raw sigmoid never leaves the middle:
# male p50 0.616, MAX 0.745 over 41 reads, against a banked corpus of
# 14,996 PLAYER reads (same code path, other machines) at male p50 0.845
# with 58.7% clearing GENDER_CLEAR_SCORE. Same path, same build --
# so the variable is the device.
#
# WEBGL_RENDER_FLOAT32_ENABLED only says the RENDER TARGET is float32.
# It says nothing about the precision the arithmetic runs at. On several
# Adreno parts `highp` in a FRAGMENT shader is emulated at mediump
# (fp16, 10-bit mantissa, ~3 decimal digits), and a deep network run in
# fp16 collapses its activations toward the prior -- which is exactly
# what an age head pinned at 36.9 and a gender sigmoid pinned at 0.6
# look like.
#
# getShaderPrecisionFormat is the only honest way to ask. It draws
# nothing and reads no page content.
import sys, json
from emu_cdp import Tab, page

JS = r"""
(function(){
  var out = {};
  function probe(ctxName){
    var c = document.createElement('canvas');
    var gl = null;
    try { gl = c.getContext(ctxName); } catch(e) {}
    if (!gl) return null;
    var r = { version: gl.getParameter(gl.VERSION),
              sl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) };
    try {
      var d = gl.getExtension('WEBGL_debug_renderer_info');
      r.renderer = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null;
      r.vendor   = d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL)   : null;
    } catch(e) { r.renderer = null; }
    var kinds = { HIGH_FLOAT: gl.HIGH_FLOAT, MEDIUM_FLOAT: gl.MEDIUM_FLOAT,
                  LOW_FLOAT: gl.LOW_FLOAT, HIGH_INT: gl.HIGH_INT };
    r.frag = {}; r.vert = {};
    for (var k in kinds){
      var f = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, kinds[k]);
      var v = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, kinds[k]);
      r.frag[k] = f ? {p:f.precision, min:f.rangeMin, max:f.rangeMax} : null;
      r.vert[k] = v ? {p:v.precision, min:v.rangeMin, max:v.rangeMax} : null;
    }
    // Float texture support, both directions: can we RENDER to float32
    // and can we READ it back.
    r.ext = {};
    ['EXT_color_buffer_float','OES_texture_float','OES_texture_float_linear',
     'EXT_float_blend','WEBGL_color_buffer_float','OES_texture_half_float']
      .forEach(function(n){ r.ext[n] = !!gl.getExtension(n); });
    return r;
  }
  out.webgl2 = probe('webgl2');
  out.webgl1 = probe('webgl');
  // What tfjs itself decided, if it is loaded on this page.
  try {
    var tf = window.tf || (window.__TS_TF__);
    if (tf && tf.env) {
      out.tfFlags = {};
      ['WEBGL_VERSION','WEBGL_RENDER_FLOAT32_ENABLED','WEBGL_FORCE_F16_TEXTURES',
       'WEBGL_PACK','WEBGL_DOWNLOAD_FLOAT_ENABLED','WEBGL_MAX_TEXTURE_SIZE',
       'WEBGL_FLUSH_THRESHOLD','WEBGL_CPU_FORWARD']
        .forEach(function(f){ try { out.tfFlags[f] = tf.env().get(f); } catch(e){ out.tfFlags[f]=null; } });
    } else { out.tfFlags = null; }
  } catch(e) { out.tfFlags = 'err ' + e; }
  return JSON.stringify(out);
})()
"""

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9230
    want = sys.argv[2] if len(sys.argv) > 2 else "youtube"
    t = Tab(page(port, want))
    r = t.eval(JS)
    print(json.dumps(json.loads(r), indent=1))

main()
