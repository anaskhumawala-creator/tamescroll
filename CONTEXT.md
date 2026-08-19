# tamescroll — ubiquitous language

## Core model

- **Surface** — a distinct region of a platform's UI that can be hidden or
  shown as a unit (YouTube home feed, TikTok For You, Reddit r/all,
  watch-page related videos). Every surface starts **hidden**; the user
  may bring any non-always-on surface back. Defined by `!surface:`
  markers in rules files.
- **Always-on** — surfaces that can never be brought back: ads, promoted
  content, open-in-app nags. Not user-toggleable, on any level.
- **Bring back** — the only loosening mechanism. Loosening is always an
  explicit per-surface user act. There is no "hide more" direction:
  defaults ARE the maximum protection.
- **Protection dial** — the product stance: defaults are maximally
  cleaned; users of every discipline level self-select how much comes
  back. The app never nags, never locks, never escalates. (Owner,
  2026-08-19: "people are of different levels of discipline —
  accommodate every single level.")
- **Cleaned core** — what remains of a platform with all surfaces hidden;
  a platform ships only if this remains coherent and useful (the bar
  TikTok originally failed until Following/search/profiles was accepted
  as its core).

## Gaze

- **Gaze blur** — optional imagery blurring. Modes: **off**, **blur all**
  (Stage A, CSS-only), **smart** (Stage B, on-device face detection,
  blur-first then clear). Strength presets: Light/Medium/Strong.
- **Blur-first** — nothing may ever flash unblurred; detection only
  removes blur, never races it.
- **Fail-open (video)** — a video whose pixels cannot be read is released
  to play normally; the player is never punished for being unreadable.
- **Fail-closed (image)** — an image that cannot be verified stays
  blurred.
- **Player red line** — the media the user explicitly chose to play is
  never blurred, hidden, or degraded. Overrides everything.
