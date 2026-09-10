// HOME IS EMPTY WHEN THE FEED IS HIDDEN (owner 2026-09-10: land on
// Subscriptions instead). With the shipped defaults the home grid is
// hidden, so "/" is a header, a nav bar and nothing else -- the first
// thing a user saw after the tile was a blank page. The launcher opens
// Subscriptions directly when the home surface is hidden; this helper
// covers the in-page routes to "/" (the logo, the Home tab) by asking
// whether the grid that IS on the page is drawn. Pure, so it is testable.
/** '/feed/subscriptions' when this is the front page and its grid is
 *  hidden, else null. `gridHidden` is null when there is no grid yet
 *  (still loading), which must NOT redirect: a page with no grid is
 *  not a page with a hidden grid. */
export function subscriptionsForHome(pathname, gridHidden) {
  var p = String(pathname || '');
  if (p !== '/' && p !== '') return null;
  if (gridHidden !== true) return null;
  return '/feed/subscriptions';
}
