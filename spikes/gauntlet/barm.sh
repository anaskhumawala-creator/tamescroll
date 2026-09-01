set -e
export JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
cd /z/Apps/Disconnect
# THE GAZE BUNDLE IS include_str!'d INTO THE RUST LIB, and
# `npx tauri android build` does NOT build it. An APK built without
# this line carries the PREVIOUS bundle and the change is silently
# absent -- loop 15 lost a cycle to it, and it nearly shipped a
# release with the wrong tracker in it.
node app/gaze/build/build.js
cd /z/Apps/Disconnect/app
npx tauri android build --debug --target aarch64 >/tmp/barm.log 2>&1 || true
SO=src-tauri/target/aarch64-linux-android/debug/libapp_lib.so
ls -l "$SO"
STRIP=$(ls "$ANDROID_HOME"/ndk/*/toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-strip.exe 2>/dev/null | head -1)
mkdir -p src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a
"$STRIP" --strip-unneeded -o src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libapp_lib.so "$SO"
ls -l src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libapp_lib.so
cd src-tauri/gen/android
./gradlew :app:clean :app:assembleArm64Debug -x :app:rustBuildArm64Debug >>/tmp/barm.log 2>&1
APK=app/build/outputs/apk/arm64/debug/app-arm64-debug.apk
ls -l "$APK"
