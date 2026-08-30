import time
from gauntlet import open_platform
tab = open_platform("man")
time.sleep(2)
print(tab.eval("JSON.stringify({has: !!(navigator.scheduling && navigator.scheduling.isInputPending), ua: navigator.userAgent.slice(0,60)})"))
