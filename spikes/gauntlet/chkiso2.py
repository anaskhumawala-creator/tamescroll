import json,time
from emu_cdp import page, Tab
t=Tab(page()); t.cmd("Page.enable")
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(42)
t.eval("window.scrollBy(0,1400);1"); time.sleep(25)
print(json.dumps(t.eval(open('chkiso.py').read().split('"""')[1]),indent=1))
