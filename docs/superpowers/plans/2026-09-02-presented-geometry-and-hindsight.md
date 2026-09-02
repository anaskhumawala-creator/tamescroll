# Presented geometry + hindsight rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** On YouTube, man mode, on his phone: a cleared man is not covered by his neighbour's patch, a dead coasting track is not presented, a track that earns a clear is not presented blurred for the interval before it, and a late verdict never lands after its frame.

**Architecture:** The delay presenter (1092+) draws from `track-timeline` snapshots, and `pushSnapshot` was handed the RAW tracker boxes -- so the render layer's padding, the R27 directional clamp (`clampPatchOffFaces`) and `mergeTracks` never reached the screen on any build with the presenter attached. Task 1 snapshots the DRAWN per-track geometry and merges at presentation. Tasks 2-3 add hindsight rules the delay line makes possible (a snapshot is presented ~1s after it lands, so the NEXT snapshot is usually known). Task 4 is an OTA A/B of `DELAY_MS`.

**Tech Stack:** app/gaze (ES modules, `node --test`), Redmi over CDP (`spikes/gauntlet/probe_events.py` + `events_reclass.py`), corpus bench (`bench/arch-arms.mjs`, control triple man 13.5/117.5/477.5).

**Evidence:** `spikes/gauntlet/events-linus55{,b,c}.json` (Redmi, 1094, NWoT1ZVd1Lo seek 55, 180s).

## Global Constraints
- Patches SOLID; one edge of one rectangle may move (R27); never a hole or a split.
- Every change monotone toward COVERING unless it is a hindsight rule whose evidence is stated.
- Tests red-proved. Constants verified in `app/src-tauri/gaze-page.js`. Opus critic before release. One build (1095).

---

### Task 1: snapshot the drawn geometry, merge at presentation
**Files:** `src/person-track.mjs` (+`presentTracks`, `mergePresented`), `src/track-timeline.mjs` (snapshot carries `core`, `face`, `flagCertain`, `coasting`; boxesAt carries `core`/`face`), `src/init-entry.js` (`pushSnapshot(..., presentTracks(videoTracks))`, boxesFn returns `mergePresented(b)`), tests `test/presented-geometry.test.mjs`, `test/delay-wired.test.mjs`, `test/track-timeline.test.mjs`.
- [ ] failing tests -> red -> implement -> green -> device A/B (`neighbour*` rows in events_reclass) -> commit.

### Task 2: hindsight clear (timeline rule 3')
A track in both A and B, no cut in (A,B], B `cleared`, A `blurred` with `flagCertain` false -> present `cleared`. Everything else unchanged.
- [ ] test red/green; device: `clearedButTimelineBlurred` -> 0, exposure rows unchanged; commit.

### Task 3: dead coast omitted in hindsight
At `pushSnapshot`, an id present in the previous snapshot and absent now, with no cut in between, has its trailing run of `coasting` entries marked `dead`. `boxesAt` omits a `dead` entry on either side.
- [ ] test red/green; device: presented coasting passes fall; commit.

### Task 4: DELAY_MS 1500 A/B (OTA, no build)
- [ ] plant 1500 on the Redmi, `probe_events.py` 180s, compare `verdictArrivalMinusPresented.nLate`, PSS; push `rules/tuning.json` only if PSS is flat.

### Task 5: critic, ledger, release 1095, CLAUDE.md, commit + push.
