import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/region-blur.mjs', import.meta.url), 'utf8');

test('a patch stops where the chrome covering its image starts', () => {
  assert.ok(src.includes('function occluderBottom('), 'the occluder has to be measured, not assumed');
  const pos = src.slice(src.indexOf('function positionEntry('), src.indexOf('function positionEntry(') + 1800);
  assert.ok(pos.includes('occluderBottom('), 'positionEntry must consult it');
  assert.ok(pos.includes("overlay.style.display = 'none'"), 'a fully covered patch stands down');
  assert.ok(pos.includes("overlay.style.display = ''"), 'and comes back when it is not covered');
});

test('the occluder is found by hit-testing, never by a guessed selector', () => {
  const fn = src.slice(src.indexOf('function occluderBottom('), src.indexOf('function occluderBottom(') + 1400);
  assert.ok(fn.includes('elementsFromPoint'), 'ask the page what actually paints there');
  assert.ok(fn.includes("'fixed'") && fn.includes("'sticky'"), 'both pinning modes count');
  assert.ok(!/querySelector/.test(fn), 'no selector guessing in the occluder path');
});

test('our own image on top means nothing is covering it', () => {
  const fn = src.slice(src.indexOf('function occluderBottom('), src.indexOf('function occluderBottom(') + 1400);
  assert.ok(fn.includes('node.contains(el)'), 'an ancestor of our element is not an occluder');
  assert.ok(fn.includes('return 0'), 'and that answer is no clamp at all');
});

test('a patch never keeps a host that is no longer the image\'s parent', () => {
  const sweep = src.slice(src.indexOf('function sweep()'), src.indexOf('setInterval(sweep'));
  assert.ok(
    sweep.includes('entry.el.parentElement !== entry.host'),
    'the heartbeat has to re-check the host, not only the verdict path'
  );
  assert.ok(sweep.includes('resolveHost(entry.el)'), 're-resolve rather than guess');
  const guard = sweep.slice(sweep.indexOf('entry.el.parentElement !== entry.host'));
  assert.ok(
    guard.slice(0, 400).includes('classList.add(wholeBlurClass)'),
    'no host to take means whole blur comes back -- the covered direction'
  );
  assert.ok(
    guard.slice(0, 400).includes('dropOverlays(entry)'),
    'overlays hosted by the old parent must not survive the re-host'
  );
});

test('the occluder clamp is re-asked on scroll, not only on reflow', () => {
  // THE DEFECT: positionEntry is the only place occluderBottom runs, and
  // the 500ms sweep called it only when the element's PARENT-RELATIVE
  // rect changed. A scroll moves a thumbnail together with its parent,
  // so that rect is identical and the clamp -- whose own gate is
  // VIEWPORT-relative -- was never re-evaluated. A patch minted low on
  // the page kept occ = 0 for the life of the page and rode up under the
  // sticky player still wearing it.
  //
  // MEASURED 2026-08-31 on m.youtube search: a patch reached top -72
  // under a 48px fixed bar, unclipped.
  const src = readFileSync(new URL('../src/region-blur.mjs', import.meta.url), 'utf8');
  assert.match(src, /function clampSweep\(\)/);
  // It must be driven by scroll, and that listener must be passive --
  // a non-passive one costs every page in the app its fast scroll path.
  assert.match(
    src,
    /addEventListener\(\s*'scroll',\s*onScroll,\s*\{\s*capture:\s*true,\s*passive:\s*true\s*\}\s*\)/
  );
  // And the heartbeat has to re-ask too, for a scroll that stops between
  // animation frames.
  assert.match(src, /vpMoved && \(inClampZone \|\| entry\.occ\)/);
  // positionEntry has to remember what it decided, or nothing can tell
  // that a clamp is owed back when the image leaves the zone.
  assert.match(src, /entry\.occ = occ;/);
  assert.match(src, /entry\.lastVpTop = elRect\.top;/);
});
