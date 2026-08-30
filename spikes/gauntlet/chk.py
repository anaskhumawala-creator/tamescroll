from gauntlet import pick
t = pick("youtube.com")
print(t.eval("location.href"))
print("imgs", t.eval("document.querySelectorAll('img').length"))
print("recycle", t.eval("typeof window.__RECYCLE"))
print("patches", t.eval("document.querySelectorAll('.ts-gaze-region-patch').length"))
print("bundle", t.eval("window.__TS_GAZE_BUNDLE__"))
