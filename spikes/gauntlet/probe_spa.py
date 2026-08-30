import time
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/'")
time.sleep(10)
tab.eval("window.__navMark = 'alive';")
print("before:", tab.eval("JSON.stringify({url:location.href,mark:window.__navMark})"))
print("click:", tab.eval("""(function(){
  var a = document.querySelector('ytd-rich-item-renderer a#video-title-link, ytd-rich-grid-media a#thumbnail');
  if(!a) return 'nolink';
  a.click(); return a.getAttribute('href');
})()"""))
time.sleep(8)
print("after:", tab.eval("""JSON.stringify({url:location.href, mark:window.__navMark||null,
  navs: performance.getEntriesByType('navigation').length,
  comments: document.querySelectorAll('#comments ytd-comment-thread-renderer').length,
  related: document.querySelectorAll('#related ytd-compact-video-renderer, #related yt-lockup-view-model').length})"""))
