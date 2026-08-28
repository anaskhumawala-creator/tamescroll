# Recurring pain points — diagnostic pass, 2026-08-28

Question asked: which complaints has the owner made MORE THAN ONCE, across
sessions, and why did the earlier fixes not stop him making them again?

Sources mined: CLAUDE.md session log (owner quotes are verbatim there),
docs/owner-issues.md (rows #1-32), docs/VISION.md, `git log --oneline -200`,
docs/handoff-2026-08-27-perf.md, spikes/gauntlet/GOAL.md, and the current
uncommitted tree (worker video pipeline in app/gaze/src/init-entry.js,
clipToBounds + feather=0 in app/gaze/src/video-region.mjs).

Recurrence categories used below:
(a) fix addressed a symptom, not the mechanism ·
(b) fix correct but never reached his device (release/OTA/verification gap) ·
(c) fix traded against another of his complaints; pendulum ·
(d) never really fixed, only measured/probed ·
(e) fix right, platform/hardware is the limit.

---

## 1. Blur patch look — "messy, jittery, low quality" (≥9 raisings, 4 dates) — category (c), with one (a)

**His words, in order:**
- 2026-08-24 (v1011 round): "laggy / patch trails", "jittery, corners
  distorting", "double triple blur don't look good, merge it".
- 2026-08-26: "very messy and not smooth and very jettery... looks very low
  quality", "the before gauntlet blur was the best", "the square edges
  should not have been shown and a nice blur" (first phone screenshot),
  "multiple boxes here and there", later "weird face cutouts in the blur".
- 2026-08-27: "the in video blur I think needs sharpur blur edges because
  right now it looks a bit low quality"; then "I wanted more sharper blur
  in video as well the outline extra so it looks for polished"; then "the
  invedio blur looks very unpolished unlike the thumbnail blur".
- 2026-08-28: "I'm fine with fully hard rectangle with rounded
  corners/edges since it looks higher quality" — the feather turned OFF.

**What was changed each time:** v1011 translate-only overlay + lerp
(session log); commit `ada32d1`→`3185b99` stability series S1-S13
(mergeTracks re-union, MOVE_DEADBAND, margin cuts); feather introduced S4
(`69f036e`), pixel-cap bug fixed S7 (`c83e1ee`), halved 0.10→0.05
(2026-08-27), cut again 0.05→0.03, now 0 (uncommitted). The whole saga is
written as comments in app/gaze/src/video-region.mjs:209-335; the settled
values are `FEATHER_FRAC = 0` (line 333) and `BLUR_FRAC = 0.09` /
`BLUR_MAX_PX = 72` (lines 363-364, shipped 1023, commit `cbbedea`).

**Why it recurred — (c), pendulum, documented in the source itself.** The
gauntlet accuracy rounds kept changing the geometry UNDER the cosmetic
dials. video-region.mjs:283 says it outright: "HALVED, 2026-08-27, and the
margin arithmetic above is now STALE... 0.10 was chosen when the drawn box
carried PATCH_MARGIN 0.08 + PTRACK_PAD 0.10 + a flat 0.089 keypoint margin
— this session cut all three, so the SAME fraction now spends a much larger
share of a much tighter box on gradient." Every feather width was correct
for the build it was tuned against and wrong in the next one, because
accuracy work (his "not a single frame" bar) and look work (his "polished"
bar) share the same rectangle. Four moves of one dial across three days is
the pendulum, not four bugs.

One genuine (a) inside the cluster: "low quality" was read as an EDGE
problem twice (feather cuts) before 1023 found it was the INTERIOR — the
patch got a thumbnail's absolute radius over a 5x bigger picture, leaving
"two body-sized blobs" (video-region.mjs:339-356). The first two edge
fixes were treating the wrong variable.

Second sub-failure, process-shaped: holes and splits shipped TWICE after
being rejected once ("multiple boxes here and there" = subtractBox; "weird
face cutouts" = the R24 mask hole), which is why the project CLAUDE.md now
carries the "Blur patches are SOLID (said twice)" section.

**Highest leverage:** the dial is now settled by the owner on real
hardware — freeze the look constants (FEATHER_FRAC=0, BLUR_FRAC=0.09,
border-radius 8) as a named contract, and make every future accuracy round
report the existing look metrics (breathe/s, dCount/s, patch count) so a
geometry change that will move the look is caught BEFORE he screenshots it.
Never re-litigate solid patches or the hard edge.

---

## 2. Slowness — "loads a lot / it halts / make it instant" (≥8 raisings, 5 dates) — category (b) shading into (e)

**His words, in order:**
- 2026-08-22: "lot of loading" (#1); in-video blur perf must be "very well
  optimized" (#8).
- 2026-08-22/23: app "loads a lot" after clicking a video (#9).
- 2026-08-25: "be sure to make it optimized and performance oriented as
  well. That is the only way this app would be helpful" (#21).
- 2026-08-24: "lagging + hit-and-miss, set a Fable instance to analyze".
- 2026-08-27: "it's processing multiple together but the speed is still
  much less compared to the speed that someone scrolls... it processes
  some, then it halts, then it takes time to process the next"; standing
  instruction "Just make all interactions feel seamless as well and
  instant and responsive."

**What was changed each time:** a long, real, measured series — v1010
pipeline redesign (20-35 inferences/s → 4Hz + interpolation), WEBGL
shader-uniform flag, batched gender + JS NMS, hidden-tab drain gate,
scriptlet-gap fix for the 4.4s watch stall, then the 2026-08-27 trilogy
(1025-1027: idle-callback 28s late → 2.2s; double decode of every
thumbnail removed via `preflightCors`, init-entry.js:1149; serial drain,
worst image 11.0s → 649ms), then the Worker (`b0ebef1`): inference off the
main thread entirely — and TODAY (uncommitted) the video/player pipeline
followed it (`workerVideo()`/`banWorkerVideo()`/`runPass`,
init-entry.js:392-436, 1498-1521; the page loads zero models when the
worker is alive).

**Why it recurred — two compounding reasons.**
- **(b) Nothing has ever been measured on his device.** The session log
  says it plainly: "All numbers below are DESKTOP at a 6x CPU throttle;
  nothing was measured on his device (no adb to it — the phone is
  remote)." docs/handoff-2026-08-27-perf.md item 3: "Android re-evals the
  22MB bundle and re-loads every model on each page load. Nothing measured
  on real hardware. This is probably the largest remaining term in what
  the owner feels." His Helio G88 is the ONLY place the complaint exists
  and the only place no number has ever come from. Every "fixed" was a
  desktop proxy claim. On top of that, fixes repeatedly sat unreleased
  when he retested: "29+ commits since v0.1.14 with no release, so the
  phone has none of it" (08-25); "Committed but NOT released: 752cba8...
  The phone does not have any of this" (08-27 handoff).
- **(e) underneath:** after the mechanism bugs were peeled, "the ceiling is
  now per-image cost (61ms desktop, ~370ms at 6x), and the models are
  fixed-input, fixed-batch" — the next cut is a smaller face model, an
  accuracy call only the owner can make. Three measured dead ends
  (cross-image batching, URL verdict cache, scroll budget fraction) are
  already recorded so they don't get retried.

**Highest leverage:** close the measurement gap, not another desktop
optimization. Ship an on-device diagnostic he can trigger himself — the
`__TS_GAZE_IMGDIAG` ring already exists (handoff §probe_imgdiag); surface
it as an in-app debug card he can screenshot (per-image ms, queue depth,
worker alive y/n). One screenshot from the G88 is worth more than another
6x-throttle A/B, and it converts every future perf complaint from a vibe
into a number.

---

## 3. Wrong person blurred / both genders blurred (≥6 raisings, 5 dates) — category (a): thresholds tuned over broken inputs

**His words, in order:**
- 2026-08-22 (#7): "both genders face-blurred even with 'male' selected".
- 2026-08-23 (phone round 3): both-genders again on slow devices.
- 2026-08-24: "still blurs Linus sometimes" (said in two sessions); "males
  re-blurred"; "random blurs on text/planks/shirts"; "small subjects
  missed"; the daughter close-up fully sharp (EXPOSURE).
- 2026-08-25 (the bar, GOAL.md verbatim): "there isn't a single frame that
  the other gender is visible and there isn't a single frame where the
  wrong gender is blurred up".
- 2026-08-28: owner screenshot of a clear front-facing man covered on a
  thumbnail.

**What was changed each time:** gender-ssrnet was found broken upstream
(`data[1]=undefined` → every face flagged) and replaced with mini-Xception
(2d58f1b); mini-Xception's bands overlapped and misgendered → replaced
with faceres (v1007); v1009 per-person zoom classify, whose FIRST version
square-stretched the crop and re-blurred Linus; the age head wired in
(v1010, the child fix); GENDER_CLEAR_SCORE asymmetry; and finally
2026-08-28: **the image path's crop had been stretched the whole time** —
cropAndResize squashed the detector box into 224x224, so faceres read a
distorted face on every thumbnail; a clear man read `male` at 0.06.
Aspect-preserving crop landed in app/gaze/src/detector.js (the `square`
option, lines 521-545), and GENDER_IMAGE_MIN_SCORE moved 0.12 → 0.4.

**Why it recurred — (a), and specifically a fix-the-instance failure.**
detector.js:541-542 admits it: "square in PIXELS reaches faceres as a
stretched face. The video path learned this in v1009 (a square-stretch
crop...)". The same defect was found and fixed in the VIDEO path on
2026-08-24 and lived on in the IMAGE path until 2026-08-28 — four days and
three model swaps later. Meanwhile every threshold (0.85, 0.25, 0.12) was
calibrated against distorted inputs, so each calibration was correct for a
broken pipeline and wrong for a fixed one. The model was blamed twice
(ssrnet genuinely was broken; mini-Xception partly was) when the
longest-lived defect was the input crop. This is exactly the "fix the
class, not the instance" rule in the global CLAUDE.md, violated on its
best-documented example.

**Highest leverage:** input-integrity fixtures. A small golden set (known
male/female faces at known sizes) run through BOTH the image and video
crop paths in the test suite, asserting (i) the crop reaching faceres is
aspect-correct and (ii) gender scores land in known bands. Any future
preprocessing defect then fails a test instead of surviving three
threshold recalibrations.

---

## 4. Patches where they don't belong — stray/ghost/misplaced overlays (≥5 raisings, 4 dates) — category (a): one class, five per-surface fixes

**His words, in order:**
- 2026-08-22 (#5): blur boxes "where they don't even belong".
- 2026-08-23 (#14): "blur shows above the menu or a title"; plus stale
  overlay coords after a thumbnail tap (SPA nav).
- 2026-08-25 (#19/#20): "there shouldn't be any frame that is being
  blurred which has no human at all"; "make an instance where the
  detection tells you there are no humans... and you don't have the blur";
  "random floating boxes".
- 2026-08-28: phone screenshot — image patches drawn across a PLAYING
  preview "describing nothing on screen"; and (today, uncommitted) a patch
  painting over the page below a scrolled sticky player.

**What was changed each time:** document-anchored overlays + heartbeat +
snap guard (probe32/33); clampToInset for the fixed topbar (probe48,
v1003); fixed→absolute anchoring because position:fixed re-anchors to
transformed ancestors (v1006 — the reason in-video blur "never worked");
250ms heartbeat for SPA nav (phone round 3); wipeIfEmpty + coast cut
3000→900ms (#20); preview stand-down — which THEN didn't fire because it
watched `ytm-video-preview` while m.youtube reuses `#movie_player`
(v1030, `eca278e`); and today `clipToBounds`
(app/gaze/src/video-region.mjs:779, applied at 846) clipping every drawn
patch to the video rect.

**Why it recurred — (a).** Every instance is the same class: a
DOM-anchored overlay whose validity depends on live page state (ancestor
transforms, sticky headers, SPA navigation, shared player elements,
scrolled sticky containers), and each fix patched ONE invalidation path
after the owner photographed it. The preview stand-down is the sharpest
example: the fix for "patches over a playing preview" shipped one session
earlier and matched zero elements, because it guessed the preview host
instead of the class-level fact already recorded in rules/youtube.txt
(m.youtube reuses the shared player). `clipToBounds` is the first
invariant-level fix in the series — it bounds a whole family of escapes
rather than one.

**Highest leverage:** finish the generalization clipToBounds started: a
single per-heartbeat validity invariant for every patch — host element
exists, is visible, patch rect intersects the host rect, and playing-state
is consistent — with one kill-switch path. New surfaces then inherit
containment instead of each earning its own screenshot-shaped fix.

---

## 5. Ads came back (4 raisings, 3 dates) — category (a) stacked, worsened by (b); (e) at the frontier

**His words, in order:**
- 2026-08-20: "ad blocking does not work at all" (phone round 1).
- 2026-08-23 (#12): "why did ad come up" (desktop watch).
- 2026-08-25: "Again ads came" / "still ads come"; (#23) "ads started
  appearing again, which was unprecedented... ads are the biggest issue we
  have. Why were they able to get through?"

**What was changed each time:** 08-20 — Android had never received engine
cosmetics + scriptlets at all (universal script carried surfaces CSS only);
page_load_rules_script added. 08-23 — scriptlet gap identified
(docs/scriptlet-gap.md), request-shaper shipped v1004. 08-25 (#23) — the
engine had NEVER done network blocking: since Phase 2.5 the code only
called `url_cosmetic_resources`; `blocks_request()` + WebView2/JNI
interception wired then. Same day — two scriptlets clobbered each other
(unconditional defineProperty on one global; last emit destroyed the rest)
and SABR "fake buffering" was defeated by dropping streamingData —
**desktop only**; m.youtube deliberately kept the old field list.

**Why it recurred.** (a) stacked: "ads" is four independent mechanisms —
cosmetic hiding, network request blocking, response-shaping scriptlets,
and stream-level (SABR) — and each session discovered a whole mechanism
silently absent or self-defeating, fixed that one, and said done. The
worst was structural: network blocking not being wired was invisible on
the emulator "which never got served ads". (b) amplified it: when he
retested on 08-25, "29+ commits since v0.1.14 with no release, so the
phone has none of it" — correct fixes existed and were not on his device;
and the OTA cache SHADOWS local rules edits, which "cost hours" of
false verification. (e) is real at the frontier: this is an arms race
(ReVanced's client spoofs breaking, uBO conceding Facebook sponsored
posts on 2026-08-10, per VISION.md), so some recurrence is permanent.

**Highest leverage:** two things. (i) Treat any ad fix as undone until it
is RELEASED and phone-confirmed — this cluster has the highest cost per
recurrence ("the biggest issue we have") and has twice been "fixed" into
an unreleased commit. (ii) The m.youtube SABR gap is still open by design
("m.youtube keeps the old field list until phone numbers exist") — that is
a known remaining path for "ads came again (mobile)"; schedule the phone
measurement instead of waiting for the complaint.

---

## 6. "You said done and it wasn't" — the meta-complaint (≥4 raisings, 3 dates) — category (d)

**His words:**
- 2026-08-23: "keep track of all the issues I am mentioning and take upon
  them".
- 2026-08-25, restated harder: "everything I tell you, I need you to
  consider it and have a place for it, and never skip it" (#30 — the
  tracker had stalled at #14 for two days while a dozen asks lived only in
  conversation).
- 2026-08-25 (#31): "Always recheck before considering something done.
  Visual rechecking is what I want, not just thinking and assumption."

**Why it recurred — (d), and it is the engine under clusters 2 and 5.**
The canonical case is #28: the end-screen fix hid the legacy element,
every DOM probe agreed (`display:none`, 0x0, exact selector), and his
screenshot showed twelve recommendation cards in reskinned markup — "a
computed style proves a RULE fired; only a pixel proves the SURFACE is
covered." The same shape: v1005/v1004 rows marked "FIX-SHIPPED
(phone-verify)" whose phone-verify never closed; probe artifacts (lazy
imgs with no src counted as "cleared", probe35) that cost half a session.
Fixes were verified against a proxy — a probe, an emulator, a desktop
throttle — and the proxy diverged from what he sees.

**Highest leverage:** the countermeasures exist (owner-issues.md
row-first rule, the pixel rule in the gauntlet skill); the remaining gap
is the DEVICE half — see cluster 2's on-device diagnostic. Every cluster
above recurred at least once purely because the proof lived on the wrong
machine.

---

## Cross-cutting judgement

Three systemic causes explain nearly all recurrence; the individual fixes
were overwhelmingly real:

1. **The proof lives on the wrong machine.** The phone is remote, has no
   adb, produces no numbers, and has repeatedly lacked the fix being
   retested (29+ unreleased commits on 08-25; 752cba8 unreleased on
   08-27). Clusters 2, 5, 6 directly; 1 and 3 partly. One on-device,
   owner-triggerable diagnostic is the single highest-leverage build in
   this document.
2. **Accuracy and look share one rectangle.** The gauntlet moved geometry;
   every cosmetic dial tuned before a geometry change was wrong after it
   (video-region.mjs:283 says so verbatim). Now that the owner has settled
   the look on real hardware, future accuracy work must carry the look
   metrics as a regression gate.
3. **Instance fixes over class fixes.** The stretched crop fixed in the
   video path (v1009) survived four more days in the image path; five
   overlay escapes each got a bespoke patch before clipToBounds; three ad
   mechanisms were discovered absent one complaint at a time. The global
   CLAUDE.md already names this rule; this file is its evidence log.
