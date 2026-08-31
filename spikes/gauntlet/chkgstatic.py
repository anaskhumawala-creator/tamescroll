# DOES www.gstatic.com SEND ACAO? If it does, adding it to CORS_SAFE_HOST
# makes the logo readable and judged -- no protection contract touched.
# Asked from the live page, which is the only place the answer counts.
import json
from emu_cdp import page, Tab
t=Tab(page())
print(json.dumps(t.eval("""(async function(){
  var url='https://www.gstatic.com/youtube/img/promos/'+
    'b4174ce6bdc6ad5b78343f1a79c8010334e767b424f9c9ebbf1a9bf0e6ff922d_244x96.webp';
  var out={url:url};
  // 1. does a CORS fetch succeed?
  try{ var r=await fetch(url,{mode:'cors'});
       out.fetchOk=r.ok; out.status=r.status;
       out.acao=r.headers.get('access-control-allow-origin'); }
  catch(e){ out.fetchErr=String(e).slice(0,90); }
  // 2. can a crossOrigin=anonymous image actually be drawn and read?
  out.canvasRead = await new Promise(function(res){
    var im=new Image(); im.crossOrigin='anonymous';
    im.onload=function(){
      try{ var c=document.createElement('canvas');
           c.width=8;c.height=8;
           c.getContext('2d').drawImage(im,0,0,8,8);
           c.getContext('2d').getImageData(0,0,1,1);
           res('readable'); }
      catch(e){ res('tainted: '+String(e).slice(0,60)); }};
    im.onerror=function(){res('load failed with crossOrigin');};
    im.src=url+'?ts='+1;
    setTimeout(function(){res('timeout');},9000);});
  // 3. and the control: the same test on a host already on the list
  out.control = await new Promise(function(res){
    var ii=document.querySelector('img[src*="ytimg.com"]');
    if(!ii) return res('no ytimg img on page');
    var im=new Image(); im.crossOrigin='anonymous';
    im.onload=function(){
      try{var c=document.createElement('canvas');c.width=8;c.height=8;
          c.getContext('2d').drawImage(im,0,0,8,8);
          c.getContext('2d').getImageData(0,0,1,1);res('readable');}
      catch(e){res('tainted');}};
    im.onerror=function(){res('load failed');};
    im.src=ii.currentSrc;
    setTimeout(function(){res('timeout');},9000);});
  return out;})()"""), indent=1))
