import time
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(14)
tab.eval("window.scrollBy(0,600)")
time.sleep(8)
tab.clip_shot("runs/thumbs-after.png", {"x":0,"y":0,"w":980,"h":1000})
print(tab.eval("""(function(){var vh=innerHeight,n=0,p=0;
 [].slice.call(document.querySelectorAll('img')).forEach(function(i){
  if(i.naturalWidth<120)return; var r=i.getBoundingClientRect();
  if(r.bottom<=0||r.top>=vh)return; n++;
  var el=i,pend=false; for(var k=0;k<4&&el;k++,el=el.parentElement){
   if(el.classList&&el.classList.contains('ts-gaze-pending'))pend=true;}
  if(pend)p++;});
 return 'visible='+n+' pending='+p+' patches='+document.querySelectorAll('#tamescroll-gaze-regions > *').length;})()"""))
