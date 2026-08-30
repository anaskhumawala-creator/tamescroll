import time
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(10)
tab.eval("window.__navMark = 'alive';")
print("click:", tab.eval("""(function(){
  var a = document.querySelector('ytd-video-renderer a#video-title, ytd-video-renderer a#thumbnail, yt-lockup-view-model a');
  if(!a) return 'nolink';
  a.click(); return (a.getAttribute('href')||'').slice(0,40);
})()"""))
time.sleep(10)
print("after:", tab.eval("""JSON.stringify({url:location.href.slice(0,60), mark:window.__navMark||null,
  navs: performance.getEntriesByType('navigation').length,
  comments: document.querySelectorAll('#comments ytd-comment-thread-renderer').length,
  commentSpin: !!document.querySelector('#comments ytd-continuation-item-renderer'),
  related: document.querySelectorAll('#related ytd-compact-video-renderer, #related yt-lockup-view-model').length,
  relatedSpin: !!document.querySelector('#related ytd-continuation-item-renderer')})"""))
time.sleep(8)
print("after2:", tab.eval("""JSON.stringify({comments: document.querySelectorAll('#comments ytd-comment-thread-renderer').length,
  related: document.querySelectorAll('#related ytd-compact-video-renderer, #related yt-lockup-view-model').length,
  mark: window.__navMark||null})"""))
