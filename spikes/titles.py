import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick
q = sys.argv[1]
tab = pick("youtube.com")
tab.eval("location.href='https://www.youtube.com/results?search_query=" + q.replace(' ','+') + "'")
time.sleep(9)
js = ("(function(){var out=[];var rs=document.querySelectorAll('ytd-video-renderer');"
      "for(var i=0;i<rs.length&&out.length<8;i++){var a=rs[i].querySelector('a#video-title');"
      "if(!a)continue;var h=a.getAttribute('href')||'';var p=h.indexOf('v=');"
      "var id=p<0?'?':h.substring(p+2,p+13);"
      "var ch=rs[i].querySelector('ytd-channel-name');"
      "out.push([id,(a.getAttribute('title')||a.textContent||'').trim().substring(0,64),"
      "ch?ch.textContent.trim().substring(0,22):'']);}return JSON.stringify(out);})()")
r = tab.eval(js)
for row in json.loads(r or "[]"):
    print(" | ".join(row))
