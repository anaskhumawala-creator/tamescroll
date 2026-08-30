"""What does a SIGNED-OUT Meta page actually give us to anchor on?"""
import json, time
from gauntlet import open_platform

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)

JS = r"""(function(){
  function labels(sel){var o={};document.querySelectorAll(sel).forEach(function(e){
    var k=e.getAttribute('aria-label')||e.getAttribute('role')||e.tagName;o[k]=(o[k]||0)+1;});return o;}
  var hrefs={};
  document.querySelectorAll('a[href]').forEach(function(a){
    var h=a.getAttribute('href')||'';var m=h.match(/^(https?:\/\/[^\/]+)?(\/[a-z_.-]*)/i);
    if(m){hrefs[m[2]]=(hrefs[m[2]]||0)+1;}});
  return JSON.stringify({
    url: location.href.slice(0,70),
    title: document.title.slice(0,50),
    imgs: document.querySelectorAll('img').length,
    vids: document.querySelectorAll('video').length,
    articles: document.querySelectorAll('[role="article"]').length,
    ariaLabelled: labels('[aria-label]'),
    hrefs: hrefs
  });
})()"""

for url in ["https://www.instagram.com/", "https://www.instagram.com/explore/",
            "https://www.facebook.com/", "https://m.facebook.com/"]:
    tab.eval("location.href='%s'" % url)
    time.sleep(11)
    r = tab.eval(JS)
    d = json.loads(r) if isinstance(r, str) else {"err": r}
    print(url)
    print("   ", d.get("url"), "| title", d.get("title"), "| imgs", d.get("imgs"),
          "vids", d.get("vids"), "articles", d.get("articles"))
    al = d.get("ariaLabelled", {})
    print("    aria:", dict(list(al.items())[:14]))
    hs = d.get("hrefs", {})
    print("    hrefs:", dict(list(sorted(hs.items(), key=lambda x: -x[1]))[:14]))
