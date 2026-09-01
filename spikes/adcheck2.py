import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gauntlet"))
from gauntlet import pick
tab = pick("youtube.com")
print(tab.eval("""(function(){
 var r=window.ytInitialPlayerResponse;
 if(!r) return JSON.stringify({no:'absent'});
 var d=Object.getOwnPropertyDescriptor(r,'adSlots');
 var err=null, deleted=null;
 try{ deleted = (function(){'use strict'; return delete r.adSlots;})(); }catch(e){ err=String(e&&e.message); }
 return JSON.stringify({
  frozen:Object.isFrozen(r), sealed:Object.isSealed(r), ext:Object.isExtensible(r),
  desc: d?{c:d.configurable,w:d.writable,e:d.enumerable,acc:!!d.get}:null,
  deleted:deleted, err:err,
  nowHas: 'adSlots' in r,
  keys: Object.keys(r).length,
  adKeys: Object.keys(r).filter(function(k){return /ad/i.test(k)})
 });})()"""))
