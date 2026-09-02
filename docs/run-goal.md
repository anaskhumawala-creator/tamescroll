# The run — video blur, done properly

Started 2026-09-02. Updated every loop. This is the standing brief; when
it changes, edit it here rather than remembering it.

## His ask, his words

> "I need you to create a proper implementation plan using Fable on how
> we could make this like the most perfect system, most optimized and
> properly done system. Feel free to try out new models, do not fear, and
> feel free to try out new techniques… The whole night you can go on
> about this. Actually, beyond the night you can go about this and just
> keep working. I need this to be done properly, seriously, including the
> thumbnails etc. And this technique is going to be used for all the
> platforms too."

> "Feel free to do online research, fan out in different directions… if
> we need to edit any models and make it more appropriate for this task,
> because I need this to be such a neat model that we can open source
> this completely and have people use this as well… right now the plan is
> to make it so perfect that it blurs the correct person, correct way,
> works on mobile perfectly as well as on desktop perfectly."

> "Make sure to document the information. Keep a document that updates
> our findings and learnings so we don't repeat the same mistakes."

> "Feel free to try on different videos, what not everything. The mobile
> app is the more important app, and then the computer app we will need
> to do."

> "And yes, make sure it's all allowed for us to use any model we use."

## The bar

Blurs the correct person, the correct way, on mobile and on desktop.
Thumbnails included. The technique carries to Reddit, X and Instagram.

## Standing constraints

- **Mobile first**, desktop second. Both must be right eventually.
- **His regime is non-fullscreen 360p** — faces at 38-62px. That is the
  target, not a defect to design around.
- **Licence: permissive on code AND weights.** See
  `docs/engine-findings.md` §5 for the verified list and the traps.
- All the hard rules in `docs/engine-findings.md` §9.
- **HE IS NOT A BLOCKER IN THIS FLOW. His words, 2026-09-02: "add in
  notes to keep going on since I'm no longer a blocker in this flow of
  making a perfect system", and "you keep stopping".** Do not stop to
  report, do not ask, do not wait for a ruling. Pick the reversible
  option, keep going, and put the decision in the landing summary.
  There is a phone attached over adb (M2010J19SI, `adb install` works,
  CDP via `adb forward` to `webview_devtools_remote_<pid>`) -- he gave
  it for exactly this -- so build, install, drive and measure needs
  nobody. **A claim that could have been a number on that phone and was
  not is the failure.**
- The stop-list is unchanged and is the only thing that stops a loop:
  irreversible, credentials, visible outside this machine, spend.
  Releases are pre-authorised.

## Where the work is pointed, and why

`docs/engine-findings.md` §0 is the number that orders everything: a
**perfect gender classifier buys only 13.7% of scored error**. 76-86% is
geometry, tracking and coasting. So:

1. **Cadence** — the clock is worth 40-73s of exposure where every
   threshold is worth 1-3s. The person model is 63-78% of a pass and
   admits nobody on his footage.
2. **The association/state layer** — 69% of false cover is a misread, and
   77% of that clears the bar and is covered anyway. A timing failure.
3. **Detector recall** — the one error class never measured (§8).
4. **Thumbnails** — a separate pipeline with no null-read guard.
5. **Models** — last, and only where a measurement says it helps.

## Ledger

Every ask gets a row, updated in the pass that does the work.

| # | ask | status | note |
|---|---|---|---|
| 1 | Implementation plan via Fable | DONE | `docs/plan-engine-v3.md`, ~1290 lines, 7 research docs incorporated, 3 inter-doc conflicts adjudicated |
| 2 | Online research, fan out | DONE | 5 surveys: models, low-res gender, person detect, embeddings, runtimes |
| 3 | Verify every model is allowed | DONE | findings §5; traps recorded. Re-verify per model before adoption |
| 4 | Findings/learnings document | DONE | `docs/engine-findings.md`, appended each loop |
| 5 | Document the goal | DONE | this file |
| 6a | MoveNet letterbox (16b) | REFUSED ON MEASUREMENT | the inverse map is built, tested and SHIPS OFF (`PERSON_LETTERBOX`, emitted as `pde=!1`). At N=30 it read +28.9% admissions and that number reached a commit message; at **N=225 it is 373 against 373, exactly flat** (sign test p = 0.83). Retracted in findings 18. What survives: 8 frames where only the letterbox admits anybody against 1 (p = 0.039), and the map itself -- 315 matched people, median edge deltas 0.000, worst unclamped overshoot 0.024 against a 0.05 tolerance. `bench/movenet-held.mjs` (hysteresis on, contiguous runs) is the last arm that could revive it |
| 6 | Make the blur correct | IN PROGRESS | **The assignment layer shipped in 1091** (`src/assign.mjs`, Hungarian, cardinality-first). Corrected in his regime, `birthContended` is the LARGEST birth class (44-51%) and `birthFresh` the smallest -- E5's 74% fresh was the D2 cadence defect, fourth file. Optimal matching: man 22.5/136.5/547.5 against greedy's 23.0/139.0/561.0 (better on all three); woman pays 1.0s exposure for 35.0s phantom. 8us per pass. Findings 17/17a/17b/17c |
| 7 | Thumbnails | DONE (shipped 1085) | the null-read guard the video path has, ported and measured on banked ground truth first: 461 of 501 non-face flags removed (92.0%), 0 of 99 real faces uncovered, 0 of 141 opposite-gender reads uncovered |
| 8 | All platforms | PARKED | on his instruction, "i need you to atleast fix youtube first". The mapping is done and recorded (findings 16/16b/16c): the per-person pipeline is gated on three copies of `closest('#movie_player')` plus one helper, Reddit needs a shadow-aware host resolver, and the other three are login walls |
| 9 | Desktop parity | NOT STARTED | after mobile |
| 10 | Open-source-quality model | HELD | see the EU AI Act flag in findings §5 — releasing a standalone gender model is a worse legal posture than shipping it in the app. Releasing the engine is unaffected. His call. |
| 11 | Critic / feedback mechanism | DONE (design) | `docs/critic-loop.md`, 761 lines, 24 cited sources. Event-triggered, not interval -- the evidence says fixed intervals under-escalate. Wired into the loop brief above. `bench/critic-gate.mjs` BUILT and binding: **58 rows, 58 CONFIRMED** across phases A-F. It stopped reading rows whose id carried a suffix (`E5b`) and reported a clean bill on an open WRONG-NUMBER row; the id pattern is widened and an unreadable row now exits 2 rather than being skipped. **Phase F is the round that justifies the whole design**: 8 findings, and it caught an EXPOSURE inside the fix written that same session (F2, `unpadPersons` clamping keypoints that `parsePersons` consumes as differences -- headW 0.5133 -> 0.1600, patch top 0.0000 -> 0.3209) plus FOUR checks that could not fail. Findings 19 |

## Loop protocol

**Cadence: 25 minutes**, at his instruction ("you can increase the loop
duration to 25 minutes"). It is a session-only cron, so it dies with the
session -- **if the loop is gone, recreate it from the brief below.**

The tick brief:

1. Read this file and the tail of `docs/engine-findings.md` first. They
   override anything remembered.
2. Work in findings §0 order: cadence and the decision layer before
   models, because a perfect classifier buys only 13.7% of scored error.
3. Follow `docs/plan-engine-v3.md`. Stage 0-1 is zero-install -- he
   installs nothing.
4. Every claim becomes a number, on a device or on the labelled corpus.
   Verify shipped constants in the EMITTED bundle, never in source.
   Break an assertion to prove a new test can fail.
5. Run the critic (`docs/critic-loop.md`) on the events it names, and at
   minimum once per two ticks. Feed it the script-assembled packet,
   NEVER my own summary -- that is the finding the whole design rests
   on. OPEN rows tagged EXPOSURE or WRONG-NUMBER block a release.
6. Append anything durable to `docs/engine-findings.md` and update the
   ledger above in the SAME pass.
7. Commit and push. Releases are pre-authorised. Never report a device
   result that was not watched on a device.
