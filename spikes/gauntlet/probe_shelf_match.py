# The news shelf did not appear in six loads, so prove the rule against
# the live injected sheet instead of waiting for YouTube to serve one.
# Two sections built the same way, one with a shorts link and one
# without, dropped into the real feed: the selector decides.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Runtime.enable")
print(json.dumps(t.eval("""(function(){
  var grid=document.querySelector('ytm-rich-grid-renderer');
  var browse=document.querySelector('ytm-browse');
  if(!grid||!browse) return {err:'no feed', path:location.pathname};
  var host=grid.querySelector('.rich-grid-renderer-contents')||grid;

  function mk(withShorts, label){
    var s=document.createElement('ytm-rich-section-renderer');
    s.className='rich-section-single-column ts-probe-section';
    var a=document.createElement('a');
    a.href = withShorts ? '/shorts/abc123' : '/watch?v=abc123';
    a.textContent=label;
    s.appendChild(a);
    host.appendChild(s);
    return s;
  }
  var news=mk(false, 'Breaking news');
  var shorts=mk(true, 'Shorts');
  var r={
    inBrowse: !!news.closest('ytm-browse'),
    newsDisplay: getComputedStyle(news).display,
    shortsDisplay: getComputedStyle(shorts).display,
    // and the real rows beside them, so the check is not only synthetic
    realSections: [].slice.call(document.querySelectorAll('ytm-rich-section-renderer:not(.ts-probe-section)'))
      .map(function(n){return {shorts:n.querySelectorAll('a[href*="/shorts/"]').length,
                               display:getComputedStyle(n).display};}),
    realItems: [].slice.call(document.querySelectorAll('ytm-rich-item-renderer'))
      .map(function(n){return getComputedStyle(n).display;}).filter(function(d){return d==='none'}).length,
    itemsTotal: document.querySelectorAll('ytm-rich-item-renderer').length};
  news.remove(); shorts.remove();
  return r;})()"""), indent=1))
