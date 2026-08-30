import time
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(12)
print(tab.eval(r"""(function(){
  var right = document.querySelector('.ytp-right-controls');
  var btns = right ? [].map.call(right.querySelectorAll('button,[role=button]'), function(b){
      var cs=getComputedStyle(b);
      return {cls:b.className, title:(b.getAttribute('title')||b.getAttribute('aria-label')||'').slice(0,40), disp:cs.display, w:Math.round(b.getBoundingClientRect().width)};
  }) : null;
  return JSON.stringify({rightControls:!!right, btns:btns});
})()"""))
