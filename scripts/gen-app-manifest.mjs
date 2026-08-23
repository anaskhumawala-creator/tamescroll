// Regenerates updates/app-manifest.json for the in-app updater.
//
// Usage:
//   node scripts/gen-app-manifest.mjs <apk-path> <apk-url> "<notes>"
//
// Reads versionCode/versionName from the built arm64 APK's aapt badging
// is overkill here; instead they are read from the android
// tauri.properties (the single source the gradle build uses). The apk-url
// is the public download URL (GitHub Releases asset). sha256 is computed
// from the APK bytes the users will actually download, so the installer's
// hash-pin matches. Run + commit this AFTER uploading the release asset.
//
// With no apk-path (bare run) it just rewrites version fields and clears
// the url/hash — the "no update available" resting state.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("..", import.meta.url);
const props = readFileSync(
  new URL("app/src-tauri/gen/android/app/tauri.properties", ROOT),
  "utf8",
);
const get = (k) => (props.match(new RegExp(`${k}=(.*)`)) || [])[1]?.trim() ?? "";
const versionCode = Number(get("tauri.android.versionCode"));
const versionName = get("tauri.android.versionName");

const [, , apkPath, apkUrl, notes] = process.argv;

let sha256 = "";
if (apkPath) {
  sha256 = createHash("sha256").update(readFileSync(apkPath)).digest("hex");
}

const manifest = {
  versionCode,
  versionName,
  apkUrl: apkUrl ?? "",
  sha256,
  notes: notes ?? "",
};
writeFileSync(
  new URL("updates/app-manifest.json", ROOT),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("wrote updates/app-manifest.json:", JSON.stringify(manifest));
