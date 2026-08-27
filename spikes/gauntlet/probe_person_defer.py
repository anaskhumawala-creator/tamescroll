"""Does a video-free page still pay for the person model, and does a
video that arrives later still get it?"""
import time, json
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(16)
print("search page timings:", tab.eval("JSON.stringify(window.__TS_GAZE_TIMING||{})"))
print("person model loaded?", tab.eval("!!(window.__TS_GAZE_TIMING||{}).person"))
# now click into a video: SPA nav, no re-eval of the bundle
tab.eval("""(function(){var a=document.querySelector('a#video-title, a#thumbnail');if(a)a.click();})()""")
time.sleep(14)
print("after watch nav:", tab.eval("JSON.stringify(window.__TS_GAZE_TIMING||{})"))
print("persons seen:", tab.eval("window.__TS_GAZE_PERSONS"))
