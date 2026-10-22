# Legal position (summary)

The full review, with sources, the store-policy table and the release plan,
is the Claude Doc "Tame Scroll: legal position and store release plan"
(https://claude.ai/artifact/DuFVPnAmXzVXfwCr6w7wF9), written 2026-10-22.
It is not legal advice; five questions in it are for a lawyer before any
store submission.

## The lines that keep us defensible

Each of these is a line another app crossed and was removed for. A change
that crosses one needs the owner's word and a lawyer's read first.

- Load the platform's own website in the system WebView. Never patch,
  repackage or hook a platform's app (the ReVanced / ProTube route).
- Never use a platform's API, and never download, save or convert media.
- Never copy, store or send what the user sees. Filtering happens on the
  device and keeps nothing; diagnostics never contain URLs.
- Never ship code over the air. Rules travel as JSON only (also Play's
  self-update rule).
- Never use a platform's logo, icon shape or brand colour as ours. Names
  in plain text, to say what we work with, are fine.
- Never infer anything about a person beyond the user's own filter choice
  (no race, religion or identity; per-race calibration stays refused).

## The open exposures, in order

1. Ad blocking on YouTube: YouTube said in April 2024 that third-party
   apps may not turn off ads. Brave survives on the stores as a general
   browser; we open six hardcoded platforms.
2. Store "authorization on request" rules (Apple 5.2.2, Play Webviews):
   Juno, a CSS-only YouTube web view, was removed under 5.2.2 in 2024.
3. The gender filter: EU AI Act Annex III and Illinois BIPA questions.
4. The red play shortcut icon and brand-colour tiles (trademark).

The public statement lives in `web/index.html` (#platforms) and the
privacy policy in `web/privacy.html`. Keep both true: when the app's data
flows change, change `web/privacy.html` in the same PR.
