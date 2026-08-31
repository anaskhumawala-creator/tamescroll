# Handoff -- 2026-08-31 night

Written for a fresh session. Read `CLAUDE.md` session state first; this
file is only the live thread, not the history.

## Where things stand

- **1070 is published and installed on his phone** (sha `f5036959`, raw
  manifest and downloaded APK verified). gaze 402/402, cargo 58/58,
  nothing ahead of origin.
- Wireless adb to his phone works: `$ANDROID_HOME/platform-tools/adb.exe`
  (NOT the 28.0.3 on PATH), `adb connect 192.168.99.194:42305`, CDP via
  `adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`.
  He cannot be installed to over adb (MIUI: INSTALL_FAILED_USER_RESTRICTED)
  -- publish a release and he updates in-app. He has pre-authorized
  publishing: "the app is still in testing and no one uses it".

## The one open decision, and it is his

1070 made the player pass cheaper and the pipeline faster, MEASURED on
his phone, two runs each side (`spikes/gauntlet/probe_phone_cadence.py`):

- verdict every 1.12-1.21s, was 2.06-2.09
- position passes 56.7-62.4/min, was 10.0-11.2 (each now 12-15ms, was ~520)
- **rAF 35.9-37.1Hz, was 40.3-42.1** -- about 5fps of render loop

That last row is the cost and it is consistent. The dial if he wants the
frames back is a floor on the position pass: its floor is
`min(POSITION_MAX_INTERVAL_MS, max(floor, lastPassMs * POSITION_DUTY))`
and with a 12ms pass that lower bound is ~24ms, so nothing but
serialization limits the rate. Ask him whether he wants smoother render
or tighter tracking before changing it.

## What to do next, in order

1. **Ask him how 1070 FEELS** -- his three words were "snappier",
   "accurate", "no random blur marks". The numbers moved; only he can
   say whether the 5fps shows.
2. **Priority 1 (blur over the video) needs a live instrument on his
   phone.** `spikes/gauntlet/probe_patch_rank_dense.py` samples in page
   at 10Hz and forces our patches hit-testable (they are
   pointer-events:none, which blinded three earlier sessions). It
   returned patchesMax 0 on the emulator -- signed out under swiftshader
   the player makes ~1 pass per 2 minutes, so there was nothing to rank.
   Point it at port 9225 (his phone) on a watch page instead.
3. **His accuracy complaint has a measured mechanism and a threshold he
   has to rule on:** 24 face reads in one window read male 14, female 2,
   **unknown 8** -- a third abstain. facePx p50 74, min 53, and
   FACE_MIN_NATIVE_PX is 64, so every face under it abstains and fails
   closed = covered. That is the man who gets blurred. Lowering it is an
   exposure trade; loop 16 refused the same move on the image path with
   numbers.
4. Speed beyond this is the native-TFLite item and stays gated. The cold
   path is decomposed in `docs/speed-findings-2026-08-29.md` (5.5-6.8s
   to first verdict on his phone, 2.0s of it YouTube's own load), with
   two levers examined and refused there.

## Traps that cost time tonight

- **`player.passes` in the diagnostics report used to be a RING LENGTH**
  and saturated at 40; diffing it across a window measures the fill, not
  the rate. That is how "one verdict every 5.8s" got written down when
  the real figure was 2.09s. Use `passesTotal`/`verdictsTotal` (1070+)
  or tag live ring entries.
- `gaze-page.js` is `include_str!`d into the Rust lib: a bundle change
  needs the RUST build, not just `gradlew assemble`.
- Strip the `.so` into `jniLibs/` **after** the last `tauri android
  build` -- that command deletes the destination before it symlinks, so
  stripping first gives you an APK with no native library (a 7MB APK).
