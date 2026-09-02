"""Native inference, Task 3b: WHERE does the input diverge between engines?

    python probe_native_pixels.py <cdpPort> [t1,t2,...]

Page-only (no engine involved). On the current watch page, per timestamp:
  A. the same ImageBitmap of the paused frame read back two ways --
     canvas-2D getImageData (what native-client feeds Kotlin) and WebGL
     texImage2D + readPixels (what tf.browser.fromPixels does in the
     worker) -- per-channel mean abs diff and mean level. A constant
     offset/gain here is a COLOUR/RANGE conversion difference.
  B. the 256x256 MoveNet frame built two ways from the SAME full-res
     pixels: canvas drawImage squash (native-client drawTo) versus a JS
     re-implementation of tf.image.resizeBilinear (alignCorners false,
     halfPixelCenters false: src = dst * (in/out), 4-tap) -- mean abs
     diff and the diff of a mipmap-averaged (box) downscale, to say which
     the canvas is closer to.
  C. a 224 gender crop of a synthetic centred square box built two ways
     from the same full-res pixels: canvas drawImage source-rect versus a
     JS re-implementation of tf.image.cropAndResize (corner-aligned:
     src = y1*(H-1) + i*(y2-y1)*(H-1)/(out-1)).
Banks native-pixels-<ts>.json. Nothing renders on the owner's desktop.
"""
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
TS = [float(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [60, 217, 300, 420]

JS = r"""(function(){ return (async function(){
  var v = document.querySelector('video'); if (!v) return {err:'no video'};
  var W = v.videoWidth, H = v.videoHeight;
  var bmp = await createImageBitmap(v);
  function stats(a, b, n) { var s=[0,0,0], la=[0,0,0], lb=[0,0,0], mx=0; for (var i=0;i<n;i++){ for (var c=0;c<3;c++){ var d=Math.abs(a[i*4+c]-b[i*4+c]); s[c]+=d; la[c]+=a[i*4+c]; lb[c]+=b[i*4+c]; if(d>mx)mx=d; } } return {mad:[s[0]/n,s[1]/n,s[2]/n], levelA:[la[0]/n,la[1]/n,la[2]/n], levelB:[lb[0]/n,lb[1]/n,lb[2]/n], max:mx}; }
  // A: canvas-2D full-res
  var c = document.createElement('canvas'); c.width=W; c.height=H; var cx = c.getContext('2d'); cx.drawImage(bmp,0,0); var A = cx.getImageData(0,0,W,H).data;
  // A': WebGL readback of the same bitmap
  var g = document.createElement('canvas'); g.width=W; g.height=H; var gl = g.getContext('webgl', {premultipliedAlpha:false, preserveDrawingBuffer:true});
  var B = null, glErr = null;
  try {
    var vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, 'attribute vec2 p; varying vec2 t; void main(){ t = vec2((p.x+1.0)/2.0, (1.0-p.y)/2.0); gl_Position = vec4(p,0,1);}'); gl.compileShader(vs);
    var fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, 'precision mediump float; varying vec2 t; uniform sampler2D s; void main(){ gl_FragColor = texture2D(s, t); }'); gl.compileShader(fs);
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.viewport(0,0,W,H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    var px = new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
    // readPixels is bottom-up; flip rows
    B = new Uint8ClampedArray(W*H*4); for (var y=0;y<H;y++){ B.set(px.subarray((H-1-y)*W*4, (H-y)*W*4), y*W*4); }
  } catch (e) { glErr = String(e && e.message || e); }
  var out = {t: v.currentTime, W:W, H:H, glErr: glErr};
  if (B) out.A_vs_webgl = stats(A, B, W*H);
  // B: 256 squash
  var N = 256;
  var d = document.createElement('canvas'); d.width=N; d.height=N; var dx = d.getContext('2d'); dx.drawImage(bmp,0,0,N,N); var C1 = dx.getImageData(0,0,N,N).data;
  function tfResize(src, sw, sh, ow, oh) { var o = new Uint8ClampedArray(ow*oh*4); var sx = sw/ow, sy = sh/oh; for (var y=0;y<oh;y++){ var fy=y*sy; var y0=Math.floor(fy); var y1=Math.min(y0+1, sh-1); var wy=fy-y0; for (var x=0;x<ow;x++){ var fx=x*sx; var x0=Math.floor(fx); var x1=Math.min(x0+1, sw-1); var wx=fx-x0; for (var ch=0;ch<4;ch++){ var tl=src[(y0*sw+x0)*4+ch], tr=src[(y0*sw+x1)*4+ch], bl=src[(y1*sw+x0)*4+ch], br=src[(y1*sw+x1)*4+ch]; o[(y*ow+x)*4+ch] = tl*(1-wx)*(1-wy)+tr*wx*(1-wy)+bl*(1-wx)*wy+br*wx*wy; } } } return o; }
  function boxResize(src, sw, sh, ow, oh) { var o = new Uint8ClampedArray(ow*oh*4); for (var y=0;y<oh;y++){ var ya=Math.floor(y*sh/oh), yb=Math.max(ya+1, Math.floor((y+1)*sh/oh)); for (var x=0;x<ow;x++){ var xa=Math.floor(x*sw/ow), xb=Math.max(xa+1, Math.floor((x+1)*sw/ow)); var s=[0,0,0,0], n=0; for (var yy=ya;yy<yb;yy++) for (var xx=xa;xx<xb;xx++){ for (var ch=0;ch<4;ch++) s[ch]+=src[(yy*sw+xx)*4+ch]; n++; } for (var ch2=0;ch2<4;ch2++) o[(y*ow+x)*4+ch2]=s[ch2]/n; } } return o; }
  var C2 = tfResize(A, W, H, N, N); var C3 = boxResize(A, W, H, N, N);
  out.squash_canvas_vs_tfBilinear = stats(C1, C2, N*N);
  // D: which canvas recipe lands closest to tf.image.resizeBilinear?
  out.recipes = {};
  function viaCtx(setup, draw) { var k = document.createElement('canvas'); k.width=N; k.height=N; var kx = k.getContext('2d'); setup(kx); draw(kx); return kx.getImageData(0,0,N,N).data; }
  var sxs = W/N, sys = H/N;
  var recipes = {
    smoothLow: function(){ return viaCtx(function(kx){ kx.imageSmoothingEnabled=true; kx.imageSmoothingQuality='low'; }, function(kx){ kx.drawImage(bmp,0,0,N,N); }); },
    smoothMedium: function(){ return viaCtx(function(kx){ kx.imageSmoothingEnabled=true; kx.imageSmoothingQuality='medium'; }, function(kx){ kx.drawImage(bmp,0,0,N,N); }); },
    smoothHigh: function(){ return viaCtx(function(kx){ kx.imageSmoothingEnabled=true; kx.imageSmoothingQuality='high'; }, function(kx){ kx.drawImage(bmp,0,0,N,N); }); },
    nearest: function(){ return viaCtx(function(kx){ kx.imageSmoothingEnabled=false; }, function(kx){ kx.drawImage(bmp,0,0,N,N); }); },
    lowShifted: function(){ return viaCtx(function(kx){ kx.imageSmoothingEnabled=true; kx.imageSmoothingQuality='low'; }, function(kx){ kx.drawImage(bmp, -(sxs-1)/2, -(sys-1)/2, W, H, 0, 0, N, N); }); },
    nearestShifted: function(){ return viaCtx(function(kx){ kx.imageSmoothingEnabled=false; }, function(kx){ kx.drawImage(bmp, -(sxs-1)/2, -(sys-1)/2, W, H, 0, 0, N, N); }); }
  };
  for (var rk in recipes) { try { out.recipes[rk] = stats(recipes[rk](), C2, N*N).mad.map(function(x){return Math.round(x*100)/100;}); } catch (e3) { out.recipes[rk] = 'ERR ' + (e3 && e3.message); } }
  var ibq = ['pixelated','low','medium','high'];
  for (var qi = 0; qi < ibq.length; qi++) { try { var rb = await createImageBitmap(bmp, {resizeWidth:N, resizeHeight:N, resizeQuality: ibq[qi]}); var px2 = viaCtx(function(){}, function(kx){ kx.drawImage(rb,0,0); }); rb.close(); out.recipes['imageBitmap_'+ibq[qi]] = stats(px2, C2, N*N).mad.map(function(x){return Math.round(x*100)/100;}); } catch (e4) { out.recipes['imageBitmap_'+ibq[qi]] = 'ERR ' + (e4 && e4.message); } }
  // and a JS tf-bilinear straight from the full-res pixels, timed
  var tj0 = performance.now(); tfResize(A, W, H, N, N); out.jsTfResizeMs = Math.round((performance.now()-tj0)*10)/10;
  var tg0 = performance.now(); cx.getImageData(0,0,W,H); out.fullResGetImageDataMs = Math.round((performance.now()-tg0)*10)/10;
  out.squash_canvas_vs_box = stats(C1, C3, N*N);
  out.squash_tfBilinear_vs_box = stats(C2, C3, N*N);
  // C: gender crop of a centred square, side = 0.12 of height (a ~86px face at 720p)
  var G = 224; var side = Math.round(H*0.12); var sx0 = Math.round(W/2 - side/2), sy0 = Math.round(H/2 - side/2);
  var e = document.createElement('canvas'); e.width=G; e.height=G; var ex = e.getContext('2d'); ex.drawImage(bmp, sx0, sy0, side, side, 0, 0, G, G); var D1 = ex.getImageData(0,0,G,G).data;
  function tfCropResize(src, sw, sh, x1, y1, x2, y2, ow, oh) { var o = new Uint8ClampedArray(ow*oh*4); var hs = (y2-y1)*(sh-1)/(oh-1), ws = (x2-x1)*(sw-1)/(ow-1); for (var y=0;y<oh;y++){ var fy = y1*(sh-1) + y*hs; var y0=Math.floor(fy), yy1=Math.min(y0+1, sh-1), wy=fy-y0; for (var x=0;x<ow;x++){ var fx = x1*(sw-1) + x*ws; var x0=Math.floor(fx), xx1=Math.min(x0+1, sw-1), wx=fx-x0; for (var ch=0;ch<4;ch++){ var tl=src[(y0*sw+x0)*4+ch], tr=src[(y0*sw+xx1)*4+ch], bl=src[(yy1*sw+x0)*4+ch], br=src[(yy1*sw+xx1)*4+ch]; o[(y*ow+x)*4+ch] = tl*(1-wx)*(1-wy)+tr*wx*(1-wy)+bl*(1-wx)*wy+br*wx*wy; } } } return o; }
  var D2 = tfCropResize(A, W, H, sx0/W, sy0/H, (sx0+side)/W, (sy0+side)/H, G, G);
  out.crop_canvas_vs_tfCropAndResize = stats(D1, D2, G*G);
  if (B) { var D3 = tfCropResize(B, W, H, sx0/W, sy0/H, (sx0+side)/W, (sy0+side)/H, G, G); out.crop_tfFromCanvasPixels_vs_tfFromWebglPixels = stats(D2, D3, G*G); }
  try { bmp.close(); } catch (e2) {}
  return out;
})().then(function(r){return JSON.stringify(r);}, function(e){return JSON.stringify({err:String(e&&e.message||e)});}); })()"""


def main():
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    rows = []
    for target in TS:
        t.eval("(function(){var v=document.querySelector('video'); if(v){v.pause(); v.currentTime=%f;} return 1;})()" % target)
        time.sleep(2.5)
        r = t.cmd("Runtime.evaluate", expression=JS, awaitPromise=True, returnByValue=True, timeout=60000)
        val = ((r.get("result") or {}).get("result") or {}).get("value")
        row = json.loads(val) if isinstance(val, str) else {"err": "no value"}
        row["target"] = target
        rows.append(row)
        print(json.dumps({k: row.get(k) for k in ("target", "recipes", "jsTfResizeMs", "fullResGetImageDataMs", "err")}))
    name = "native-pixels-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump(rows, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
