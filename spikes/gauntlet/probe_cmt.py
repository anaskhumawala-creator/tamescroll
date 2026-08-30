import time
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=oeqUHEp4sYM'")
time.sleep(12)
for i in range(6):
    tab.eval("window.scrollBy(0, 900);")
    time.sleep(2.5)
    print(i, tab.eval("""JSON.stringify({y:Math.round(scrollY),
      c:document.querySelectorAll('#comments ytd-comment-thread-renderer').length,
      spin:!!document.querySelector('#comments ytd-continuation-item-renderer'),
      lt:(window.__tsLT||0)})"""))
