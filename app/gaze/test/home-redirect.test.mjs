import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionsForHome } from '../src/home-redirect.mjs';

test('the front page with a hidden grid goes to Subscriptions', () => {
  assert.equal(subscriptionsForHome('/', true), '/feed/subscriptions');
  assert.equal(subscriptionsForHome('', true), '/feed/subscriptions');
});

test('a drawn grid, or no grid yet, stays put', () => {
  assert.equal(subscriptionsForHome('/', false), null, 'the user brought the feed back');
  assert.equal(subscriptionsForHome('/', null), null, 'still loading is not hidden');
  assert.equal(subscriptionsForHome('/', undefined), null);
});

test('only the front page redirects', () => {
  for (const p of ['/watch', '/feed/subscriptions', '/results', '/channel/x', '/shorts/abcdef'])
    assert.equal(subscriptionsForHome(p, true), null, p);
});
