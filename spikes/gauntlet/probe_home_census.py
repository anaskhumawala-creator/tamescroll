# EVERY non-video element on the home feed, not just the one he named.
# He said "no random elements like breaking news and this that yah yah
# yah on the homepage", so the question is what ELSE is in there.
#
# Walks the feed container's descendants one level at a time and reports
# what each block is, how tall, what it says, and whether it holds
# ordinary videos -- so a shelf can be told from the feed by evidence
# rather than by its name.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
print("refresh:", t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  try{return await inv('refresh_rules');}catch(e){return 'ERR '+e;}})()"""))
time.sleep(2)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
    shown:['home','home_shelves','shorts','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/")
time.sleep(30)

print(json.dumps(t.eval("""(function(){
  function txt(n){return (n.textContent||'').replace(/\s+/g,' ').trim().slice(0,64);}
  function box(n){var b=n.getBoundingClientRect();
    return {w:Math.round(b.width), h:Math.round(b.height), top:Math.round(b.top+scrollY)};}
  var root=document.querySelector('ytm-rich-grid-renderer')
        || document.querySelector('ytm-single-column-browse-results-renderer')
        || document.querySelector('ytm-browse');
  if(!root) return {err:'no feed root', body:txt(document.body)};
  // Every block that is a direct structural child of the feed, whatever
  // it calls itself.
  // Descend past pure wrappers until the level that actually has rows:
  // ytm-rich-grid-renderer keeps its items inside
  // .rich-grid-renderer-contents, so the first level is two blocks and
  // tells you nothing.
  var kids=[].slice.call(root.children);
  for(var d=0; d<4; d++){
    var big=kids.filter(function(n){return n.getBoundingClientRect().height>40;});
    if(big.length>=3) break;
    if(!big.length) break;
    var next=[].slice.call(big[0].children);
    if(next.length<2) break;
    kids=next;
  }
  var blocks=kids.map(function(n,i){
    var b=box(n);
    return {i:i, tag:n.tagName.toLowerCase(),
      cls:String(n.className||'').split(' ').slice(0,2).join('.'),
      h:b.h, w:b.w,
      watch:n.querySelectorAll('a[href*="/watch?v="]').length,
      shorts:n.querySelectorAll('a[href*="/shorts/"]').length,
      links:n.querySelectorAll('a').length,
      imgs:n.querySelectorAll('img').length,
      text:txt(n)};});
  return {root:root.tagName.toLowerCase(), blocks:blocks,
    totals:{watch:document.querySelectorAll('a[href*="/watch?v="]').length,
            shorts:document.querySelectorAll('a[href*="/shorts/"]').length,
            richItems:document.querySelectorAll('ytm-rich-item-renderer').length},
    docH:document.documentElement.scrollHeight};})()"""), indent=1))
