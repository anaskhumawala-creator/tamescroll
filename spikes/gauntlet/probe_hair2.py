"""Hair coverage, visually: scroll each drawn patch into view and shoot it."""
import json, sys, time
from gauntlet import open_platform

OUT = sys.argv[1] if len(sys.argv) > 1 else "hair"
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview+woman'")
for _ in range(25):
    time.sleep(2)
    st = tab.eval("JSON.stringify(window.__TS_GAZE_WORKER||{})")
    if isinstance(st, str) and "ready" in st:
        break
print("worker:", st)
time.sleep(12)

n = tab.eval("document.querySelectorAll('.ts-gaze-region-patch').length")
print("patches:", n)
shot = 0
for i in range(int(n or 0)):
    r = tab.eval(
        "(function(){var p=document.querySelectorAll('.ts-gaze-region-patch')[%d];"
        "if(!p)return null;var b=p.getBoundingClientRect();"
        "if(b.width<120||b.height<80)return null;"
        "window.scrollBy(0, b.top-160);return 1;})()" % i
    )
    if not r:
        continue
    time.sleep(1.2)
    box = tab.eval(
        "(function(){var p=document.querySelectorAll('.ts-gaze-region-patch')[%d];"
        "if(!p)return null;var b=p.getBoundingClientRect();"
        "return JSON.stringify({x:b.x,y:b.y,w:b.width,h:b.height});})()" % i
    )
    if not box:
        continue
    b = json.loads(box)
    if b["y"] < 0 or b["y"] > 700:
        continue
    pad = 90
    tab.clip_shot(
        f"{OUT}-{shot}.png",
        {"x": max(0, b["x"] - pad), "y": max(0, b["y"] - pad), "w": b["w"] + pad * 2, "h": b["h"] + pad * 2},
    )
    print("shot", shot, b)
    shot += 1
    if shot >= 4:
        break
