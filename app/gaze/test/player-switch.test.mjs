import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  playerBlurWanted, isPhoneUa, setPlayerBlurStartOff, PLAYER_BLUR_START_OFF,
} from '../src/player-switch.mjs';

// His ruling 2026-10-22: "phones keep the blur just off by default and
// labelled in beta".
const SHIPPED = PLAYER_BLUR_START_OFF;

test('ships 1, and rules/tuning.json says the same', () => {
  assert.equal(SHIPPED, 1);
  const json = JSON.parse(readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8'));
  assert.equal(json.PLAYER_BLUR_START_OFF, 1, 'the OTA copy would revert the source on every phone');
});

test('a phone watch page starts off; desktop starts on', () => {
  assert.equal(playerBlurWanted('abc', null, true), false);
  assert.equal(playerBlurWanted('abc', null, false), true);
});

test('feed previews keep blur-first on a phone', () => {
  assert.equal(playerBlurWanted(null, null, true), true);
  assert.equal(playerBlurWanted(null, { id: 'abc', on: false }, false), true);
});

test('a tap holds for its own video only', () => {
  assert.equal(playerBlurWanted('abc', { id: 'abc', on: true }, true), true, 'turned on stays on');
  assert.equal(playerBlurWanted('abc', { id: 'abc', on: false }, false), false, 'turned off stays off');
  assert.equal(playerBlurWanted('xyz', { id: 'abc', on: true }, true), false, 'next video: default');
  assert.equal(playerBlurWanted('xyz', { id: 'abc', on: false }, false), true, 'next video: default');
});

test('the dial at 0 restores blur-first on phones', () => {
  setPlayerBlurStartOff(0);
  try {
    assert.equal(playerBlurWanted('abc', null, true), true);
  } finally {
    setPlayerBlurStartOff(SHIPPED);
  }
});

test('the phone test is the Android WebView', () => {
  assert.ok(isPhoneUa('Mozilla/5.0 (Linux; Android 16; 23122PCD1I) AppleWebKit/537.36'));
  assert.ok(!isPhoneUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130'));
});
