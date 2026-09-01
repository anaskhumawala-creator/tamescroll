import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gauntlet"))
from gauntlet import pick
tab = pick("youtube.com")
print(tab.eval("""(function(){
 var saved = window.ytInitialPlayerResponse;
 var probe = {adSlots:[1,2,3], adPlacements:[1], playerAds:[1], adBreakHeartbeatParams:'x', keep:1};
 window.ytInitialPlayerResponse = probe;
 var back = window.ytInitialPlayerResponse;
 var out = {
   sameRef: back === probe,
   afterKeys: back && typeof back==='object' ? Object.keys(back) : String(back),
   ourPruneRan: back && typeof back==='object' ? !('adSlots' in back) : false
 };
 try{ window.ytInitialPlayerResponse = saved; }catch(e){}
 return JSON.stringify(out);})()"""))
