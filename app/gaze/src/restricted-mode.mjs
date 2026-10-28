// RESTRICTED MODE WHILE BROWSING, OFF WHILE WATCHING (his 2026-10-28).
// "can we keep restrict mode on when on home or search results and it
// off when video is clicked": YouTube's own Restricted Mode filters
// mature videos out of search on its servers, which costs this phone
// nothing, but it also hides comments, and he wants those on the video
// he chose. Restricted Mode is one bit of the PREF cookie (f2, hex
// flags), and YouTube reads the cookie on every request, so the page
// flips that bit by page kind. Pure, so it is testable without a DOM.

// 1 ships. 0 over OTA stops the page touching the cookie at all, the
// revert if YouTube ever objects to the flip.
export var YT_RESTRICTED_BROWSE = 1;
export function setRestrictedBrowse(v) { YT_RESTRICTED_BROWSE = v; }

var BIT = 0x8000000;

function f2Of(pref) {
  var m = /(?:^|&)f2=([0-9a-fA-F]+)(?:&|$)/.exec(String(pref || ''));
  return m ? parseInt(m[1], 16) : 0;
}

/** Whether a PREF cookie value has Restricted Mode on. */
export function prefRestricted(pref) {
  return (f2Of(pref) & BIT) !== 0;
}

/** The PREF value with Restricted Mode set or cleared, other keys kept. */
export function prefWithRestricted(pref, on) {
  var f2 = on ? f2Of(pref) | BIT : f2Of(pref) & ~BIT;
  var rest = String(pref || '')
    .split('&')
    .filter(function (kv) { return kv && !/^f2=/.test(kv); });
  if (f2) rest.push('f2=' + f2.toString(16));
  return rest.join('&');
}

/** Restricted everywhere on YouTube except the video being watched. */
export function wantRestricted(kind) {
  return kind !== 'watch';
}
