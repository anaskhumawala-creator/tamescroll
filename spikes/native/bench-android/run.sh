#!/bin/bash
# Build, install and run the TFLite bench on the old Redmi; writes the
# RESULT json to $OUT (default gpu-bench.json) plus a delegate log.
#   RUNS=100 OUT=gpu-bench.json ./run.sh
set -e
cd "$(dirname "$0")"
export JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
ADB=/c/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe
OUTF="${OUT:-gpu-bench.json}"
./gradlew :app:assembleDebug -q
"$ADB" -s 1ec2c48e0621 install -r app/build/outputs/apk/debug/app-debug.apk >/dev/null
"$ADB" -s 1ec2c48e0621 logcat -c
"$ADB" -s 1ec2c48e0621 shell am force-stop app.tamescroll.bench
"$ADB" -s 1ec2c48e0621 shell am start -n app.tamescroll.bench/.BenchActivity --ei runs "${RUNS:-100}" >/dev/null
for i in $(seq 1 150); do
  sleep 2
  if "$ADB" -s 1ec2c48e0621 logcat -d -s TSBENCH | grep -q "RESULT"; then break; fi
done
"$ADB" -s 1ec2c48e0621 logcat -d -s TSBENCH | grep "RESULT" | sed 's/.*RESULT //' > "$OUTF"
"$ADB" -s 1ec2c48e0621 logcat -d | grep -iE "gpu delegate|not supported|falling back|xnnpack|tflite" | head -60 > "$OUTF.delegate.log" || true
"$ADB" -s 1ec2c48e0621 shell am force-stop app.tamescroll.bench
echo "wrote $OUTF ($(wc -c < "$OUTF") bytes)"
