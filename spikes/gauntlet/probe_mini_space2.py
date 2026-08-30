from gauntlet import pick
tab = pick("youtube.com")
print(tab.eval(r"""(function(){
  // walk from the first content element up to ytm-app, print every box
  var el=document.querySelector('ytm-slim-video-metadata-section-renderer'), out=[];
  while(el && el.tagName!=='HTML'){
    var r=el.getBoundingClientRect(), cs=getComputedStyle(el);
    out.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+'.'+((el.className+'').trim().split(/\s+/).slice(0,2).join('.'))
      +' | y'+Math.round(r.top)+' h'+Math.round(r.height)+' mt:'+cs.marginTop+' pt:'+cs.paddingTop+' pos:'+cs.position+' disp:'+cs.display);
    el=el.parentElement;
  }
  return out.join('\n');
})()"""))
