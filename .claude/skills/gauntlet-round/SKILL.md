---
name: gauntlet-round
description: Run one round of the tamescroll in-player blur accuracy gauntlet — capture player frames from a real YouTube video over CDP, score every frame by eye against the five failure classes, spawn a fresh adversarial critic, apply what survives, re-verify, and log the round. Use this whenever the task involves testing, verifying, scoring, debugging or improving the in-player gaze blur (gender blur, blur patches, blur boxes, overlays, person detection, MoveNet, faceres, person tracks), whenever the owner reports that the blur is inaccurate/blurring the wrong person/missing frames/floating boxes, whenever an overnight or looped accuracy run is requested, and whenever a scheduled gauntlet round fires. Also use it before claiming any blur change works — a green test suite is not evidence here.
---

# Gauntlet round

## 0. Take the lock, or leave

A round rebuilds the bundle, restarts the dev app and commits. Two
rounds running at once in one checkout corrupt each other's build and
race the same git index, so the first thing a round does is claim
exclusivity:

```
cd Z:/Apps/Disconnect/spikes/gauntlet
python lock.py acquire
```

If it prints `BUSY`, **stop immediately and do nothing else** — another
round is live and this tick is a duplicate. Say so in one line and end.
Do not "just check something quickly" while another round holds the
lock; that is how two builds land in one binary.

Release it when the round is done, including when it fails:

```
python lock.py release
```

The lock self-expires after 90 minutes so a crashed round cannot wedge
the loop forever.

## The round

One round is: **capture → score → critique → fix → re-verify → log**. Run
exactly one. Do not chain rounds inside a single invocation — the round
log is what gives the next round its starting point, and a round that
never logged is a round that has to be redone.

Read `spikes/gauntlet/GOAL.md` first, every time. It carries the owner's
bar in his own words, the five scored failure classes, the rotation
table, and the ROUNDS log. **The last ROUNDS entry is your input**: it
says which rotation entry was used, what changed, and what is still
open. Everything below assumes you have read it.

## Why this exists

Three releases shipped this week with a green test suite and a
completely broken blur. Unit tests verify the shape of the code; only a
frame verifies the product. The one bug that mattered most — a debug
probe throwing inside the verdict chain, silently discarding every
gender read for two releases — was invisible to every test and obvious
in one measurement. So the round is built around looking at pixels and
at the state behind them, together.

## 1. Capture

Pick the next rotation entry after the last one logged, wrapping at the
end of the table. You are free — encouraged — to invent new queries when
a failure class needs footage the table doesn't cover; a rotation that
only ever sees one kind of shot stops finding things. Add anything
useful back to the table. Queries stay ordinary and decent.

Resolve ids live. Never hardcode a video id — a guessed id is a dead
link or a video nobody vetted:

```
cd spikes/gauntlet
python gauntlet.py search "<query>" 5
```

Then capture, choosing a start offset likely to contain people:

```
python gauntlet.py runs/r<N>-<gender> <gender> <videoId> <startSec> 10 1.5
```

If CDP port 9223 is dead or the dev app is not running, restart it
DETACHED (never as a tracked background task — see WORKLIST.md; a live
tracked task keeps the session from ever reaching idle, which silently
kills every scheduled ping) and say so in the round log rather than
skipping the round. A skipped round
looks identical to a passing round in the log, which is the one thing
the log must never allow.

The harness sets the user's gender **before** the platform window boots.
That matters: the bundle reads `__TS_GAZE_GENDER` at boot, so flipping
it on a live page silently measures the same direction twice, and a
"both ways" run that only ever tested one way is worse than no run.

## 2. Score every frame

Read each PNG yourself. Not a sample — every one. For each frame, record
which of these it hits and name the exact file:

- **EXPOSURE** — any part of an opposite-gender person visible unblurred
- **PARTIAL** — a covered person with a limb, hand, foot or hair outside the patch
- **FALSE COVER** — a same-gender person carrying a patch
- **GHOST** — a patch over no person at all
- **DRIFT** — a patch lagging, floating or jittering off its subject

Cross-reference `meta.json` in the run directory. It holds the overlay
rects in video-normalized coordinates, the track states, the raw gender
reads and the pass costs behind each frame. A frame and its explanation
must never disagree; when they do, the explanation is the thing that is
wrong, and that disagreement is usually the bug.

Record `lastVerdictMs` / `lastPassMs`. Mobile is a first-class
constraint — a fix that buys a point of accuracy for double the pass
cost is not a fix, and the target is a Helio G88, not this desktop.

## 3. Critique

Spawn one Opus critic subagent, in the background, read-only on
`app/gaze/src` because you edit concurrently.

Its brief must differ from every previous round's. Tell it plainly what
earlier critics already concluded so it does not spend its budget
rediscovering them, then point it at something new — a different lens, a
different layer, a different question. Give it the round's real numbers
and real frames, not a summary; a critic reasoning about a paraphrase
returns opinions about the paraphrase. Web search is allowed and useful
for prior art.

Ask for mechanism and file:line, not impressions. A finding you cannot
check is noise.

## 4. Apply

Take what survives your own scrutiny. You are allowed to disagree with
the critic, but only by naming what breaks and under what input — and
when you do disagree, write the reason into the code as a comment, so
the next round does not re-litigate it. Several correct decisions this
week were reverted later by someone who had only the diff.

Two directions to hold in mind while fixing:

- **Blur-first**: unknown ⇒ covered. Exposure is the worst failure. But
  this is a tiebreaker for genuinely ambiguous frames, never a licence
  for GHOST — the owner counts a patch over furniture as a failure too.
- **Symmetry**: a fix that helps `man` and quietly breaks `woman` is a
  regression. Only one of the two paths is exercised by the baseline
  video, so this breaks silently and often.

Never let instrumentation throw inside the pipeline. Seed probe state
defensively and wrap anything optional. This has already cost two
releases.

Licences are hard limits: MIT/Apache/BSD only. Ultralytics YOLO — code
**and** weights — and abewley/SORT are AGPL/GPL and permanently banned.
Never copy HaramBlur.

## Visual recheck is the only proof of a visual claim

Owner, 2026-08-25: *"Always recheck before considering something done.
Visual rechecking is what I want, not just thinking and assumption."*

He said it the same hour it cost us. Every DOM probe reported the YouTube
end screen hidden — `display:none`, 0x0, on the exact selector the rule
targeted — and a screenshot showed twelve recommendation cards sitting
over his finished video. YouTube had reskinned the surface: the legacy
element our rule hides still exists and still measures hidden, while the
real cards render in new markup the rule had never heard of.

A computed style proves a RULE FIRED. Only a pixel proves the SURFACE IS
COVERED. Those are different claims, and the gap between them is exactly
where a reskin, a stacking-context bug or a z-index regression lives —
all three have shipped here.

So: capture the image and read it yourself before writing "done" about
anything visible. This applies to rules work as much as to blur work.

## 5. Re-verify

Rebuild and re-run the SAME round:

```
cd app/gaze && node build/build.js
touch ../src-tauri/src/lib.rs
```

Wait for the dev app to relaunch — poll until the `app` process start
time is newer than `lib.rs`'s modification time — then re-capture.

Confirm two things separately: the frames that failed now pass, **and**
the frames that were passing still pass. The second half is the one that
gets skipped, and it is how a fix for one shot becomes a regression in
another.

Then both suites, both green:

```
cd app/gaze && node --test test/*.test.mjs
cd app/src-tauri && cargo test --lib
```

Green suites are necessary, not sufficient. The frames are the evidence.

## 6. Log and commit

Append a ROUNDS entry to `GOAL.md`: round number, video and gender,
per-class failure counts **before and after**, what changed and why,
pass cost, and what is still open. Before/after counts are what make the
log useful — a round that only records what it changed cannot tell the
next round whether it helped.

Commit and push, then `python lock.py release`. Do not release an APK or
deploy anything outward-facing without the owner's explicit OK.

If a round finds zero failures across all five classes in both gender
directions on a video that actually contains people, say so prominently
and move to a harder rotation entry. Do not declare victory — one clean
video means the rotation is too easy, not that the problem is solved.
