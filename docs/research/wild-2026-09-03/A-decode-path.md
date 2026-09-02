# Research Track A — Video decode/present path

Context: Tauri v2 Android app, System WebView (Chromium ~151), opens m.youtube.com,
copies frames into a 1.5s delay-line ring via `createImageBitmap(video)`, presents
from a `<canvas>`, draws CSS `backdrop-filter` blur patches over it. Native TFLite
inference over WebMessagePort. Test phones: Redmi 9 (Helio G85, Mali-G52, Android 12),
Redmi 13 4G (Snapdragon 4 Gen 2, Adreno 613, Android 16). Measured: 426p drops 0%
frames blur-off, ~13% blur-on (~4pt ring copy / ~3.5pt inference / ~5-6pt render+page).

---

## 1. Codec selection, AV1 hardware support, and how to refuse AV1

**How YouTube decides the codec** — DOCUMENTED
YouTube's player uses `MediaSource.isTypeSupported()` and the `MediaCapabilities.decodingInfo()`
promise (fields: `supported`, `smooth`, `powerEfficient`) to pick a codec. Community guidance
converges on: gate AV1 on `powerEfficient`, not merely `supported`, because a GPU-less
software decoder (dav1d) can report `supported: true` while still being worse than H.264.
- https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo (DOCUMENTED — API shape)
- https://dev.to/masonwritescode/av2-shipped-its-10-encoder-heres-what-to-actually-run-in-your-pipeline-instead-pfa (DOCUMENTED — "AV1 for devices that hardware-decode it, H.264 for everyone else"; "gate on powerEfficient, not supported")

**In practice, YouTube's gating on Android has been reported broken** — MEASURED-BY-SOURCE (third-party reporting, not Google's own postmortem, but widely corroborated)
After a March 2024 Google Play System Update shipped `libdav1d` (software AV1 decoder) to
"all devices dating back to Android 12," YouTube began defaulting to AV1 regardless of
hardware decode support, causing CPU/battery/heat complaints on mid-range and older phones.
- https://www.androidpolice.com/youtube-google-av1-codec-android-video/ — "Google introduced a new AV1 decoder called 'libdav1d' via the March 2024 Google Play System Update... YouTube opted to use the new decoder by default... supports all devices dating back to Android 12... newer higher-end phones [have hardware AV1]; midrange devices and older flagships may have to rely on software decoding"
- https://www.sammobile.com/news/youtube-av1-decoding-battery-life-smoothness-issues-older-galaxy-devices/ (title/summary only, DOCUMENTED)
This is directly on point for both test phones: neither has AV1 hardware decode (see below),
both are Android 12+, so **both are plausible candidates for YouTube silently serving AV1
with software (dav1d) fallback today.**

**dav1d software AV1 on Android** — DOCUMENTED
> "Chrome for Android plays AV1 from Android 10 and later through the dav1d software decoder;
> smooth hardware playback needs an AV1-capable SoC such as Snapdragon 8 Gen 1, Samsung Exynos
> 2200, Tensor G2, or later." — https://www.testmuai.com/learning-hub/av1-browser-support/
> "Android has carried an AV1 software decoder in its source since Android 10, but Google did
> not require manufacturers to actually ship one until Android 14." (same source, DOCUMENTED)
dav1d itself: "an AV1 cross-platform decoder... to overcome the temporary lack of AV1 hardware
decoder." — https://chromium.googlesource.com/external/github.com/videolan/dav1d/ (DOCUMENTED)
System WebView shares Chromium's media stack with Chrome for Android, so this applies to our
WebView (Chromium ~151) the same way — SPECULATIVE inference from the above, not a WebView-
specific citation, but WebView and Chrome-for-Android track the same `//media` code.

**Do the test phones have AV1 hardware decode?**
- **Helio G85 / Mali-G52 MC2 — NO.** Spec listings show H.264, H.265/HEVC, VP-9 support; no
  AV1 is listed anywhere for this chip. MediaTek's own AV1 hardware-decode announcement is
  scoped to the Dimensity line: "The Dimensity 1000 is the world's first smartphone chip to
  integrate a hardware-based AV1 video decoder" — https://www.mediatek.com/tek-talk-blogs/mediatek-and-youtube-enable-av1-video-streams-on-android
  (DOCUMENTED for Dimensity 1000; the Helio G85 is not mentioned anywhere in that piece —
  absence-of-mention, so this is DOCUMENTED-by-omission / reasonably confident but not a
  direct "Helio G85 has no AV1" statement from MediaTek).
  Nanoreview spec summary: "supports H.264, H.265/HEVC, and VP-9 encoding formats" (no AV1) —
  https://nanoreview.net/en/soc/mediatek-helio-g85 (DOCUMENTED, third-party spec aggregator)
- **Snapdragon 4 Gen 2 / Adreno 613 — NO.** "The Adreno 613 is capable of hardware-accelerated
  decoding of H.265 and VP9 data" with AV1 unlisted; AV1 hardware decode adoption is reported
  as led by iPhone 15 Pro and Snapdragon 8 Gen 2 and up — https://scientiamobile.com/av1-codec-hardware-decode-adoption/
  and https://www.notebookcheck.net/Qualcomm-Adreno-613-Benchmarks-and-Specs.855460.0.html
  (DOCUMENTED, third-party; not a direct Qualcomm statement of AV1 absence).

**Conclusion: neither phone has AV1 hardware decode.** If YouTube is serving AV1 to either
device (plausible per the March-2024-regression reporting above), every AV1 frame is being
software-decoded by dav1d on the CPU before it ever reaches the delay-line/blur pipeline —
this would compete directly with the app's own inference/ring-copy CPU budget. **This has
not been measured on these specific phones in this app** (no `chrome://media-internals`-
equivalent capture in scope for this research pass) — flag as the single highest-value thing
to verify next (e.g. read `document.querySelector('video').getVideoPlaybackQuality()` won't
show codec, but the player response JSON / "Stats for nerds" long-press menu shows the active
`codecs=` string; or intercept the DASH manifest response in the request interceptor already
in place for ad-blocking).

**How to refuse AV1 from a page script**

*(a) YouTube's own first-party lever — LOW RISK, DOCUMENTED*
YouTube stores a user-facing AV1 preference in `localStorage['yt-player-av1-pref']`, exposed
in YouTube's own Settings → Playback and Performance UI as **Auto (Recommended) / Prefer AV1
for SD / Always prefer AV1**:
> "Prefer AV1 for SD" - restricts AV1 codec to standard definition videos
> "Always prefer AV1" - applies the codec across all available resolutions
— https://filmora.wondershare.com/youtube/av1-settings-on-youtube.html (DOCUMENTED)
A community userscript sets this key directly to force behavior without visiting the settings
UI:
```js
// from "Disable YouTube AV1 and VP9" (greasyfork.org/scripts/466132), MIT-licensed
Object.defineProperty(localStorage.constructor.prototype, 'yt-player-av1-pref', {
  get() { if (this === localStorage) return '480'; return this.getItem('yt-player-av1-pref'); },
  set(nv) { this.setItem('yt-player-av1-pref', nv); return true; },
  enumerable: true, configurable: true
});
// comment in source: "the setting to disable AV1 [ 480p (or below) - AV1, above 480p - VP9 ]"
```
(MEASURED-BY-SOURCE in the sense that this is the userscript author's working code, not
independently re-verified by me against a live YouTube session this session.)
**Caveat found by reading the source closely: `'480'` only suppresses AV1 ABOVE 480p** — at
or below 480p (i.e. exactly the ~426p regime this app measured at) AV1 can still be selected.
A separate script "Use YouTube AV1" documents `'8192'` as a value that forces AV1 on for all
resolutions — implying the key is a resolution-threshold pref, not a clean on/off switch;
I could not fetch that script's source directly this session (403) to confirm a documented
"never" value — **treat "is there a value that fully disables AV1 including at SD" as
SPECULATIVE / needs direct experimentation.**

*(b) Browser-API spoofing — MEDIUM RISK, DOCUMENTED, proven mechanism (h264ify family)*
`h264ify` (Chrome extension, MIT) overrides `HTMLVideoElement.prototype.canPlayType` and
`MediaSource.isTypeSupported` to lie about codec support:
> "The extension intercepts and modifies the responses from HTMLMediaElement.canPlayType()
> and MediaSource.isTypeSupported()... returns false for unsupported codecs while returning
> true only for H.264." — https://github.com/erkserkserks/h264ify (via search synthesis;
> DOCUMENTED, well-known extension, 4M+ historical users)
`enhanced-h264ify` (fork, MIT) generalizes this to a configurable blocklist including AV1.
Exact source (fetched directly this session, `src/inject/inject_codec_check.js`,
https://github.com/alextrv/enhanced-h264ify, MIT license):
```js
function override() {
  var videoElem = document.createElement('video');
  var origCanPlayType = videoElem.canPlayType.bind(videoElem);
  videoElem.__proto__.canPlayType = makeModifiedTypeChecker(origCanPlayType);
  var mse = window.MediaSource;
  if (mse === undefined) return;
  var origIsTypeSupported = mse.isTypeSupported.bind(mse);
  mse.isTypeSupported = makeModifiedTypeChecker(origIsTypeSupported);
}
function makeModifiedTypeChecker(origChecker) {
  return function (type) {
    if (type === undefined) return '';
    var disallowed_types = [];
    if (localStorage['enhanced-h264ify-block_av1'] === 'true') disallowed_types.push('av01', 'av99');
    if (localStorage['enhanced-h264ify-block_vp9'] === 'true') disallowed_types.push('vp9', 'vp09');
    // ...
    for (var i = 0; i < disallowed_types.length; i++) {
      if (type.indexOf(disallowed_types[i]) !== -1) return '';
    }
    return origChecker(type);
  };
}
override();
```
This is a ~15-line, self-contained, MIT-licensed pattern (NOT copyable verbatim per the repo's
hard rule against GPL/AGPL — MIT is fine to reimplement/adapt, but this is straightforward
enough to reimplement from first principles regardless). **Limitation found while reading it:
it does NOT override `MediaCapabilities.decodingInfo()`.** If YouTube's player consults
`decodingInfo()` in addition to (or instead of) `isTypeSupported()` on some code path, this
class of override is incomplete — no source found this session confirming whether YouTube's
current player actually calls `decodingInfo()` for its main ABR codec choice (vs. only
`isTypeSupported()`); the community scripts only override the older two APIs, which is some
evidence YouTube's live codec-selection path still runs through them, but not proof.

**Chromium software AV1 in the WebView itself** — DOCUMENTED
> "Chromium has enable_dav1d_decoder / enable_av1_decoder build config flags" used when
> building Android WebView — search-synthesis over Chromium's build docs (DOCUMENTED,
> low-confidence citation quality — I could not pull an exact gn arg reference this session).
> `libgav1` also exists as a Google-authored alternative AV1 decoder in Chromium's codecs repo:
> https://chromium.googlesource.com/codecs/libgav1/ (DOCUMENTED)
Net effect: yes, System WebView's Chromium build ships a software AV1 decode path the same
way Chrome-for-Android does; there is no reason to think WebView is exempt from the 2024
regression described above.

---

## 2. Chromium Android video overlay / hardware-plane promotion, and what covering the video costs

**Central finding: inline (non-fullscreen) `<video>` in Android WebView is NOT generally
hardware-overlaid in the first place** — DOCUMENTED, direct Google-engineer quote, high
confidence, and this reframes the whole question.

From a Chromium `android-webview-dev` mailing-list thread (Alexandre Elias, Chromium/WebView
engineer), on being asked to force `SurfaceView` for all inline HTML5 video:
> "it's impossible to support all HTML/CSS features correctly when using SurfaceView, so EME
> inline video using it is a compromise we're not especially happy with."
> "texture-based video consumes more power [than SurfaceView]"
> "this seems like an implementation detail of WebView so I don't think we'd want to provide
> an app-side API to force a particular behavior."
— https://groups.google.com/a/chromium.org/g/android-webview-dev/c/hS_dNQXQLcY (MEASURED-BY-SOURCE — direct engineer statement, not a benchmark, but authoritative)

A second, independent thread states the underlying reason plainly:
> "WebView is limited to using SurfaceTexture due to the compositing model [...] the GPU is
> required to composite and display frames (even in fullscreen)."
— surfaced via search synthesis of https://groups.google.com/a/chromium.org/g/chromium-dev/c/OSxkwV-h-_M (DOCUMENTED)

**What this means for the app:** WebView must synchronously composite the page's DOM (our own
overlay divs, chrome, etc.) together with whatever the `<video>` element shows, on every frame,
in lockstep with the rest of the page — a real `SurfaceView`/hardware-overlay handoff to
SurfaceFlinger would break that synchronization (the overlay is a *separate* compositor layer
outside WebView's control). So for **inline** playback (the case here — video stays inside
`#movie_player`, not real HTML5 Fullscreen), the video was almost certainly **already** being
GPU-composited as a `GL_TEXTURE_EXTERNAL_OES` `SurfaceTexture`, not rendered through a
hardware overlay/SurfaceView plane, even before this app's delay-line canvas existed. This
means: **replacing the real `<video>` with a same-size `<canvas>` presenting a copied frame is
very unlikely to be "falling off" a hardware overlay path that never existed for inline video
in WebView** — the cost of the new architecture is the *copy itself* (already measured at
~4 points), not a lost overlay.

**Where a real overlay/SurfaceView DOES exist: true HTML5 Fullscreen.**
> "When you promote a video to fullscreen with the HTML5 fullscreen API, you get both a
> fullscreen SurfaceView for the video (provided to you via onShowCustomView), and the WebView
> will draw the other web content transparently onto the default application surface on top
> of the video." — search synthesis of https://groups.google.com/a/chromium.org/g/android-webview-dev/c/hS_dNQXQLcY (DOCUMENTED)
This matches this app's own commit history (session notes describe a custom `WebChromeClient`
`onShowCustomView` delegate wired up specifically to make YouTube's HTML5-Fullscreen API work
in this WebView). **If/when the user goes real HTML5 fullscreen, the video plausibly IS on a
true SurfaceView overlay, and covering it with the canvas+blur presenter would force a real
demotion off that path back to GPU compositing** — this is the one place the "falls off
overlay" cost model is plausible and worth measuring specifically (the delay-line architecture
should be A/B'd windowed vs. fullscreen).

**Android 12+ `SurfaceControl` / `WebViewSurfaceControl`** — DOCUMENTED, existence confirmed,
default-status NOT confirmed this session.
- Chromium tracks a `WebViewSurfaceControl` base::Feature and has Chromium-bug work items
  "Use SurfaceControl for video overlays on Android" (https://issues.chromium.org/issues/40595450,
  https://bugs.chromium.org/p/chromium/issues/detail?id=889328) — DOCUMENTED, this is real,
  ongoing/landed Chromium infrastructure using `ASurfaceControl`/`ASurfaceTransaction`
  (Android 10+ API) to let WebView composite an overlay surface without going through the
  view hierarchy.
- Could not confirm from source this session whether `WebViewSurfaceControl` is enabled by
  default on WebView-Chromium-151 on Android 12/16, nor whether it changes the calculus above
  for *inline* (as opposed to fullscreen) video specifically — **flag as SPECULATIVE /
  unresolved; worth checking `chrome://gpu`-equivalent (`WebView DevTools` app, if the phone
  can be made userdebug, or via `about://gpu` in a raw Chrome-for-Android session on the same
  device to see if "Surface Control" reads "Enabled").**
- No known way for an app to force this feature on for its own WebView instance in a
  production (non-userdebug) build — see §6.

**Cost of the GPU-composited (texture) path vs. an overlay** — DOCUMENTED, but the specific
number is from macOS, not Android:
> "when Chromium enabled overlays on macOS, power consumption during fullscreen video
> playback was halved" — https://developer.chrome.com/articles/videong (MEASURED-BY-SOURCE,
> but macOS, not Android — cite as directional evidence only, not a transferable number)
Android-specific magnitude not found this session. The Elias quote above ("texture-based
video consumes more power") is qualitative only.

---

## 3. Cost of `createImageBitmap(video)` and cheaper alternatives on Android

**`createImageBitmap(HTMLVideoElement)` GPU-backed status** — DOCUMENTED but dated/uncertain.
A 2020-era GPU-Web working-group note states:
> "When creating an image bitmap from a video element, it could potentially be GPU backed, but
> as of 2020 there was no architecture for that yet." — https://github.com/gpuweb/gpuweb/wiki/GPU-Web-2020-06-23-VF2F-Day-2 (DOCUMENTED, but 6 years stale relative to this app's Chromium ~151 — treat the *current* GPU-backed status of `createImageBitmap(video)` on Android as SPECULATIVE/unresolved, worth direct profiling)
The same discussion frames the two extremes clearly:
> "From a video element to WebGL via texImage2D, the path is accelerated GPU-to-GPU, but
> everything else is CPU." (same source, DOCUMENTED)
This matches the app's own measurement (createImageBitmap costing ~4 points): it is consistent
with `createImageBitmap(video)` still going through a CPU-visible copy on this Chromium build,
even if in principle Chromium *could* keep it GPU-resident.

**Cheaper alternatives, ranked by how zero-copy they are on Android:**

1. **WebGL `texImage2D(gl.TEXTURE_2D, ..., video)`** — DOCUMENTED as the accelerated path
   ("accelerated GPU-to-GPU", above). Internally Android/Chromium can bind the video's
   `SurfaceTexture` as a `GL_TEXTURE_EXTERNAL_OES` sampler without a CPU round-trip:
   > "The texture object uses the GL_TEXTURE_EXTERNAL_OES texture target... any OpenGL ES 2.0
   > shader that samples from the texture must declare its use of this extension."
   — Android SurfaceTexture docs, DOCUMENTED (https://stuff.mit.edu/afs/sipb/project/android/docs/reference/android/graphics/SurfaceTexture.html — mirror of official Android docs)
   > "For the non sync-IPC case (and for Chromium on Android/Clank), relying on passing the
   > EXTERNAL_OES texture directly in a resource and drawing from it without a copy" —
   search synthesis, DOCUMENTED, Chromium-internal zero-copy path exists for Android.
   **This is the most promising concrete lever**: draw the video into a `WebGL`/`OffscreenCanvas`
   context (not 2D canvas) each rAF tick and read pixels back only where actually needed (e.g.
   downsample for inference) rather than doing a full-resolution `createImageBitmap` copy for
   the *presentation* ring. Caveat: this app's ring needs a *retained* 1.5s buffer of full
   frames (for the delay line), not just the current frame — so this alone doesn't replace the
   ring, but a GL-texture-based ring (copying GPU texture→texture instead of
   video→ImageBitmap→canvas) could be cheaper than the current path if Chromium's WebGL path is
   genuinely zero-copy on these SoCs. Not independently benchmarked this session — SPECULATIVE
   magnitude, DOCUMENTED mechanism.

2. **WebGPU `importExternalTexture(video)`** — DOCUMENTED to exist and be zero-copy by design,
   but Android WebView support is uncertain.
   > "WebGPU is now enabled by default in Chrome 121 on devices running Android 12 and greater
   > powered by Qualcomm and ARM GPUs... initial target is Android 12+ on devices with Adreno
   > (Qualcomm) or Mali (ARM) GPUs. This is estimated to cover about half of WebGPU-capable
   > Android devices." — https://developer.chrome.com/blog/new-in-webgpu-121, https://www.osnews.com/story/138330/webgpu-comes-to-chrome-121-for-android/ (DOCUMENTED)
   Both test SoCs (Adreno 613, Mali-G52) are exactly the vendor families targeted, and WebView-
   Chromium-151 is ~30 major versions past 121, so WebGPU is plausibly available — **but this
   is "Chrome for Android," and I could not confirm this session whether Android *System
   WebView* ships WebGPU on the same schedule/allowlist as the Chrome app**, nor whether these
   specific low/mid-tier GPUs are inside the "half of WebGPU-capable devices" allowlist (the
   allowlist is GPU-driver-based, and both are older/entry-tier GPUs that may be excluded).
   `importExternalTexture` itself: "needed for efficient video processing... Chrome on Android
   works if your users have recent enough hardware" (search synthesis, DOCUMENTED intent,
   unconfirmed on these exact devices). **Flag as the single most interesting thing to
   feature-detect at runtime (`navigator.gpu` truthy + a real `requestAdapter()` call) before
   investing engineering time — if unsupported, this whole avenue is closed on these phones.**

3. **`VideoFrame` (WebCodecs) `.copyTo()`** — already effectively ruled out by prior work
   noted in the prompt (a *live* `VideoFrame` ring was measured to stall MediaCodec by holding
   output buffers). `copyTo()` on a single frame (grabbed via
   `new VideoFrame(video, {...})`, copied, then immediately `.close()`d to release the codec
   buffer) is architecturally different from *holding* a ring of live `VideoFrame`s — no
   source found this session benchmarking that narrower pattern specifically; SPECULATIVE
   whether "grab, copy, close-immediately" avoids the MediaCodec-buffer-starvation problem
   already found, but it is a structurally different claim from what was already rejected and
   may be worth one narrow experiment (allocate 1 VideoFrame per tick, copy pixels out via
   `copyTo()`, close before the next rAF) rather than assuming it's foreclosed by the prior
   result.

4. **`requestVideoFrameCallback`** — DOCUMENTED as metadata-only, no pixel cost by itself.
   > "allows web authors to register a callback that runs in the rendering steps when a new
   > video frame is sent to the compositor... requestVideoFrameCallback() runs on the main
   > thread, but... video compositing happens on the compositor thread, everything from this
   > API is a best effort" — https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback, https://wicg.github.io/video-rvfc/ (DOCUMENTED)
   Doesn't move pixels; useful only for **scheduling** the ring-copy to the true frame cadence
   instead of an independent rAF/timer poll, which could reduce redundant/duplicate copies if
   the current implementation isn't already frame-locked. Cheap to try, low risk.

5. **`OffscreenCanvas` + 2D `drawImage(video)`** — no evidence this is meaningfully different
   from the current mainthread-canvas `drawImage`/`createImageBitmap` path; 2D-canvas
   `drawImage` of a video is generally implemented as a texture blit + readback-on-demand in
   Chromium, same cost class as `createImageBitmap`. Not separately benchmarked. SPECULATIVE
   that moving to an OffscreenCanvas on a worker would help *this specific* cost (it would move
   *where* the cost is paid — off main thread — but the GPU work is the same); worth trying
   only for main-thread-contention relief, not for reducing total GPU/copy cost.

---

## 4. Fetching a second, lower-resolution DASH stream for inference only

**Technical feasibility — YES, CORS is not a blocker from inside the YouTube page itself.**
> "googlevideo.com has only whitelisted youtube.com [and derivatives]... includes
> `access-control-allow-origin: https://www.youtube.com`" — search synthesis over
> https://github.com/fent/node-ytdl-core/issues/75 and related threads (DOCUMENTED)
Since this app's WebView is loaded *at* `https://m.youtube.com` (i.e., the page's own origin
matches what googlevideo.com already allows for YouTube's own player), a `fetch()` from page-
context JS to the DASH segment URLs YouTube's own player already parsed out of the page
response would carry a same-family Origin header and is very likely to succeed exactly the way
YouTube's own player's own fetches do — this is NOT a cross-origin problem for this
architecture the way it is for a third-party downloader site. (SPECULATIVE that the exact
`m.youtube.com` origin is on the allowlist alongside `www.youtube.com` — not directly
confirmed this session, but highly likely since it's the same first-party property.)

DASH adaptive formats are well documented (itags): video-only tracks (e.g. itag 137 for 1080p)
and audio-only tracks are separately fetchable and mergeable — https://gist.github.com/AgentOak/34d47c65b1d28829bb17c24c04a0096f, https://pytubefix.readthedocs.io/en/latest/user/streams.html (DOCUMENTED, from third-party tooling that has reverse-engineered YouTube's format table, not from Google).

**The real blocker is policy/ToS, not technology, and it lands squarely on the app's own hard
rules.** — DOCUMENTED
> YouTube's ToS prohibits "access[ing] the Service using any automated means (such as robots,
> botnets or scrapers) except (a) in the case of public search engines, in accordance with
> YouTube's robots.txt file; or (b) with YouTube's prior written permission."
> "you must not reverse engineer undocumented YouTube API services or otherwise attempt to
> derive the underlying source code of these API services."
— https://developers.google.com/youtube/terms/developer-policies, https://www.youtube.com/static?template=terms (DOCUMENTED)
Parsing YouTube's internal DASH manifest / itag scheme to pull a *second, independent* stream
purely for our own internal use (never shown to the user, never re-served) is exactly the kind
of "derive additional value from the platform's undocumented delivery mechanism beyond what it
was rendered for" that sits in the same family the project's own CLAUDE.md flags as
off-limits in spirit ("never modify, repackage or impersonate platform apps") even though it
is not literally modifying the app or unlocking a paid feature. **This is a policy/hard-rule
risk call for the owner, not an engineering one** — flagged HIGH RISK in the table below
regardless of technical feasibility.

---

## 5. `video.playbackRate = 0.95` as drop mitigation

**Pitch preservation** — DOCUMENTED, this is the default and needs no extra code:
> "HTMLMediaElement.preservesPitch... determines whether or not the browser should adjust the
> pitch of the audio to compensate for changes to the playback rate... The default value...
> defaults to true." — https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch (DOCUMENTED)
So `playbackRate = 0.95` alone, with `preservesPitch` left at its default `true`, plays audio
5% slower in wall-clock time but at the same pitch (Chromium runs a time-stretching algorithm
internally, not documented in detail in what I found this session — DOCUMENTED that it
happens, SPECULATIVE on exact algorithm/cost).

**Cost** — not directly measured this session. Audio time-stretching is normally a cheap DSP
operation relative to video decode/inference; the more relevant effect for this app is that a
5% rate cut reduces required video decode+present throughput by the same ~5% (fewer real-time
frames need to be produced per wall-clock second), which is a legitimate, very low-risk lever
against dropped frames — but it is capped: it can shave a few points off a 13%-drop number at
best, not fix a structural bottleneck, and it changes user-perceptible timing (5% slower
video/audio, imperceptible to most viewers at this magnitude but not zero — this is a
UX/product call, not purely technical).

---

## 6. Chromium/WebView command-line flags and whether an app can set them

**Confirmed dead end for a production APK on consumer phones.** — DOCUMENTED, direct
Chromium documentation:
> "WebView always looks for the same file on the device
> (`/data/local/tmp/webview-command-line`), regardless of which package is the WebView
> provider." ... "this guide only applies to userdebug/eng devices and emulators... most
> users and app developers do not have debuggable devices, and therefore cannot follow this
> guide." — https://chromium.googlesource.com/chromium/src/+/refs/heads/main/android_webview/docs/commandline-flags.md (DOCUMENTED, official Chromium/WebView doc)
Both test phones (retail Redmi 9, Redmi 13 4G) are almost certainly `user` (production)
builds, not `userdebug`/`eng`, unless deliberately rooted/custom-ROM'd — this route is closed
without rooting the test devices, and is **entirely unavailable to real end users' phones in
production**, so it cannot be part of the shipping app's strategy at all, only a local dev/test
aid on a rooted device.
No app-side API was found this session (manifest flag, `WebSettings`, `ProcessGlobalConfig`,
`WebViewCompat`) that lets a packaged app set Chromium feature flags for its embedded WebView
on a non-debuggable device — the only production-device path Chromium's own docs mention is
the separate **WebView DevTools app** ("If you need to toggle flags on production Android
devices, you can use WebView DevTools"), which is a *user*-facing settings app, not something
this app's own code can drive programmatically, and still requires the *user* to have that
app and manually toggle flags — not viable as a shipped mitigation.

Feature-flag *names* that exist in Chromium relevant to this area, found but not confirmed
default-status on WebView-151/these SoCs:
- `WebViewSurfaceControl` (base::Feature, exists, Android SurfaceControl for WebView) — see §2.
- `UseSurfaceLayerForVideo` — DOCUMENTED to exist as a general (not Android-specific)
  Blink/cc compositor concept with modes `kNever` / `kOnDemand` (PiP only) / `kAlways`,
  governing `SurfaceLayer` vs `VideoLayer` for video compositing — this is a layer-type
  choice inside Chromium's compositor, not directly the same as the Android hardware-overlay
  question in §2, and I could not establish this session whether it's Android-specific or
  cross-platform, nor its current default. Treat as tangential/DOCUMENTED-to-exist only.
None of these are reachable from a production app without the command-line-flags mechanism
above, so they are moot for a shipping build regardless of what they'd do if enabled.

---

## Ranked table

| Idea | Expected gain on dropped frames | Effort | Hard-rule risk |
|---|---|---|---|
| **Read the active codec off the live page** ("Stats for nerds" string / intercept DASH manifest in the existing ad-block interceptor) to confirm whether AV1 is actually being served to either test phone today | N/A (diagnostic) — but gates every other codec idea's expected value; if AV1 isn't actually in play, none of §1's ideas matter | Low (read-only, uses existing request interceptor) | None |
| **Set `localStorage['yt-player-av1-pref']` before player init (Wire it through the existing rules/scriptlet injection)** | Low-medium at this app's ~426p resolution specifically (the documented `'480'` value only suppresses AV1 *above* 480p — may be a no-op at 426p); unknown if a true "never" value exists | Low (one localStorage write, first-party YouTube mechanism, no API spoofing) | Low — this is YouTube's own exposed setting, not a lie to the browser |
| **Override `MediaSource.isTypeSupported`/`canPlayType` to reject `av01`** (h264ify-style, ~15 lines, MIT-precedented pattern) | Medium if AV1-with-software-fallback is confirmed live on these phones (falls back to hardware VP9, which both SoCs decode natively); zero if AV1 isn't actually being served | Low (self-contained injected script) | Medium — actively misrepresents browser capabilities to the page; more invasive than the localStorage lever, though same broad category as many ad-block/quality scriptlets already in the codebase |
| **`video.playbackRate = 0.95` with default `preservesPitch=true`** | Low, capped (~5% throughput headroom at best) | Very low (one line) | None, but a real (small) UX change — needs product sign-off |
| **Feature-detect and try WebGL `texImage2D(video)` (or WebGPU `importExternalTexture` if available) for the ring-copy instead of `createImageBitmap`** | Potentially the single largest lever on the measured ~4-point ring-copy cost, IF Chromium's path is genuinely GPU-resident on these SoCs (unconfirmed) | Medium-high (rework the ring/present pipeline around a GL/WebGPU texture instead of ImageBitmap+2D canvas; must still solve the "retain 1.5s of frames" requirement, not just "read one frame cheaply") | Low — pure client-side rendering technique, no interaction with platform content delivery |
| **Narrow retry of a single-shot `VideoFrame.copyTo()` per tick (allocate → copy → close immediately, never hold a ring of live frames)** | Unknown; structurally different from the already-rejected live-ring approach, may avoid the MediaCodec buffer-starvation problem | Medium (one bounded experiment) | Low |
| **`requestVideoFrameCallback` to gate the ring-copy to true frame cadence** | Low-medium, only helps if current copy cadence is currently redundant/mismatched to actual frame delivery | Low | None |
| **Investigate whether `WebViewSurfaceControl`/hardware overlay is reachable at all for inline video** | Very likely near-zero — evidence strongly suggests inline WebView video was never on a hardware-overlay path to begin with (SurfaceTexture/GPU-texture only), so there's no overlay to "get back" for the windowed (non-fullscreen) case this app actually uses | Research already mostly done (this doc); further work is low-value | None |
| **A/B measure real HTML5-Fullscreen video specifically** (the one place a true SurfaceView overlay plausibly exists) vs. covering it with the delay-line canvas | Unknown but plausibly the one place a real "fell off overlay" cost exists — worth a targeted measurement before assuming §2's "no overlay to lose" conclusion applies to every player state | Low (instrumentation only) | None |
| **Fetch a second, lower-resolution DASH stream from YouTube purely for inference** | Could meaningfully cut inference-input decode/resize cost (separate from this doc's presentation-path focus) — not sized here | Medium (parse YouTube's own internal player-response format, an undocumented API) | **HIGH — conflicts with YouTube ToS ("no automated means... no reverse-engineering undocumented API services") and sits in the same family the project's own hard rules single out ("never derive additional value from the platform beyond what it renders for the user"); this is an owner policy call, not just an engineering one, regardless of the fact it is technically feasible (CORS is not a blocker since the page's own origin already has access)** |
| **Any Chromium command-line-flag / `--enable-features=...` route** (WebViewSurfaceControl, UseSurfaceLayerForVideo, etc.) | N/A | N/A | **Dead end as shipped** — requires a userdebug/eng device or the user-facing WebView DevTools app; not controllable from the app's own code on a production phone. Confirmed by Chromium's own docs. |

---

## Sources (deduplicated)

- https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo
- https://dev.to/masonwritescode/av2-shipped-its-10-encoder-heres-what-to-actually-run-in-your-pipeline-instead-pfa
- https://www.androidpolice.com/youtube-google-av1-codec-android-video/
- https://www.sammobile.com/news/youtube-av1-decoding-battery-life-smoothness-issues-older-galaxy-devices/
- https://www.testmuai.com/learning-hub/av1-browser-support/
- https://chromium.googlesource.com/external/github.com/videolan/dav1d/
- https://chromium.googlesource.com/codecs/libgav1/
- https://nanoreview.net/en/soc/mediatek-helio-g85
- https://www.mediatek.com/tek-talk-blogs/mediatek-and-youtube-enable-av1-video-streams-on-android
- https://scientiamobile.com/av1-codec-hardware-decode-adoption/
- https://www.notebookcheck.net/Qualcomm-Adreno-613-Benchmarks-and-Specs.855460.0.html
- https://filmora.wondershare.com/youtube/av1-settings-on-youtube.html
- https://greasyfork.org/en/scripts/466132-disable-youtube-av1-and-vp9/code (raw source fetched directly)
- https://github.com/erkserkserks/h264ify
- https://github.com/alextrv/enhanced-h264ify (raw source fetched directly: src/inject/inject_codec_check.js, MIT)
- https://groups.google.com/a/chromium.org/g/android-webview-dev/c/hS_dNQXQLcY
- https://groups.google.com/a/chromium.org/g/chromium-dev/c/OSxkwV-h-_M
- https://developer.chrome.com/articles/videong
- https://issues.chromium.org/issues/40595450
- https://bugs.chromium.org/p/chromium/issues/detail?id=889328
- https://github.com/gpuweb/gpuweb/wiki/GPU-Web-2020-06-23-VF2F-Day-2
- https://stuff.mit.edu/afs/sipb/project/android/docs/reference/android/graphics/SurfaceTexture.html
- https://developer.chrome.com/blog/new-in-webgpu-121
- https://www.osnews.com/story/138330/webgpu-comes-to-chrome-121-for-android/
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
- https://wicg.github.io/video-rvfc/
- https://github.com/fent/node-ytdl-core/issues/75
- https://gist.github.com/AgentOak/34d47c65b1d28829bb17c24c04a0096f
- https://pytubefix.readthedocs.io/en/latest/user/streams.html
- https://developers.google.com/youtube/terms/developer-policies
- https://www.youtube.com/static?template=terms
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch
- https://chromium.googlesource.com/chromium/src/+/refs/heads/main/android_webview/docs/commandline-flags.md
