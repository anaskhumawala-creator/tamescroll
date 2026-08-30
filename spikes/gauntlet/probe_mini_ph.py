from gauntlet import pick
tab = pick("youtube.com")
print(tab.eval(r"""(function(){
  var w=document.querySelector('ytm-watch'), out=[];
  var kids=w.children;
  for(var i=0;i<kids.length;i++){var e=kids[i],r=e.getBoundingClientRect(),cs=getComputedStyle(e);
    out.push('  '+e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+'.'+((e.className+'').trim().split(/\s+/).slice(0,3).join('.'))
      +' | y'+Math.round(r.top)+' h'+Math.round(r.height)+' pos:'+cs.position+' disp:'+cs.display+' pt:'+cs.paddingTop+' mb:'+cs.marginBottom);}
  var pc=document.getElementById('player-container-id');
  return 'ytm-watch children:\n'+out.join('\n')+'\nplayer parent: '+(pc.parentElement.tagName.toLowerCase()+(pc.parentElement.id?'#'+pc.parentElement.id:''))
   +'\nscrollY='+window.scrollY;
})()"""))
