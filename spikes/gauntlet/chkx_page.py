import json
from emu_cdp import page, Tab
t = Tab(page()); t.cmd('Runtime.enable')
JS = '(function(){\n  var txt = document.body ? document.body.innerText : \'\';\n  var nl = String.fromCharCode(10);\n  return {url: location.href.slice(0,90), title: document.title.slice(0,60),\n    len: txt.length, head: txt.slice(0,160).split(nl).join(\' | \'),\n    cells: document.querySelectorAll(\'[data-testid="cellInnerDiv"]\').length,\n    articles: document.querySelectorAll(\'article\').length,\n    loginish: /log in|sign up|sign in/i.test(txt)};})()'
print(json.dumps(t.eval(JS), indent=1))
