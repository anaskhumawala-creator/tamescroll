"""The miniplayer shim must be inert everywhere it does not belong.

It listens on every platform page (one bundle, one boot), so the claim
being checked here is that a page with no m.youtube player container is
completely unaffected: nothing installed on the html element, the page's
own video still plays, the feed still renders.
"""
import time
from gauntlet import open_platform

tab = open_platform("man")
time.sleep(6)
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(20)
print(
    "desktop youtube:",
    tab.eval(
        r"""(function(){
  return JSON.stringify({installed: !!window.__TS_MINI__,
    state: window.__TS_MINI__?window.__TS_MINI__.state():null,
    pc: !!document.getElementById('player-container-id'),
    videos: document.querySelectorAll('video').length,
    playing: (function(){var v=document.querySelector('video'); return v? !v.paused : null;})(),
    miniClass: document.documentElement.classList.contains('ts-mini')});})()"""
    ),
)
tab.eval("location.href='https://www.reddit.com/r/pics/'")
time.sleep(15)
print(
    "reddit        :",
    tab.eval(
        r"""(function(){
  return JSON.stringify({installed: !!window.__TS_MINI__,
    pc: !!document.getElementById('player-container-id'),
    posts: document.querySelectorAll('shreddit-post').length,
    miniClass: document.documentElement.classList.contains('ts-mini')});})()"""
    ),
)
