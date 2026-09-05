# Front door: onboarding, link ownership, reskin (1108)

Owner rulings 2026-09-05 (grilled, all answered):

- Scope: full reskin of launcher + settings + onboarding, on the current
  identity (dark warm, gold accent, Spectral wordmark, Inter UI). No new
  direction boards.
- Onboarding keeps the gender and image-mode steps, copy tightened.
- Link ownership is YouTube-only this round. Other platforms earn it
  after a measured pass each.
- The link flow lives as an onboarding step AND as a home card that
  shows state and re-enters the flow.
- YouTube app: offer uninstall, never require it.
- Pin a YouTube home-screen shortcut as an offered step.
- Done-state: read it from the OS if the API allows; fallback is a
  self-test link that must land in tamescroll.
- Process: spec + plan in docs, build unattended, verify on his phone,
  ship 1108.

"WhatsApp links" = a YouTube link tapped inside WhatsApp (or any chat).
Same VIEW resolution; no WhatsApp tile.

## The measured constraint the flow is built on

On his Redmi (Android 16, MIUI) YouTube's links are `system_configured`.
A bare youtu.be tap opens the YouTube app in every state of OUR package.
The only working recipe: YouTube's master "Open supported links" OFF
plus ours ON. `pm disable-user` on YouTube is refused by MIUI. Android
gives no API to set either toggle; it gives one to open the exact page
for any package.

## The link flow (Android only, shown only when YouTube is chosen)

One view, `#view-links`, reached from onboarding (after the image-mode
step) and from the home card. Five rows, first three required for the
done state, last two offered:

1. **Turn off YouTube's links.** Button opens
   `ACTION_APP_OPEN_BY_DEFAULT_SETTINGS` for `com.google.android.youtube`.
   Copy tells the user which switch to flip: "Open supported links" off.
2. **Turn on tamescroll's links.** Same intent for our package; flip on.
3. **Test it.** Fires `ACTION_VIEW https://youtu.be/jNQXAC9IVRw?ts_probe=1`
   from our package. Lands back in tamescroll (singleTask, onNewIntent)
   = owned; the app records it and opens the video. Lands in YouTube =
   not owned; nothing recorded.
4. **YouTube on your home screen.** `requestPinShortcut` of our existing
   static `youtube` shortcut (our glyph, never the logo).
5. **Remove the YouTube app.** Opens YouTube's app-info page.

Each row shows a tick when its state is known. State comes from
`TsLinks.state()`: `DomainVerificationManager.getDomainVerificationUserState`
for both packages (needs `<queries>` visibility for YouTube; if the read
throws, the field is null and the row falls back to the probe result).
`owned` = probe landed OR (ours has youtu.be selected AND YouTube's
master toggle is off).

Home card "Links": "YouTube links open here" with a tick, or "YouTube
links still open in the YouTube app" with a Set up button. Hidden on
desktop and when YouTube is not chosen.

Onboarding commits its choices BEFORE the link step, because the probe
reloads the launcher page (a link arrival navigates the webview).

## Reskin

Tokens: one type scale (11/12.5/14/15/17/22/28), one spacing scale
(4/8/12/16/24/32/48), radii 10/14/20. Mobile-first at 360-412px, the
desktop layout is the same page with more room. Every screen: a header
row (title left, action right), content, one primary action at most.
Tiles: glyph + name + one-line note, 2-up on phone. Settings: nav as a
segmented scroller on phone, sidebar on desktop, panes as stacked cards.
Onboarding: step counter "2 of 6", Back link on every step after the
first, one primary button per step, cards as radio-styled options with a
selected state. No platform logos, no brand colours.

## Not in this round

Other platforms' link ownership; Play build variant (queue item j);
protection levels (still undecided by him); any Rust change beyond what
the probe url needs.

## Verification

- `tsc` + vite build clean; cargo and gaze suites unchanged.
- On his phone over adb+CDP: onboarding walked end to end; each button
  lands on the right system page (screenshots); probe with YouTube's
  master toggle off (set via `pm set-app-links-allowed`, reverted after)
  lands in tamescroll and the card flips to owned; probe with the
  toggle on lands in YouTube and the card stays not-owned; home card
  re-enters the flow; pin shortcut prompt appears.
- Screenshots of launcher, settings panes and each onboarding step on
  the phone, judged against the spec.
- Release 1108 by the recipe, hash-verified.
