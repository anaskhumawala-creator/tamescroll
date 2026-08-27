"""Can we construct a SAME-ORIGIN Worker on YouTube?

Earlier sessions ruled Workers out on Blob urls (Trusted Types). A
same-origin script url is a different question, and it is the one that
decides whether inference can leave the main thread -- our Rust side can
already answer a request on youtube.com's own origin.

Construction is what CSP and Trusted Types gate, and they throw
SYNCHRONOUSLY. A wrong MIME type or a 404 fails later, as an error
EVENT. So the two outcomes are distinguishable without serving anything.
"""
import time, json
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=test'")
time.sleep(12)
print("csp:", tab.eval("""JSON.stringify((function(){
  var m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  return { meta: m ? m.content.slice(0,200) : null,
           tt: typeof trustedTypes !== 'undefined' };
})())"""))
print(tab.eval("""(function(){
  var out = {};
  try {
    var w = new Worker('/robots.txt');
    out.construct = 'ALLOWED';
    w.onerror = function(){};
    setTimeout(function(){ try{ w.terminate(); }catch(e){} }, 500);
  } catch (e) {
    out.construct = 'THREW: ' + e.name + ' ' + String(e.message).slice(0,120);
  }
  try {
    var b = new Worker(URL.createObjectURL(new Blob(['self.onmessage=function(){}'], {type:'text/javascript'})));
    out.blob = 'ALLOWED';
    setTimeout(function(){ try{ b.terminate(); }catch(e){} }, 500);
  } catch (e) {
    out.blob = 'THREW: ' + e.name + ' ' + String(e.message).slice(0,120);
  }
  out.offscreen = (typeof OffscreenCanvas === 'function');
  return JSON.stringify(out);
})()"""))
