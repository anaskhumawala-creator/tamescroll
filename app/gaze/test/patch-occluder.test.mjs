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
