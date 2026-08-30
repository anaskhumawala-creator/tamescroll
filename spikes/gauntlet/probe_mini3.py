import json, time
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(10)
print("play:", tab.eval("(function(){var v=document.querySelector('video');if(!v)return 'novideo';v.muted=true;var p=v.play();return 'called';})()"))
time.sleep(4)
print("state:", tab.eval("(function(){var v=document.querySelector('video');return JSON.stringify({paused:v.paused,t:v.currentTime,ready:v.readyState});})()"))
print("flags:", tab.eval("(function(){try{var c=ytcfg.get('WEB_PLAYER_CONTEXT_CONFIGS');var k=Object.keys(c)[0];var x=c[k];return JSON.stringify({disableMini:x.disableSharing===undefined?null:undefined,keys:Object.keys(x).filter(function(s){return /mini/i.test(s);})});}catch(e){return 'err '+e;}})()"))
print("expFlag:", tab.eval("(function(){try{var e=ytcfg.get('EXPERIMENT_FLAGS')||{};var out={};Object.keys(e).forEach(function(k){if(/mini/i.test(k))out[k]=e[k];});return JSON.stringify(out).slice(0,900);}catch(e){return 'err';}})()"))
tab.eval("(function(){var a=document.querySelector('ytd-topbar-logo-renderer a, #logo a');a&&a.click();})()")
time.sleep(5)
print("after:", tab.eval("(function(){var m=document.querySelector('ytd-miniplayer');var app=document.querySelector('ytd-app');return JSON.stringify({url:location.href,disp:m?getComputedStyle(m).display:null,appMini:app?app.hasAttribute('miniplayer-is-active'):null});})()"))
