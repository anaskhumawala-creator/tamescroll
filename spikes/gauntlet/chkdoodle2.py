import json, time
from emu_cdp import page, Tab
t = Tab(page())
print(json.dumps(t.eval("""(function(){
  var bar=document.querySelector('ytm-mobile-topbar-renderer');
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').slice(0,3).join('.'):'');};
  var svgs=[].slice.call(bar.querySelectorAll('svg')).map(function(x){
    var chain=[]; for(var n=x.parentElement;n&&chain.length<3;n=n.parentElement) chain.push(nm(n));
    return {vb:x.getAttribute('viewBox'), w:x.getAttribute('width'), h:x.getAttribute('height'),
            paths:x.querySelectorAll('path').length, chain:chain};});
  // page-local experiment: hide the promo and see what the bar does
  var im=bar.querySelector('img.mobile-topbar-logo');
  var before=im?im.getBoundingClientRect():null;
  if(im) im.style.display='none';
  var after=[].slice.call(bar.querySelectorAll('svg')).map(function(x){
    var r=x.getBoundingClientRect(); return [r.x|0,r.y|0,r.width|0,r.height|0];});
  var link=bar.querySelector('a[href="/"], a[href="https://m.youtube.com/"]');
  var lr=link?link.getBoundingClientRect():null;
  if(im) im.style.display='';   // put it back -- page-local, but be tidy
  return {svgs:svgs, afterHideSvgBoxes:after,
          homeLink: link?nm(link):null, homeLinkBox: lr?[lr.x|0,lr.y|0,lr.width|0,lr.height|0]:null,
          promoBefore: before?[before.x|0,before.y|0,before.width|0,before.height|0]:null};})()"""), indent=1))
