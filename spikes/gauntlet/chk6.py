import time
from gauntlet import pick
t = pick("youtube.com")
t.eval("location.reload()")
time.sleep(28)
print(open('chk5.py').read().split('setup = r"""')[1].split('"""')[0][:0] or "", end="")
