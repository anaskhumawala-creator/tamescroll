import json, time, sys
from gauntlet import Tab, open_platform, pick
tab = open_platform("https://www.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(6)
js = r"""
(function(){
  var out = {};
  out.url = location.href;
  out.comments = !!document.querySelector('#comments #contents ytd-comment-thread-renderer');
  out.commentSpinner = !!document.querySelector('#comments ytd-continuation-item-renderer, #comments tp-yt-paper-spinner[active]');
  out.related = document.querySelectorAll('#related ytd-compact-video-renderer, #related yt-lockup-view-model').length;
  out.relatedSpinner = !!document.querySelector('#related ytd-continuation-item-renderer');
  out.miniBtn = !!document.querySelector('.ytp-miniplayer-button');
  var mb = document.querySelector('.ytp-miniplayer-button');
  out.miniBtnVisible = mb ? (getComputedStyle(mb).display !== 'none' && mb.getBoundingClientRect().width > 0) : null;
  out.miniplayerEl = !!document.querySelector('ytd-miniplayer');
  out.bundleMarker = window.__TS_GAZE_BUNDLE__ || null;
  var e = performance.getEntriesByType('navigation')[0];
  if (e) { out.domContentLoaded = Math.round(e.domContentLoadedEventEnd); out.load = Math.round(e.loadEventEnd); }
  out.longTasks = (window.__tsLT||0);
  return JSON.stringify(out);
})()
"""
print(tab.eval(js))
