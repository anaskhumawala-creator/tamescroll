#!/bin/bash
# DELAY_MS 1500 vs 1000 on the same build (plan Task 4): two probe_events
# runs back to back, PSS sampled 120s into each arm.
cd "$(dirname "$0")"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
for arm in delay1500 delay1000ctl; do
  if [ "$arm" = delay1500 ]; then export TS_PLANT_FILE=plant-delay1500.js; else unset TS_PLANT_FILE; fi
  python probe_events.py 9227 "$arm" 180 NWoT1ZVd1Lo 55 > "$arm.out" 2>&1 &
  pid=$!
  sleep 150
  "$ADB" shell dumpsys meminfo app.tamescroll.client | grep -E "TOTAL PSS|TOTAL:|TOTAL RSS" > "$arm.pss" 2>&1
  wait $pid
  echo "$arm exit $?" >> "$arm.out"
done
echo DONE
