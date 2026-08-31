# Handoff -- 2026-08-31 night

For a fresh session. Read `CLAUDE.md` session state (loops 27-30) after
this; this file is only the live thread.

## State

- **1071 is published** (sha `98348b08`, raw manifest and downloaded APK
  agree). His phone was on 1070 and he is installing 1071 now.
- gaze 398/398, cargo 58/58, nothing ahead of origin.
- Wireless adb to his phone: use `$ANDROID_HOME/platform-tools/adb.exe`
  (NOT the 28.0.3 on PATH), `adb connect 192.168.99.194:42305`, then
  `adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`.
  He cannot be installed to over adb (MIUI USER_RESTRICTED) -- publish
  and he updates in-app. Publishing is pre-authorized: "the app is still
  in testing and no one uses it".

## What just happened, because it is the important part

1068-1070 stopped running MoveNet on 2 of every 3 passes once it had
admitted nobody three times running. The cadence numbers looked like a
win. **He reported "it's not blurring the female", and he was right.**

Mechanism, read off the source, not guessed:
`emptyFrame = persons.length === 0 && faceEvidence === 0`, with
`faceEvidence = noShape ? 0 : faces.length`. A skipped pass has
`persons.length === 0` because the model never ran, and 1070 also handed
it a HELD `noHumanShape`, so one frame where MoveNet read below the
keypoint floor made the next two passes report an empty frame while
faces were plainly detected -- `wipeIfEmpty` then ERASED the patch.

Both directions of the skip are wrong: held-true erases, held-false
disables the ghost gate and mints patches over graphics ("random blur
marks here and there"). 1071 runs the model on every pass, as 1067 did.
A test fails if the constants return.

**Retract the 1070 A/B as a win.** A position pass measured at 12ms is a
pass that did no work -- that was churn, not tracking.

## What survives from that night

The main-thread budget fix, which is independent and measured: a verdict
pass is 795ms of which **785 is the worker reply and 2ms is ours**, and
`noteSpend` charged all 795 against SPEND_BUDGET_FRAC 0.25, so
`overBudget()` refused the cheap position passes that keep a patch on a
moving subject (20 against 62 verdicts). `gazeWorker.waitMs()` is
subtracted now, floored at 0; the in-page path is still charged in full.

## Do these first, in order

1. **Ask him whether women are covered again on 1071.** That is the only
   thing that closes the regression.
2. **Then measure what the budget fix alone costs.** With the full
   person pass back AND positions no longer starved, worker duty goes to
   roughly (795 + 517) / 2000 = **65%**, against ~40% on 1067. If rAF
   falls materially, the dial is `POSITION_MAX_INTERVAL_MS` -- positions
   sit at a 1000ms floor today only because `lastPassMs * 2` exceeds it.
   Probe: `spikes/gauntlet/probe_phone_cadence.py 9225 <label> 150`
   (counts by tagging live ring entries, and samples rAF and coverage in
   page). **1067 control, two runs:** secsPerVerdict 2.06/2.09,
   positions/min 10.0/11.2, verdict p50 766/799, position p50 517/530,
   rAF 40.3/42.1Hz, coverage 0.083/0.106.
3. **There is no counter for the eraser, and that is why he found this
   before any probe did.** `wipeIfEmpty` erasures and `emptyFrame` need
   the same treatment `IDS.life.faceNoShape` already gets. Add it before
   touching the video pipeline again.
4. **Priority 1 (blur over the video) needs his phone.**
   `spikes/gauntlet/probe_patch_rank_dense.py` hit-tests in page at 10Hz
   for the whole run and forces our patches hit-testable (they are
   pointer-events:none, which blinded three earlier sessions). It
   returned **patchesMax 0** on the emulator -- 1016 frames and not one
   patch existed to rank, because signed out under swiftshader the
   player makes ~1 pass per 2 minutes. Point it at port 9225.
5. **His accuracy complaint has a measured mechanism and a threshold he
   must rule on:** 24 face reads in one window read male 14, female 2,
   **unknown 8** -- a third abstain. facePx p50 74, min 53, and
   FACE_MIN_NATIVE_PX is 64, so every face under it abstains and fails
   closed = covered. That is the man who gets blurred. Lowering it is an
   exposure trade; loop 16 refused the same move on the image path.

## Traps that cost time

- **`player.passes` used to be a RING LENGTH** and saturated at 40, so
  diffing it measured the fill, not the rate -- that is how "a verdict
  every 5.8s" got recorded when it was 2.09s. Use
  `passesTotal`/`verdictsTotal` (1070+).
- **A failed `gh release create` can leave a DRAFT.** `gh release view`
  shows the tag and the asset while the download URL 404s. Check
  `isDraft`, then `gh release edit --draft=false`.
- `gaze-page.js` is `include_str!`d into the Rust lib: a bundle change
  needs the RUST build, not just `gradlew assemble`.
- Strip the `.so` into `jniLibs/` **after** the last `tauri android
  build` -- that command deletes the destination before symlinking, so
  stripping first yields an APK with no native library (7MB instead of
  55MB).
- Never trust a speed or failure number from a long-running emulator;
  restart it first.
