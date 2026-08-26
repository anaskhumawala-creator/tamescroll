#!/usr/bin/env bash
# Build ONE historical commit's gaze bundle, swap it into the running dev
# app, and measure stability on it.
#
# Why this exists: S4 measured that patch BREATHING regressed 67% across
# the 55 commits of the gauntlet (pre-gauntlet 0.229/s vs 0.383/s today)
# while every accuracy score improved. Guessing the cause cost one round
# already -- capping size extrapolation looked obvious, did nothing, and
# cost count stability. A bisect answers it instead of reasoning about it.
#
# Gotchas this encodes, each of which cost time:
#  - a worktree cannot build the bundle without node_modules JUNCTIONED in
#    (NODE_PATH does not help; esbuild resolves from the file's directory)
#    and without src/model-embed.js copied from the main checkout
#  - `touch lib.rs` is not proof of a reload; only an app.exe PID CHANGE is
set -u
COMMIT="$1"
LABEL="$2"
GENDER="${3:-man}"
MAIN=/z/Apps/Disconnect
WT=/z/Apps/Disconnect-bisect

cd "$MAIN" || exit 1
git worktree list | grep -q "$WT" || git worktree add "$WT" "$COMMIT" --detach >/dev/null 2>&1
git -C "$WT" checkout -q --detach "$COMMIT" 2>/dev/null || { echo "CHECKOUT FAILED $COMMIT"; exit 1; }

powershell -NoProfile -Command "
foreach (\$p in @(@('$(cygpath -w $WT)\app\gaze\node_modules','Z:\Apps\Disconnect\app\gaze\node_modules'), @('$(cygpath -w $WT)\app\node_modules','Z:\Apps\Disconnect\app\node_modules'))) {
  if ((Test-Path \$p[1]) -and -not (Test-Path \$p[0])) { New-Item -ItemType Junction -Path \$p[0] -Target \$p[1] | Out-Null }
}" >/dev/null 2>&1

for f in model-embed.js gender-model-embed.js nsfw-model-embed.js person-model-embed.js; do
  [ -f "$MAIN/app/gaze/src/$f" ] && [ ! -f "$WT/app/gaze/src/$f" ] && cp "$MAIN/app/gaze/src/$f" "$WT/app/gaze/src/$f"
done

( cd "$WT/app/gaze" && node build/build.js ) >/dev/null 2>&1
if [ ! -s "$WT/app/src-tauri/gaze-init.js" ]; then echo "BUILD FAILED $COMMIT"; exit 1; fi

OLD=$(powershell -NoProfile -Command "(Get-Process app -EA SilentlyContinue|Sort-Object StartTime|Select-Object -Last 1).Id" | tr -d '\r')
cp "$WT/app/src-tauri/gaze-init.js" "$MAIN/app/src-tauri/gaze-init.js"
touch "$MAIN/app/src-tauri/src/lib.rs"
for i in $(seq 1 24); do
  sleep 10
  NEW=$(powershell -NoProfile -Command "(Get-Process app -EA SilentlyContinue|Sort-Object StartTime|Select-Object -Last 1).Id" | tr -d '\r')
  if [ -n "$NEW" ] && [ "$NEW" != "$OLD" ]; then RELOADED=1; break; fi
done
if [ "${RELOADED:-0}" != "1" ]; then echo "NO RELOAD $COMMIT"; exit 1; fi

cd "$MAIN/spikes/gauntlet" || exit 1
python stability.py "runs/bisect-$LABEL.json" "$GENDER" NWoT1ZVd1Lo 890 45 2>&1 | tail -1
