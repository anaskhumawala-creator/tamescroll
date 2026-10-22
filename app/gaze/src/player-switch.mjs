// THE WATCH PLAYER'S BLUR SWITCH: what state a video starts in, and what
// a viewer's tap means for the rest of that video.
//
// His ruling 2026-10-22: "phones keep the blur just off by default and
// labelled in beta". On a phone the person pipeline is the lag he feels,
// and he was switching it off on every video anyway, so the watch player
// starts OFF there and the pill (marked Beta) is one tap to turn it on.
// Desktop is untouched: it has the headroom and starts ON.
//
// Feed previews are NOT the watch player's video and keep blur-first:
// a preview plays because a thumbnail scrolled past, not because he
// chose it, and it is covered whole for the cost of nothing.

// 1 = a phone's watch player starts with video blur off. 0 = it starts
// on, as every build up to 1120 did. Exposure dial, his call either way.
export var PLAYER_BLUR_START_OFF = 1; // OTA [0, 1]; his ruling 2026-10-22, ships 1
export function setPlayerBlurStartOff(v) {
  PLAYER_BLUR_START_OFF = v;
}

/** Is this user agent a phone build (the Android app's WebView)? */
export function isPhoneUa(ua) {
  return /Android/i.test(String(ua || ''));
}

/**
 * Should the player's blur be on right now?
 *
 *   watchId  the /watch?v= id on screen, or null off the watch page
 *   choice   the viewer's last tap, { id, on }, or null
 *   phone    true on the Android app
 *
 * A tap holds for the video it was made on, through every stream reload
 * (ad, quality, fullscreen); a different video goes back to the default.
 */
export function playerBlurWanted(watchId, choice, phone) {
  if (watchId === null || watchId === undefined) return true;
  if (choice && choice.id === watchId) return !!choice.on;
  return !(phone && PLAYER_BLUR_START_OFF > 0);
}
