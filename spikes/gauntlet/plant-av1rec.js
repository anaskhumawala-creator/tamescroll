(function(){
  var L = []; window.__TS_AV1P = L; var t0 = performance.now();
  function now(){ return Math.round(performance.now()-t0); }
  function av1(x){ return /av01|av1/i.test(String(x||'')); }
  // Accessor so a later plain assignment (perf.mjs av1Patch) is re-wrapped.
  function hook(obj, name, api){
    var cur = obj[name];
    function wrap(fn){ return function(){ var a=arguments[0]; var r; try{ r=fn.apply(this,arguments);}catch(e){ L.push({api:api,t:now(),arg:String(a).slice(0,80),threw:String(e)}); throw e; }
      var rec={api:api,t:now(),av1:av1(a&&a.video?a.video.contentType:a),arg:String(a&&a.video?a.video.contentType:a).slice(0,80)};
      if(r&&typeof r.then==='function'){ r.then(function(v){ rec.ret=v&&v.supported; }); } else rec.ret=r;
      if(rec.av1||api==='asb') L.push(rec); return r; }; }
    var wrapped = wrap(cur);
    Object.defineProperty(obj, name, { configurable:true, get:function(){ return wrapped; }, set:function(fn){ L.push({api:api,t:now(),event:'reassigned'}); wrapped = wrap(fn); } });
  }
  try{ hook(MediaSource,'isTypeSupported','its'); }catch(e){ L.push({err:'its '+e}); }
  try{ hook(HTMLMediaElement.prototype,'canPlayType','cpt'); }catch(e){ L.push({err:'cpt '+e}); }
  try{ if(navigator.mediaCapabilities) hook(navigator.mediaCapabilities.__proto__,'decodingInfo','dec'); }catch(e){ L.push({err:'dec '+e}); }
  try{ hook(MediaSource.prototype,'addSourceBuffer','asb'); }catch(e){ L.push({err:'asb '+e}); }
  var iv=setInterval(function(){ if(window.__TS_GAZE_BUNDLE__){ L.push({event:'bundle',t:now(),v:window.__TS_GAZE_BUNDLE__}); clearInterval(iv);} },20);
})();
