"""What does a segmentation pass COST, on this machine, in this WebView?

Target 4 of the stability round says spike the cost before building on
it. The model is handed to the page over the debug channel rather than
embedded, so the shipped bundle does not grow for a measurement.
"""
import base64, json, os, sys, time
from gauntlet import Tab, pick, open_platform

SEG = os.path.join(os.path.dirname(__file__), '..', 'segspike', 'general')

def main(video, start, size, iters):
    mj = open(os.path.join(SEG, 'model.json'), 'r', encoding='utf-8').read()
    wb = base64.b64encode(open(os.path.join(SEG, 'group1-shard1of1.bin'), 'rb').read()).decode()
    tab = open_platform('man')
    tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % video)
    time.sleep(20)
    tab = pick("youtube.com")
    tab.eval("(function(){var v=document.querySelector('video');v.currentTime=%d;v.play();})()" % start)
    time.sleep(6)
    tab.eval("window.__TS_SEG_RES=null;")
    call = ("(function(){window.__TS_GAZE_SEG_SPIKE(%s,%s,{size:%d,iters:%d})"
            ".then(function(r){window.__TS_SEG_RES=JSON.stringify(r);});return 'started';})()"
            % (json.dumps(mj), json.dumps(wb), size, iters))
    print(tab.eval(call))
    for _ in range(120):
        r = tab.eval("window.__TS_SEG_RES")
        if r:
            print(r)
            return
        time.sleep(1)
    print(json.dumps({"error": "timeout"}))

if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]))
