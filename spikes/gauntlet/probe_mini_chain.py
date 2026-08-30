from gauntlet import pick
tab = pick("youtube.com")
print(tab.eval(r"""(function(){
  var v=document.querySelector('video'), out=[], el=v;
  for(var i=0;i<9 && el;i++){ var r=el.getBoundingClientRect(), cs=getComputedStyle(el);
    out.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className?'.'+(el.className+'').trim().split(/\s+/).join('.'):'')
      +' | '+Math.round(r.width)+'x'+Math.round(r.height)+' @y'+Math.round(r.top)+' | '+cs.position+' z'+cs.zIndex);
    el=el.parentElement; }
  return out.join('\n');
})()"""))
