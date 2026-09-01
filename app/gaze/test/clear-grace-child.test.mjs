// A GRACE FOR AN UNREADABLE ADULT IS NOT A GRACE FOR A CHILD.
//
// person-track's clear grace holds one rung after a certain clear read,
// and used to refuse EVERY abstention because one kind of abstention is
// a child. The other kind is an adult face the model could not read --
// the case the grace already forgives for a plain non-certain read.
//
// These tests exist because the child half is a protection decision:
// holding a rung on a child read keeps a clear alive over her, and she
// is the one class the pipeline openly declares untrustworthy.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { faceMeta } from '../src/gender-verdict.mjs';

const entry = fs.readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
const track = fs.readFileSync(new URL('../src/person-track.mjs', import.meta.url), 'utf8');

test('a child read is tagged childAbstain; an unreadable adult is not', () => {
  // A directed read the age head calls a child.
  const child = faceMeta('man', [{
    gender: 'female', raw: 0.2, score: 0.6, age: 9, childP: 0.9, nm: 11, px: 120,
  }])[0];
  assert.equal(child.abstained, true, 'a child read must abstain');
  assert.equal(child.childAbstain, true, 'and must be named as a child abstention');

  // A null read: the model returned its prior, age pinned near 37.
  const unreadable = faceMeta('man', [{
    gender: 'male', raw: 0.62, score: 0.24, age: 37, childP: 0.06, nm: 2.1, px: 120,
  }])[0];
  assert.equal(unreadable.abstained, true, 'a null read must abstain');
  assert.ok(!unreadable.childAbstain,
    'an unreadable adult must NOT be tagged a child, or the grace refuses it too');
});

// THE FIELD-DROPPING FAILURE, TWICE IN THIS REPO'S HISTORY.
// `abstained` and `nullMint` were each shipped in gender-verdict and
// person-track with the observation builder never copying them, so the
// consumer was unreachable for two releases and a green suite could not
// see it -- the unit tests hand observations straight to
// updatePersonTracks. This asserts the wire, not the behaviour.
test('the observation builder carries childAbstain through', () => {
  assert.match(entry, /childAbstain: !!mine\.childAbstain,/,
    'the builder drops childAbstain, so the grace can never tell a child apart');
});

test('a child abstention still spends the rung unconditionally', () => {
  const i = track.indexOf('function graceSpend');
  assert.ok(i > 0);
  const body = track.slice(i, track.indexOf('\nfunction ', i + 10));
  assert.match(body, /obs\.childAbstain[\s\S]{0,40}return 1;/,
    'a child abstention must always spend the rung');
  // And the no-face term must still spend unconditionally: that is the
  // substitution case (back-turned, walked-in, swapped) the grace's own
  // exposure note names.
  assert.match(body, /obs\.faceFound === false/,
    'a pass that found no face must still spend the rung');
});

test('the grace still requires a clear-certain read in THIS shot to have paid for it', () => {
  const i = track.indexOf('function graceSpend');
  const body = track.slice(i, track.indexOf('\nfunction ', i + 10));
  assert.match(body, /lastVerdict === 'clear-certain' \? 0 : 1/,
    'an unreadable adult may only hold a rung a certain clear actually earned');
});
