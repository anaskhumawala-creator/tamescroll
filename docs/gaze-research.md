# Gaze module — delivery research (Stage B, on-device detection)

Fetched 2026-08-18. HaramBlur described read-only as architecture reference; **HaramBlur is AGPL-3.0-licensed, no code was copied** ([license](https://github.com/alganzory/HaramBlur/blob/main/LICENSE)).

## 1. CSP reality per site

Fetched live via `curl` against each homepage:

**YouTube** ([www.youtube.com](https://www.youtube.com/)) — two enforcing CSP headers intersect: `script-src 'unsafe-eval' 'self' 'unsafe-inline' <google domains>` and `script-src 'report-sample' 'nonce-...' 'unsafe-inline' 'strict-dynamic' https: http: 'unsafe-eval'`, plus `require-trusted-types-for 'script'`. **No `worker-src`/`connect-src`/`default-src`** set → unrestricted.

**Reddit** ([www.reddit.com](https://www.reddit.com/)) — `default-src 'none'; script-src 'nonce-...'; style-src 'unsafe-inline'; img-src https://www.redditstatic.com; form-action 'self'`. No `worker-src`/`connect-src` → both fall back to `default-src 'none'`.

**X** ([x.com](https://x.com/)) — `script-src 'self' 'nonce-...' 'unsafe-inline' 'wasm-unsafe-eval' ... https://*.x.com`; `worker-src 'self' blob: https://*.twimg.com https://abs.twimg.com`; `connect-src` is a fixed domain allowlist that also permits `data:`, no wildcard.

**CSP semantics**: `script-src` gates which `<script>` sources *load* — it doesn't re-gate a host-injected script's own execution. `connect-src`/`worker-src` are document-wide runtime gates applying to **any** script already running, injected or not. `worker-src` (→`default-src` if unset) governs `new Worker(blobURL)`; `connect-src` governs `fetch()`/XHR destinations.

Per site: **YouTube** — blob Workers ✅ (unrestricted), fetch cross-origin ✅ (unrestricted), WASM ✅ (`unsafe-eval` present), WebGL ✅ (CSP-unaffected always). **Reddit** — blob Workers ❌, fetch (even same-origin) ❌, WASM ❌ (no `unsafe-eval`/`wasm-unsafe-eval`; requirement confirmed at [MDN script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)), WebGL ✅. **X** — blob Workers ✅, fetch only to the allowlist (not an app custom-protocol origin; `data:` explicitly allowed), WASM ✅, WebGL ✅.

**Correction to the premise**: the injected script is not fully CSP-exempt. Microsoft's own docs: "if an HTML document has ... the Content-Security-Policy HTTP header this will affect the script run here" ([WebView2 docs](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.addscripttoexecuteondocumentcreatedasync)). Loading bypasses `script-src`; everything the script does after — `fetch()`, `new Worker()`, WASM — is enforced by the document's live CSP same as page scripts. Reddit blocks both model fetch and worker offload outright.

## 2. Tauri v2 custom protocol delivery

Docs don't state per-platform origin mapping explicitly; a maintainer issue confirms Windows serves the custom protocol as `https://<identifier>.localhost` by default, with an `http://` option ([tauri-apps/tauri#3007](https://github.com/tauri-apps/tauri/issues/3007)). macOS/WKWebView, Linux/WebKitGTK, Android exact origins: **UNVERIFIED**, not found in docs fetched.

Regardless of mapping: a fetch from `https://www.youtube.com` to `https://<id>.localhost/...` is cross-origin, gated by **the page's own `connect-src`**, which the app cannot control. Works on YouTube, blocked on Reddit/X. CORS headers on the response (Tauri can set custom headers, per [localhost plugin docs](https://v2.tauri.app/plugin/localhost/)) are moot — CSP is checked before CORS, so a blocked `connect-src` never reaches the CORS check.

## 3. Fallback delivery paths

**(a) Inline everything**: no documented hard size limit found for `initialization_script` or `AddScriptToExecuteOnDocumentCreatedAsync` (**UNVERIFIED**). Known issue: script can fire more than once per navigation ([tauri#4831](https://github.com/tauri-apps/tauri/issues/4831)); multi-MB eval-per-navigation latency not benchmarked (**UNVERIFIED**).

**(b) IPC bridge**: `window.__TAURI__` injects only when `app.withGlobalTauri` is true, and only into the app's own origin ([config docs](https://v2.tauri.app/reference/config/)). Remote-origin IPC needs a capability with a `remote` field using [URLPattern](https://urlpattern.spec.whatwg.org/) (e.g. `"https://*.mydomain.dev"`), with an explicit warning to understand the risk of "providing remote sources with local system access" ([capability reference](https://v2.tauri.app/reference/acl/capability/)). Granting it to youtube.com/reddit.com/x.com lets those pages' own third-party JS invoke permitted Rust commands — unacceptable.

**(c) Rust-side inference** (`ort`/`candle`) on IPC-shipped base64 frames: no pixel-readback API for a remote page short of screenshotting or in-page canvas `toDataURL()` (same CSP/tainted-canvas limits). Base64 inflates payload ~33%. Real-time-feed throughput: **UNVERIFIED**, no primary source, not benchmarked.

## 4. Human / nsfwjs practicalities

Human ([repo](https://github.com/vladmandic/human)): backends webgpu/webgl/wasm/cpu. Minimal face-only model, BlazeFace: `blazeface.json` 79,038 B + `blazeface.bin` 538,928 B ≈ **604 KB** ([models dir](https://github.com/vladmandic/human/tree/main/models)). Full npm package unpacked (all models/tasks) is 43.7 MB ([npm](https://registry.npmjs.org/@vladmandic/human/latest)) — not what a minimal build ships.

nsfwjs ([repo](https://github.com/infinitered/nsfwjs)): `mobilenet_v2` = `model.json` 128,945 B + `group1-shard1of1` 2,619,461 B ≈ **2.7 MB**, matching README's "2.6MB self-hosted vs 3.5MB bundled base64" ([README](https://github.com/infinitered/nsfwjs#models)). ~90% accuracy quoted — fine for classifying many thumbnails per grid page.

## 5. HaramBlur architecture (read-only reference; AGPL, not copied)

Source ([observers.js](https://github.com/alganzory/HaramBlur/blob/main/src/modules/observers.js), [offscreen.js](https://github.com/alganzory/HaramBlur/blob/main/src/offscreen.js), [detector.js](https://github.com/alganzory/HaramBlur/blob/main/src/modules/detector.js)): scheduling is **`MutationObserver`-driven** (new nodes + `src` changes trigger work; no `IntersectionObserver`, no polling). Inference runs in a Chrome-extension **"offscreen document"** (`chrome.offscreen`) — a hidden DOM context available only to MV3 extensions, not a plain Worker, not portable to Tauri as-is. Images become tensors via `tf.browser.fromPixels()`; NSFW input resized to 224×224; video frames use a frame-skip cache (up to 99 skipped) to avoid per-frame inference; tensors disposed explicitly. Clean-room reproduction using only MIT Human + nsfwjs: MutationObserver dispatch → a Worker (with `OffscreenCanvas`) or hidden iframe standing in for the offscreen document → 224×224 downscale before NSFW inference → frame-skip cache for `<video>`.

## 6. Recommendation

**Inline-first, fetch-opportunistic.** Base64-embed BlazeFace (~600 KB) + nsfwjs mobilenet_v2 (~2.7 MB) directly in the Windows `initialization_script`, since Reddit's CSP proves `fetch()` can't be relied on cross-site — inlining is the only path that works unconditionally on all three sites, needing neither `connect-src` cooperation nor a custom-protocol round trip. Run inference in a Web Worker (blocked only on Reddit — add a same-thread fallback there) on `cpu`/`webgl` backend (`wasm` fails on Reddit). Blur-first via injected CSS (already Phase 4's design) so a slow worker never flashes content. Skip Tauri IPC-to-remote-origin (§3b) — security cost unjustified. Android/iOS extension path: same inline-script + Worker approach (WKWebView/Android WebView both support pre-injection and Workers); re-verify §2's UNVERIFIED per-platform origin/CSP behavior before Phase 5.

**First step**: a throwaway Tauri v2 desktop spike that base64-embeds BlazeFace only into `initialization_script`, loads `https://www.reddit.com/` (worst-case CSP), and confirms in-worker tfjs-cpu inference runs end-to-end against a real DOM image — validates or kills inline delivery before nsfwjs or UI work is built on it.


## Spike result — inline BlazeFace vs Reddit CSP (2026-08-18, verified live)

Spike app in `spikes/gaze-inline/` (build scripts + src committed; dist/
node_modules ignored). Ran against live reddit.com in WebView2. Verdict:
**SPIKE_OK** — the full pipeline (base64-embedded model -> custom
IOHandler decode -> tfjs graph load -> WebGL inference) completed with
zero network calls under `default-src 'none'`.

- Payload: `dist/init.js` 1,641,496 bytes (tfjs core+cpu+webgl+converter
  ~860KB min + BlazeFace 702KB base64-inflated). nsfwjs (~2.7MB) would
  bring the bundle to ~4.3MB — set a budget before adding it.
- Timings: backend ready 107ms, embedded-model decode 8ms, FIRST
  inference 595ms (WebGL shader compile dominates; one-time per
  navigation). Total 720ms script-start -> result.
- Backend: WebGL directly; no CPU fallback needed.
- **Surprise vs §1:** blob Workers were NOT blocked on live reddit.com
  in WebView2 — a full `postMessage` ping/ok round-trip succeeded
  despite `default-src 'none'` with no `worker-src`. Treat as
  engine-specific: unconfirmed for WKWebView/WebKitGTK, so the
  same-thread fallback stays in the design; re-verify per engine.
- Reddit's live CSP matched §1 exactly (curl-verified same day).
