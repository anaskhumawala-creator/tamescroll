# Independent audit: in-player live-blur pipeline (v1007–v1009)

Auditor: separate Fable instance, read-only, adversarial brief. Verbatim report.

## Verdict up front

The owner's "hit and miss" report is not a tuning problem. It is the **expected steady-state behavior of this architecture**: five asynchronous detection sources at three different cadences race into one tracker through ~15 interacting thresholds, and every inference, pixel readback, and shader compile runs on the page's main thread — the same thread YouTube's player uses to feed the video decoder. Lag and inconsistency are two symptoms of one design. Another night of threshold patches will not converge; the patch history proves it (each of the last 8 mechanisms was added to cancel a side effect of the previous one).

## A. Ranked root causes — LAG

**1. All inference on the page main thread, no worker.** `init-entry.js` runs BlazeFace + faceres + MoveNet + zoom crops in-page. YouTube's watch page runs its MSE buffering, ABR logic, and UI on that same thread. Every 140ms sample steals a burst from it; every 3rd sample steals a much bigger one. On a phone this starves `appendBuffer` → rebuffering; on desktop the RTX 3060 Ti is irrelevant because the bottleneck is main-thread JS scheduling inside a WebView2 page, not GPU throughput.

**2. The every-3rd-sample burst.** Sample N%3==1 serially chains: person canvas drawImage+getImageData (256²) → MoveNet execute (~30ms warm) → up to 4 zoom crops, each drawImage from native-res video + getImageData + BlazeFace + faceres (`zoomClassifyPersons` runs them **serially**) → then the normal full-frame BlazeFace + gender. Up to **11 model executions plus 6 GPU→CPU canvas readbacks in one burst**, easily 100–300ms of main-thread occupancy every ~420ms. Matches "lagging" arriving with v1008/v1009 — v1007 had 2 inferences/sample; v1009 has up to 11.

**3. Synchronous `getImageData` video readbacks.** Every sample ≥1 256² getImageData; a person-pass sample up to 6; each low-conf suspect adds another via `recheckSmallFace`. Each is a forced synchronous GPU→CPU copy on the main thread. Steady-state **~20–35 inferences/second**.

**4. The overlay rAF loop layout-thrashes.** `video-region.mjs` loop() reads two getBoundingClientRects then writes 4 style properties per overlay, every frame, 60Hz, forever while boxes exist. Write-then-read forces synchronous layout each frame. Plus the 500ms heartbeat and 1s pill watcher.

**5. Large `backdrop-filter` patches over a playing video.** expandToBody torso +6.0 face-heights → patches span head-to-frame-bottom; mergeOverlapping unions them larger. 24–28px backdrop blur over half the video is recomposited every video frame; worst on Helio G88.

**6. Cadence jitter compounds tuning.** `sampling` serializes, so burst samples push effective rate to ~3–5Hz irregular. Every temporal constant in track.mjs is annotated "@7Hz" — they silently stretch when the pipeline is slow: **the worse the lag, the longer wrong blur states persist**. Lag and hit-and-miss are coupled.

(Correction to the brief: sample canvas is 256px, not 128 — INPUT_SIZE=256 in detector.js. Readbacks 4× costlier than docs assume.)

## B. Ranked root causes — HIT-AND-MISS

**1. Two verdict qualities alternating at different rates.** Samples 1,4,7… get native-res zoom gender verdicts (good); samples 2-3, 5-6… get gender read from a face crop upscaled out of the 256px stretched full frame (poor — small faces ~20px there). The two disagree systematically on small subjects. `zoomFresh` replaces detections only on the person-pass sample; the two intervening samples re-inject the low-quality read. Gender memory (3 certain clears) never charges because small faces rarely produce certain full-frame reads. This is the exact mechanism of "still blurs Linus sometimes" — a 2.4Hz/7Hz beat frequency; no threshold fixes a beat frequency.

**2. Stale person boxes gate fresh faces.** `personBoxes` is up to ~0.4s stale (worse under lag) and survives pass failures indefinitely. On any pan/cut: (a) real ambiguous faces fall outside stale regions → gateDetections drops them → **no blur on the subject**; (b) a stale person region now containing no face → facelessPersons → phantom backside patch → **blur on nothing**. Both owner symptoms from one staleness bug.

**3. No hysteresis on the output.** Rendered patch set recomputed from scratch every sample: flaggedBoxes → expandToBody → padBox → mergeOverlapping → setBoxes. A track crossing MIN_HITS, a merge topology change, a static-suppression trigger, or a certainty flip at the 0.25 boundary each instantly changes patch count/geometry. Four separate gates can flip a verdict (gate, torso-ghost, static suppression, MIN_HITS); none is damped at the render boundary.

**4. Greedy nearest-neighbor association swaps identities.** SNAP_DIST 0.18 greedy: two people near each other (Linus + daughter) can swap tracks on one jittery detection; flag/clear histories trade bodies. Gender memory then actively works against you — memory attached to the wrong person.

**5. Coasting drifts wrong.** 8-miss velocity coast (~1.1s+, longer under lag): on a direction change the patch slides where the person was going; on a cut, a coasting flagged track paints whoever is now at those coordinates.

**6. expandToBody+mergeOverlapping amplifies every error.** One phantom face → full-height body column → union with a real patch → one giant patch covering both subjects. The v1009 merge traded "stacked rectangles" for "wrong things share one huge rectangle."

## C. Owner pattern — can patching converge?

No. The arc (small misses → phantom blurs → "remember the person" → backside → "humanoid" → "worse, inconsistent" → "merge it" → "still blurs Linus" → "lagging, hit and miss") is two invariants asked for since v1006: (1) blur stays glued to the right person, (2) the decision doesn't flicker. Each patch fixed the reported instance while adding a new asynchronous input or threshold boundary — a new flicker source. The system now has more failure modes than v1007. The owner independently asked the right architectural questions twice ("pre-analysis", "track the person") — he is asking for a predict-and-smooth tracker fed by one consistent detector, not gate #6.

## D. Recommended target architecture

### Detection: person-primary, one cadence

Invert the hierarchy. **The person is the unit of blur; the face only decides gender.** One unified pass per tick, fixed ~4–5Hz (200–250ms):

1. MoveNet MultiPose on the frame → person boxes (the only full-frame detector).
2. Per person (≤4): aspect-preserving native-res crop → BlazeFace + faceres on the crop (current zoom pass promoted to the ONLY face/gender path — kill the 256px full-frame BlazeFace on video entirely).
3. Emit per-person observation: `{box, faceFound, gender, certainty}`.

Deletes by construction: small-face rescue floor + native recheck, person gate, torso-ghost suppression, static-texture suppression, staleness race. Five mechanisms, ~8 thresholds gone. Backside coverage is free: person with no confident face = unknown gender = covered.

### Tracking: persons, IoU association, predict every frame

IoU-based association (person boxes overlap frame-to-frame at 5Hz; centre-distance greedy is what swaps identities), constant-velocity predict, ~1s coast. Keep gender memory per track — it finally works because person identity is stable.

### Blur state machine with real hysteresis (per track)

```
UNKNOWN --(any obs, gender not confidently-same)--> BLURRED   [instant, fail-safe]
BLURRED --(confident-same-gender >=1.5s continuous AND track alive)--> CLEARED
CLEARED --(confident-opposite obs)--> BLURRED  [instant]
CLEARED --(uncertain obs)--> CLEARED           [memory absorbs; only certainty flips]
any state: minimum dwell 1s before any transition renders
```

Rendered patch set changes **only on state transitions**. Patch geometry updates continuously; patch existence is hysteretic. Single biggest owner-visible fix.

### Threading: inference off the main thread

- Capture: `requestVideoFrameCallback` → `createImageBitmap(video)` (async, no sync readback) → postMessage transfer to a **Worker**; mailbox depth 1 (drop frame if busy, never queue).
- Worker: tfjs-webgl on OffscreenCanvas; whole person-primary pass; posts back `[{trackId, box, vx, vy, state}]`.
- Main thread: ≤5 messages/sec; rAF loop only **interpolates** overlay positions between updates (dead reckoning). Smoothness from 60Hz interpolation, not inference rate. Cadence can drop to 3Hz on Helio G88 with zero visible smoothness loss.
- rAF fix regardless: cache host rect, gBCR on 250ms timer + ResizeObserver, write styles via `transform: translate/scale` (compositor-only).
- **Must-spike first:** Worker + OffscreenCanvas + tfjs-webgl in WebView2 AND Android WebView, under YouTube CSP, worker from Blob URL with embedded models. (2026-08-18 spike: Workers unblocked in WebView2 on Reddit — promising, unverified for this payload and Android.) If blocked: fall back main-thread 2–3Hz + interpolation — state machine + single pass still deliver most of the consistency win.

### Constraints check
MoveNet Apache-2.0, BlazeFace/faceres MIT — compliant. Blur-first holds (UNKNOWN renders covered from first observation; worker startup covered by pending whole-blur). Instant-by-default: inference leaves the critical path. One codebase; cadence is a per-device knob.

## E. Keep / delete

KEEP: model embeds + embeddedIoHandler, requant pipeline, nms.mjs, WEBGL_USE_SHAPES_UNIFORMS, video-region anchoring (absolute-in-player double-gBCR — hard-won, only its per-frame read/write pattern changes), mergeOverlapping, padBox, pill toggle, loadstart reset, tainted-canvas giveUp, fail-open sweep, model-load settlement gates, zoomClassifyPersons aspect-preserving crop (becomes the primary detector path), track.mjs gender-memory concept, whole image/thumbnail pipeline, faceMeta.

DELETE (video path only): full-frame BlazeFace primary, FACE_SMALL_* rescue, recheckSmallFace/verifyLowConf, gateDetections, suppressTorsoGhosts, static suppression, facelessPersons special case, MIN_HITS phantom gate. Registry shrinks ~15 → ~6 video thresholds.

## F. Staged migration

**Stage 0 — measure (no code).** See G.

**Stage 1 — stop the bleeding (one session, owner-visible).** (a) Cadence to 250ms, person+zoom pass becomes the ONLY pass (delete full-frame face path from sampleOnce) — cuts inference ~60%, kills the verdict beat. (b) Blur state machine at the render boundary (pure module, unit-testable). (c) rAF loop → transform writes + cached rects + linear interpolation. No worker yet. Expected: lag noticeably down, flicker mostly gone, patch glides.

**Stage 2 — worker spike + inference off-thread.** Spike both WebViews first. Expected: lag gone desktop, phone viable.

**Stage 3 — tracker swap.** IoU + predict, delete the seven dead mechanisms and thresholds, re-run calibration protocol (positive/negative/red-line/cold-boot) on the Linus video + one crowd video, update detection-engine.md.

Each stage independently shippable and reversible; Stage 1 alone partially addresses both complaints.

## G. Measurements REQUIRED before coding (CDP 9223 desktop; phone via chrome://inspect)

1. `video.getVideoPlaybackQuality().droppedVideoFrames` every 5s, 60s watch, three conditions: pill off / v1009 on / Stage-1 build. THE lag number the owner feels.
2. `PerformanceObserver({type:'longtask'})` — count + total ms of >50ms tasks per minute, same conditions.
3. performance.mark/measure inside sampleOnce: canvas draw+getImageData, MoveNet, per-zoom-crop (BlazeFace, faceres), full-frame face, data() await. p50/p95, normal vs person-pass, desktop AND phone.
4. Histogram of lastSample deltas — proves/refutes burst jitter.
5. Log every rendered-patch-set change (count + cause) per minute on the Linus video — the "hit and miss" metric; Stage 1 must show >5× reduction.
6. DevTools Performance trace 10s: layout time attributed to reposition.
7. Same trace: compositor cost of backdrop-filter patch present vs absent.
8. Worker feasibility spike: boolean per platform (WebView2 / Android WebView): worker boots from Blob URL on youtube.com, tfjs-webgl initializes in worker, one MoveNet inference returns; plus in-worker inference ms.

---

**One-line summary:** the pipeline does 5× the inference of v1007 on the page's own thread and re-decides blur from scratch 7 times a second from five racing sources — fix is one person-first detection pass at ~4Hz in a worker, a hysteretic blur state machine, and 60Hz interpolated overlays; Stage 1 (single pass + state machine + interpolation, no worker) is one session and should visibly fix both complaints.

Key files: init-entry.js (video loop ~502–872), track.mjs, person-gate.mjs, video-region.mjs (rAF loop ~87–94), detector.js, docs/detection-engine.md §4.
