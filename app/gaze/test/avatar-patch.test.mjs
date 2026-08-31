import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { padBox, expandToBody } from '../src/region-blur.mjs';

const face = { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8, confidence: 0.9 };

test('a body runs off every edge of an avatar, which is why it cannot be used there', () => {
  const body = expandToBody(face);
  // Clamped to the element on three sides at least: that clamping is
  // what turns the patch into the whole square.
  const clamped = [body.x1 === 0, body.y1 === 0, body.x2 === 1, body.y2 === 1].filter(Boolean);
  assert.ok(clamped.length >= 3, 'expected a body to clamp on most edges of a head-filling crop');
});

test('an avatar patch stays inside the picture', () => {
  const p = padBox(face, 0.22);
  assert.ok(p.x1 > 0 && p.y1 > 0 && p.x2 < 1 && p.y2 < 1, 'padded face should not fill the frame');
  assert.ok(p.x2 - p.x1 > face.x2 - face.x1, 'and should still be wider than the face box');
});

test('the avatar path is wired: no body expansion, and the element radius is passed', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const i = src.indexOf('function applyVerdictToImage');
  const block = src.slice(i, i + 1600);
  assert.ok(/avatar\s*$|avatar\b/m.test(block), 'applyVerdictToImage must branch on the avatar band');
  assert.ok(block.includes('padBox('), 'avatars take a padded face box');
  assert.ok(block.includes('radius: elementRadius(img)'), 'avatar patches take the element radius');
});

test('a patch can be given a radius and rebuilds when it changes', () => {
  const src = readFileSync(new URL('../src/region-blur.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes('makeOverlay(entry.radius)'), 'overlays must be built with the entry radius');
  assert.ok(src.includes('dropOverlays(entry)'), 'a changed radius must rebuild the patches');
});

test('the topbar logo is not judged, and the account avatar still is', () => {
  // MEASURED 2026-08-31 on live m.youtube home:
  // IMG#home-icon.mobile-topbar-logo.ytmLogoEntityLogo, 122x48 at
  // (-1,-1), natural 244x96, served from www.gstatic.com, computed
  // filter blur(24px) permanently. That host refuses CORS, so every
  // read ends cors-denied and fail-closed keeps it covered forever.
  // Owner: "why is the top left thing of YouTube blurred? It's
  // annoying."
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  assert.match(src, /CHROME_IGNORE = 'img\.mobile-topbar-logo'/);
  // NARROW: the account avatar lives in the same bar and is a photo of a
  // person. If this list ever grows to the bar itself, that stops being
  // judged too.
  assert.ok(
    !/CHROME_IGNORE[^;]*(ytm-mobile-topbar-renderer|ytm-profile-icon)/.test(src),
    'the ignore must never widen to the top bar or the profile icon'
  );
  // An ignored image must be CLEARED, never left wearing the cover.
  const tag = src.slice(src.indexOf('function tagImage('), src.indexOf('function tagImage(') + 400);
  assert.ok(tag.includes('isIgnoredChrome(img)') && tag.includes('clearEl(img)'));
  // retagImage marks pending before it calls tagImage, so it needs the
  // same refusal or the logo flashes covered on every src swap.
  const retag = src.slice(src.indexOf('function retagImage('), src.indexOf('function retagImage(') + 400);
  assert.ok(retag.includes('isIgnoredChrome(img)'), 'the src-swap path must refuse it too');
});
