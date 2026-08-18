// Shared DOM helpers for the gaze runtime. Dependency-free (no tfjs
// import) so style/DOM logic stays simple to reason about in isolation.
// Architecture: docs/gaze-research.md §5 (clean-room reproduction of
// HaramBlur's *behaviour*, not its AGPL code — see NOTICE / VISION.md).

export var PENDING_CLASS = 'ts-gaze-pending';
export var FLAGGED_CLASS = 'ts-gaze-flagged';

var STYLE_ID = 'tamescroll-gaze-style';

// ONE CSS RULE PER SELECTOR — see app/src-tauri/src/lib.rs cosmetic_css()
// for why: a single invalid selector in a comma-joined list can silently
// disable the whole rule. Both selectors here are ours and trivial, but
// the convention stays consistent everywhere blur CSS gets injected.
// Radius resolves through --ts-blur-strong so the launcher's strength
// preset reaches Stage B too (the injection wrapper sets the variable
// inline on <html>; 24px is the standalone fallback).
var STYLE_CSS =
  '.' + PENDING_CLASS + ' { filter: blur(var(--ts-blur-strong, 24px)) !important; }\n' +
  '.' + FLAGGED_CLASS + ' { filter: blur(var(--ts-blur-strong, 24px)) !important; }\n';

export function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  var head = document.head || document.documentElement;
  if (!head) return;
  var el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = STYLE_CSS;
  head.appendChild(el);
}

// Player red line (VISION.md: block-only, never touch what the user is
// actually watching): gaze must never add a class to anything inside
// YouTube's #movie_player.
export function hasPlayerAncestor(el) {
  if (el.closest) return !!el.closest('#movie_player');
  var node = el;
  while (node) {
    if (node.id === 'movie_player') return true;
    node = node.parentElement;
  }
  return false;
}

export function isSameOrigin(url) {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch (e) {
    return false;
  }
}

// Cross-origin images without a CORS attribute taint the canvas used for
// pixel readback (SecurityError on getImageData). Re-loading the same URL
// through an anonymous-CORS clone is cheap — the browser cache makes the
// re-fetch effectively free — and same-origin images pass through
// untouched. Rejects if the server denies CORS; the caller then fails
// closed (stays blurred) rather than risk an unverified unblur.
export function loadDetectable(img) {
  var src = img.currentSrc || img.src;
  if (isSameOrigin(src) || img.crossOrigin) return Promise.resolve(img);
  return new Promise(function (resolve, reject) {
    var clone = new Image();
    clone.crossOrigin = 'anonymous';
    clone.onload = function () {
      resolve(clone);
    };
    clone.onerror = function () {
      reject(new Error('cors-denied'));
    };
    clone.src = src;
  });
}
