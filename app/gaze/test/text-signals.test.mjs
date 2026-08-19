// Text-signal matcher tests (protection engine, handoff decision #5).
// Behavior under test, from docs/keyword-research.md §5: seed list =
// dsojevic sexual+shock subset, obscenity-normalised (leetspeak/case),
// whole-word boundaries (Scunthorpe-safe), user-extendable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTextMatcher } from '../src/text-signals.mjs';

const m = createTextMatcher();

test('flags a seed sexual term regardless of case', () => {
  assert.equal(m.test('BLOWJOB tutorial'), true);
});

test('flags a multi-word seed variant', () => {
  assert.equal(m.test('blow job'), true);
});

test('flags algospeak supplement term', () => {
  assert.equal(m.test('let us talk about seggs'), true);
});

test('flags leetspeak evasion of a seed term', () => {
  assert.equal(m.test('s3ggs tips'), true);
});

test('does not flag embedded substrings (Scunthorpe problem)', () => {
  assert.equal(m.test('Scunthorpe United match highlights'), false);
  assert.equal(m.test('Sussex countryside walk'), false);
});

test('does not flag entries outside sexual/shock tags', () => {
  // "beaner" is racial-tagged only — protection engine scopes the seed
  // to sexual+shock (docs/keyword-research.md §5); slur filtering for
  // other categories is not this feature.
  assert.equal(m.test('beaner'), false);
});

test('clean text passes', () => {
  assert.equal(m.test('cute cat compilation part 3'), false);
});

test('empty and non-string input are safe and clean', () => {
  assert.equal(m.test(''), false);
  assert.equal(m.test(null), false);
  assert.equal(m.test(undefined), false);
});

test('user-added terms flag, and only for the matcher that has them', () => {
  const um = createTextMatcher(['crypto']);
  assert.equal(um.test('CRYPTO giveaway'), true);
  assert.equal(m.test('crypto giveaway'), false);
});

test('user-added terms are whole-word too', () => {
  const um = createTextMatcher(['corn']);
  assert.equal(um.test('corny jokes'), false);
  assert.equal(um.test('best corn recipes'), true);
});
