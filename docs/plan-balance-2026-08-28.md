# Balance plan — diagnostics that report themselves, and the accuracy/cost trades (2026-08-28)

Owner's goal, verbatim: "goal is it achieve the best balance between
performance and it actually working."

Builds on docs/research/pain-points-2026-08-28.md (the six recurring
pain points). The cross-cutting finding there drives everything in this
file: **the proof lives on the wrong machine.** Every performance number
this project has ever produced came from a desktop under a 6x CPU
throttle; the complaint exists only on a Helio G88 that this machine has
no adb to. Part A closes that. Part B is what to change once numbers
exist — and what can be changed safely before they do.

Owner-set constraints honoured throughout, non-negotiable:
- Blur patches are SOLID. No holes, no cut-outs, no splitting.
- The player must never break (a broken selector that hides the video
  player is worse than a missed shelf).
- Blur-first: never expose while deciding.
- No nags, ours or the platforms'.
- Nothing that could reveal a person is acceptable as a performance win.

---

# PART A — Diagnostics that report themselves

Owner ask, verbatim: "can't you implement a diagnostics feature in the
app so that it automatically gets reported and such so you can always
check the logs."

## A1. What is collected

One report = one snapshot of a page session, drained from the globals
the pipeline already maintains. Nothing new is instrumented for v1 —
the instrumentation exists; it has just never left the page.

Sources drained (all already in the tree):

| Source | Where it lives today | What it carries |
|---|---|---|
| `window.__TS_GAZE_EVALMS` | init-entry.js:104-108 | bundle eval cost on THIS device, per page load — the single number the "Android re-evals 22MB per page" question needs |
| `window.__TS_GAZE_TIMING` | init-entry.js:3930-3937 (`markLoad`) | per-model load ms + wall-clock At stamps (face/gender/nsfw/person) |
| `window.__TS_GAZE_WORKER` | init-entry.js:418, 3874-3880; fed by worker-client.mjs events | up/ready/loaded:model/loadFailed:model wall clocks, `backend`, `videoBanned`, `timeouts`, `why`, dead |
| `window.__TS_GAZE_IMGDIAG` | init-entry.js:654-661 (`noteImgDiag`), entries at 696, 771, 802, 869, 907 | per-image ring (120): total/load/face ms, wall stamp `t` (gap analysis), `where` (worker/page), verdict `why`, per-face reads (g/s/a/c/k/p), errors |
| `window.__TS_GAZE_IDS.cfg` | init-entry.js:119-124 | EFFECTIVE gating constants (the R15 dead-constant lesson) |
| `__TS_GAZE_IDS.cost` | init-entry.js:3400-3404 | player verdict/pass cost rings (120 each) |
| `__TS_GAZE_IDS.stages` | init-entry.js:3385-3389 | per-pass stage timing ring (120): upload/persons/fullFaces/crops/tracks/end |
| `__TS_GAZE_IDS.slots` | init-entry.js:2745-2796 | raw MoveNet slot diagnostics (40) — score/confident/maxKp/nKp15/h/hk/sk/kb/box/hull/headW ladder |
| `__TS_GAZE_IDS.reads` | init-entry.js:2245-2318 | per-gender-read ring (300): g/s/a/pc/n/v/px/ab/fc/b/nm/ap |
| `__TS_GAZE_IDS.passFails`, `lastFail`, `timeouts`, `dropped`, `kept`, `cuts`, `luma` | init-entry.js various | failure counters, scene-cut stats |
| `window.__TS_GAZE_RENDER()` | video-region.mjs:50-65 | renderStats: raf/overlayFrames/maskCalls/maskWrites/tfWrites/sizeWrites/dispWrites |
| Rust engine state | lib.rs / ota.rs / appupdate.rs | versionCode (appupdate.rs `CURRENT_VERSION_CODE`), rules generation (OTA manifest hash or "embedded"), OTA last-refresh outcome + age, per-platform active-rule counts (`rules_summary` already computes this), injected CSS byte length |
| NEW counters (Rust, trivial) | lib.rs `blocks_request` | per-platform blocked-request count since launch (AtomicU64 map) — pain point #5 has no number today |
| Device facts | Android: Kotlin (`Build.MODEL`, `Build.VERSION.RELEASE`, WebView package version via `WebViewCompat`); desktop: `std::env::consts` + WebView2 version string; page: `navigator.hardwareConcurrency`, `devicePixelRatio`, viewport | the "what hardware is this" half the desktop proxy never had |
| NEW page-side (small) | init-entry.js | PerformanceObserver longtask count + max ms per report window; for watch pages, `loadstart`→`playing` ms of the player video (the SABR/TTFF number, pain point #5) |

**Page identity is a category, never a URL.** The report carries
`platform` (youtube/reddit/x/instagram/facebook — the tile id Rust
already knows) and `kind` derived by a pure classifier from the path
SHAPE only (`watch` / `feed` / `search` / `other`), computed in the page
and never carrying the path itself.

### The exact JSON shape of one report

```json
{
  "v": 1,
  "id": "9f3a1c02d44be871",
  "t": 1756360000,
  "app": { "versionCode": 1036, "versionName": "0.1.36", "os": "android",
           "osVersion": "12", "model": "Redmi 10", "webview": "126.0.6478.122",
           "cores": 8, "dpr": 2.75, "vw": 393, "vh": 851 },
  "page": { "platform": "youtube", "kind": "watch", "gazeMode": "smart",
            "gender": "male", "blurPx": 24, "ageMs": 184211 },
  "engine": { "rulesGen": "ab12cd34", "otaLast": "ok", "otaAgeH": 3,
              "activeRules": 8564, "cssBytes": 35484,
              "blocked": 41, "scriptlets": true },
  "boot": { "evalMs": 2210,
            "timing": { "face": 900, "faceAt": 3100, "gender": 1400,
                        "genderAt": 4500, "nsfw": 0, "person": 4100,
                        "personAt": 9200 } },
  "worker": { "up": 812, "ready": 5210, "backend": "webgl",
              "loadedFace": 3300, "loadedGender": 4900, "loadedNsfw": 5100,
              "videoBanned": null, "timeouts": 0, "dead": false,
              "whyR": null },
  "cfg": { "faceMinPx": 24, "faceMinConf": 0.35, "imgMinScore": 0.4 },
  "images": { "n": 63, "errors": 2, "gapsP50": 210, "gapsP95": 1900,
    "ring": [ { "t": 42100, "ms": 61, "load": 9, "face": 38, "w": 320,
                "where": "worker", "why": "face", "faces": 1, "flagged": 1,
                "reads": [ { "g": "male", "s": 0.76, "a": 34, "c": 0.02,
                             "k": 0.93, "p": 142 } ] } ] },
  "player": { "attached": true, "cost": { "verdictP50": 75, "verdictP95": 190,
              "passP50": 25 }, "passFails": 1, "lastFailR": "person pass: OOM",
              "cuts": 14, "lumaHist": [412, 96, 31, 8, 2, 1],
              "stages": [ { "upload": 4, "persons": 21, "crops": 18,
                            "tracks": 2, "end": 51, "v": 1 } ],
              "slots": [ "0.42/3/0.76/5/0.31/1/1/1027/..." ],
              "reads": [ { "g": "male", "s": 0.81, "a": 33, "pc": 0.02,
                           "n": 1, "v": 0.812, "px": 210, "ab": 0, "fc": 0.94,
                           "b": [0.31, 0.12, 0.52, 0.44] } ] },
  "render": { "raf": 5400, "overlayFrames": 802, "maskWrites": 12,
              "tfWrites": 640, "sizeWrites": 58, "dispWrites": 9 },
  "main": { "longTasks": 12, "longTaskMaxMs": 890 },
  "ttff": { "watchMs": 5200 }
}
```

Rings are truncated at drain time (imgdiag last 40 entries, stages 40,
slots 12, reads 60, cost rings summarised to p50/p95). Target size:
10–40KB serialized, hard cap 64KB.

**The headline unknowns this payload settles on the G88, first report:**
`worker.backend` (the whole worker-video path requires webgl — if the
Android worker lands on CPU, the player path silently never left the
main thread on his phone and nobody knows), `boot.evalMs` (the 22MB
re-eval question), `images.gapsP95` (his "it halts" in one number),
`boot.timing.person` (how long a playing video waits), `ttff.watchMs`
(the m.youtube SABR decision input).

## A2. What must never leave the device — the redaction invariant

The premise of this app is that inference is on-device and nothing about
what the user watches goes anywhere. A diagnostics channel is the single
most dangerous thing this project could add; the invariant has to be
mechanical, not editorial.

**INVARIANT (unit-testable):** the serialized report string
1. contains no substring `://` and no substring `//`;
2. contains no dotted hostname-shaped token (`/[a-z0-9-]+\.[a-z]{2,}/i`);
3. contains no substring of `location.href` longer than 8 characters
   other than the platform's own registered id;
4. has free text ONLY in fields whose key ends in `R` (mnemonic:
   Redacted), each ≤80 chars and passed through `redactFreeText()`,
   which strips URL-like tokens, `?`, `=`, `%`-escapes, and dotted
   tokens before truncation;
5. carries no pixel data, no image sources, no face descriptors, no
   titles, no search terms, no user filter terms, no matched text-signal
   terms, and no content-derived TIME SERIES (histograms only — a 600-
   sample luma-delta series at 10Hz is a content fingerprint; the
   binned histogram is not).

Every string field not ending in `R` must be from a closed enum set or
numeric — the test walks the serialized report and rejects any other
string.

**Fields that violate the invariant TODAY** (they stay in the in-page
globals for local probes, and are dropped or transformed at drain):

- `__TS_GAZE_IMGDIAG[].src` — `(img.currentSrc || img.src).slice(0, 90)`
  at init-entry.js:778 and 875. A thumbnail URL identifies the exact
  video. **Dropped entirely** from the report (the probe keeps it
  locally; it has earned its place in desktop debugging).
- `__TS_GAZE_IMGDIAG[].msg` (init-entry.js:806, 907) — error messages
  routinely embed the failing URL. → `msgR` via `redactFreeText`.
- `__TS_GAZE_WORKER.why` (init-entry.js:3877) and
  `.videoBanned` (init-entry.js:417) — same error-message risk. → `whyR`.
- `__TS_GAZE_IDS.lastFail` (init-entry.js:3379) and `.errs`
  (init-entry.js:3110) — same. → `lastFailR`.
- `__TS_GAZE_IDS.luma` (init-entry.js:1580) — scalar series; ships as a
  6-bin histogram only (rule 5).
- `__TS_GAZE_IDS.log` lines (dbgV/dbgK/dbgX) — our own literals plus
  numbers, but they pass through the redactor anyway; no exceptions.

Defense in depth: Rust re-runs checks 1–2 on every accepted report and
DROPS the report (counting the drop) if they fail — a future page-side
field addition that forgets the redactor gets caught by the second
gate instead of shipping.

## A3. Transport

The constraint set: the phone is remote (no adb, no USB), reports must
arrive without him doing anything ("automatically gets reported"), and
nothing may nag.

A prior constraint shapes everything: **the platform pages cannot POST
to tamescroll.com themselves.** YouTube/Instagram send CSP with
`connect-src` allowlists; a page-context `fetch` to our domain is
blocked. So whatever the upstream is, the report must first hop from
the page to the Rust process, which has no CSP. Two hops, decided
separately:

**Hop 1, page → Rust (both options need it):**
- Android: `addJavascriptInterface` bridge (`TsDiag.submit(json)`),
  the exact pattern ShortcutBridge/UpdateBridge already use
  (MainActivity.kt:540/546). Submit-only: no method returns data, so a
  hostile page can feed garbage but read nothing. Rust treats input as
  untrusted: 128KB cap, JSON parse, schema check, redaction re-scan,
  per-page-load rate limit (4/min).
- Desktop: POST to the synthetic same-origin path
  `/__tamescroll/diag` — the WebResourceRequested handler in lib.rs
  (the one that already answers `synthetic_resource` at lib.rs:547)
  additionally reads the request Content stream for this one path and
  answers 204. Same untrusted-input treatment. (Android's
  `shouldInterceptRequest` cannot read POST bodies, hence the bridge
  there; the URL-parameter alternative is rejected — diagnostics in
  URLs is the exact anti-pattern the privacy rules name, even redacted.)

**Hop 2, Rust → owner. The three candidates:**

(a) **POST to a Cloudflare Worker on tamescroll.com.** He owns the
domain; the `tamescroll` Worker already serves web/index.html. Add
`/api/diag`: accept gzip ≤256KB, write to R2 (or KV) keyed by
receive-time + report id. Pros: fully automatic, checkable from this
machine any time (`wrangler`/R2 list), which is precisely the ask
("so you can always check the logs"). Cons: an open write endpoint
(mitigations: size cap, JSON-only, rate-limit by IP, write-only — no
read path exposed); dependency on his Cloudflare account staying
configured; silent loss if the endpoint 500s and nothing retries.

(b) **Rotating JSON file in app-data + Settings → "Share diagnostics"
(system share sheet).** Pros: zero infrastructure, zero privacy surface
beyond the device until HE acts, works offline, WhatsApp is already
their working channel. Cons: it is not automatic — it converts "always
check the logs" into "ask him to tap share every time", which re-creates
pain point #6's round-trip latency; share-sheet payloads get truncated
or re-encoded by some messengers (send as file attachment, not text).

(c) **Both: file always, POST when enabled, file is the retry queue.**

**Recommendation: (c).** The rotating file is the source of truth and
is written unconditionally (it never leaves the device by itself);
the uploader reads unsent lines from it, POSTs batches to
`https://tamescroll.com/api/diag` from the Rust process (extend
ota.rs's ureq usage with a `http_post_gzip`; ota::http_get at
ota.rs:192 shows the pattern) on launch + every 6h + on
"Check for updates" (piggyback, no new timer visible to the user), and
marks lines sent only on 2xx. POST failure is silent (NO NAGS), costs
nothing, and the share sheet remains as the manual fallback for the
day Cloudflare is misconfigured.

Failure modes, named: endpoint down → file retains, retried next
window, capped so it can never grow unbounded; duplicate uploads after
a crash between POST and mark → server dedupes on report `id`; clock
wrong on device → server stamps receive time, report times are
session-relative anyway; hostile page spamming the bridge → rate limit
+ schema + the reports are worthless to an attacker (write-only, no
read-back); Cloudflare free-tier limits → volume is a few hundred KB a
day at most (A5), nowhere near any limit.

## A4. Consent and default

Two different answers, honestly held apart:

- **For a published open-source app used by strangers: OFF by default.**
  A privacy app that phones home by default is a contradiction its
  own README would be embarrassed by, and the fact that the payload is
  clean does not change what the network tab shows: a POST to the
  developer's domain from an app whose pitch is "on-device, nothing
  leaves". Opt-in via a single Settings → About toggle ("Share
  anonymous performance diagnostics — never what you watch"), one line,
  no onboarding step, no prompt, ever (NO NAGS). The toggle copy links
  the redaction test file — the invariant is auditable, which is worth
  more than any privacy-policy prose.
- **For HIM: he flips that toggle once on his phone and it persists**
  (localStorage like every other setting, mirrored to Rust via a
  `set_diag_enabled` command like set_gaze_mode; app-data survives APK
  updates, so it stays on across releases). That costs him one tap,
  once, ever — against the alternative of a special-cased build flag
  for one device, which an open repo cannot carry without looking like
  a backdoor.
- The **local rotating file is always on** for everyone: it never
  leaves the device on its own, it is what makes "Share diagnostics"
  work for a stranger filing a bug, and it is redacted at write time
  anyway (the invariant applies to the file, not just the upload —
  simpler, and share-sheet leaks are then impossible too).

## A5. Sampling and volume

- **When:** one report per platform page at most every 5 minutes while
  visible, plus one final drain on `visibilitychange → hidden` (the
  reliable mobile "page is going away" signal). Built on
  `requestIdleCallback` — never during a scroll burst, never on the
  verdict path.
- **Cost per report:** draining is reading arrays that already exist +
  one JSON.stringify of ≤64KB — low single-digit ms, off the hot path.
  The rings are already bounded (120/300/40) so the globals themselves
  never grow; nothing new accumulates.
- **Battery/data:** uploads batched from Rust, gzipped (these rings
  compress ~10x), ≤256KB per POST, ≤4 upload windows per day. Worst
  day ~1MB uncompressed, ~100KB on the wire. No wake-ups: uploads ride
  app launch and the existing 24h OTA/update checks.
- **Disk:** `app-data/diag/diag-N.jsonl`, 2MB per file, keep 3, oldest
  deleted. C:-vs-Z: irrelevant — app-data on the phone, and desktop
  app-data is small and capped.

## A6. Files to add/change, and the tests

| File | Change |
|---|---|
| `app/gaze/src/diag-report.mjs` (NEW, pure) | `buildReport(globals, pageFacts)` → report object; `redactFreeText(s)`; `classifyPageKind(pathname)`; ring truncation; luma histogram. No DOM, no side effects — fully unit-testable like pipeline-plan.mjs |
| `app/gaze/src/init-entry.js` | 5-min + hidden drain hook; longtask observer; watch TTFF stamp; submit via `TsDiag` when present, else fetch POST to `/__tamescroll/diag`. Guarded like every probe: a diagnostics throw must never touch a verdict (that rule has already cost two releases) |
| `app/src-tauri/src/diag.rs` (NEW) | accept(json): size cap, schema check, Rust-side redaction re-scan, append to rotating file; upload loop (`http_post_gzip`); sent-line bookkeeping; blocked-request AtomicU64 counters surface |
| `app/src-tauri/src/lib.rs` | `/__tamescroll/diag` POST handling in the existing WebResourceRequested handler; `blocks_request` increments the counter; commands `set_diag_enabled`, `diag_status`, `diag_share_path` added to invoke_handler |
| `MainActivity.kt` | `TsDiag` bridge (submit-only), registered beside TsShortcuts/TsUpdater (line 540); ACTION_SEND share intent for the diag file via the existing FileProvider |
| `app/src/main.ts` + settings pane | About: "Share anonymous diagnostics" toggle (default off) + "Share diagnostics file" button |
| Cloudflare Worker | `/api/diag` route: POST-only, caps, R2 append. **Deploy is outside-visible — owner OK required before it ships**, like every deploy |
| NOT touched | `src-tauri/capabilities/**` — no capability change is needed (Rust-side ureq does the POST; pages get no new powers beyond a submit-only bridge). Anything that did need it stops for an explicit owner OK per the standing rule |

**Tests that pin the invariant** (these are the point; the feature does
not ship without them):
- `app/gaze/test/diag-report.test.mjs`: feed `buildReport` a globals
  fixture where every free-text field is stuffed with URLs
  (`https://m.youtube.com/watch?v=SECRET`, `googlevideo.com` inside an
  error message, an imgdiag entry with a real `src`), assert the
  serialized output violates none of rules 1–5: no `://`, no `//`, no
  dotted-hostname token, no `SECRET`, no `src` key, no non-enum bare
  string, every `*R` field ≤80 chars. Plus: luma arrives as a series,
  leaves as a histogram; rings are truncated to their caps; report
  ≤64KB with maximal rings.
- Same file, property-style: generate 200 random URLs, embed each in
  every free-text slot, assert no 8+-char substring of any survives.
- `diag.rs` unit tests: rotation (write 7MB → 3 files, oldest gone);
  the Rust re-scan drops a report containing `://` and counts it;
  malformed/oversized submissions rejected without panic; sent-line
  bookkeeping survives a simulated crash between POST and mark.
- Existing suites stay green: gaze (272) and cargo (42) untouched by
  default-off.

---

# PART B — The balance plan (pain points 1–5)

Ranked by (owner-visible improvement) / (risk of regressing the
player). Items 1–4 are near-zero player risk and improve accuracy and
cost together; 5–7 carry real risk or need phone numbers first.

### B1. Ship Part A (pain points #2 and #6, and the evidence base for everything else)

Everything below either needs its numbers or needs its regressions
caught on the G88. This is the highest-leverage item in the file and it
cannot regress the player: it reads rings that already exist.
- **Files/mechanism/verification:** Part A above.
- **Measurement that proves it worked:** the first report from the G88
  containing `worker.backend`, `evalMs`, `gapsP95`, `timing.person`,
  `ttff.watchMs`. Every one of those is currently unknown on the only
  device that matters.

### B2. Freeze the look contract (pain point #1 — the pendulum)

The owner settled the look ON REAL HARDWARE on 2026-08-28: hard
rectangle, 8px corners, `FEATHER_FRAC = 0` (video-region.mjs:333),
`BLUR_FRAC = 0.09` / `BLUR_MAX_PX = 72` (:363-364). The audit shows
four moves of one dial in three days because accuracy rounds kept
changing the geometry under the cosmetic dials.
- **Mechanism:** gather the owner-settled constants into one exported
  `LOOK` object in video-region.mjs (values unchanged — this is a
  naming/ownership change, not a tuning change) with a comment naming
  them owner-settled and dated; add a gaze test asserting the exact
  values, so any future round that touches them fails a test with the
  owner's own words in the assertion message instead of shipping to his
  phone. Second half: the gauntlet skill's round log gains a mandatory
  look row (patch count mean/max, dCount/s, breathe/s — the probes
  already measure all three), and the Part A report carries
  `render.sizeWrites`/`dispWrites` rates so a look-moving geometry
  change is visible from the phone.
- **Accuracy/cost trade:** none. Zero runtime cost; pure governance.
- **Verify:** test exists, fails when a constant moves, passes now.
- **Proves it worked:** the next accuracy round's log shows the look
  row; no fifth "low quality" screenshot caused by a dial that moved
  under him.

### B3. Golden input-integrity fixtures (pain point #3 — thresholds tuned over broken inputs)

The stretched-crop defect lived four days and three model swaps in the
image path AFTER being fixed in the video path, and every threshold
calibrated meanwhile was calibrated against distorted faces.
- **Mechanism:** a small embedded fixture set (6–10 known-gender adult
  faces + 2 graphics/title-cards, at 3 native sizes, base64 in the test
  dir — MIT/CC0-sourced) run through BOTH crop paths
  (detector.js `classifyFaceGenders` with and without `{square:true}`,
  detector.js:521-545, and the video path's aspect-preserving crop),
  asserting (i) the tensor reaching faceres is aspect-correct — assert
  on the crop geometry itself, not just downstream scores — and
  (ii) gender scores land in known bands (men ≥0.4, the fixture women
  read as the audit's 0.16–0.28 band under the male reading, childP
  under the gate). Any future preprocessing defect fails a test instead
  of surviving three threshold recalibrations.
- **Accuracy/cost trade:** none at runtime — test-only.
- **The genuine trade nearby, named and taken:** IG explore small faces
  (44–67px) read 0.34–0.40 and are covered by
  `GENDER_IMAGE_MIN_SCORE 0.4`. A size-conditional threshold would
  reveal more small faces at the cost of occasionally revealing a woman
  in a small thumbnail. **Take cover-over-expose**: the constraint says
  nothing that could reveal a person is a valid perf/accuracy win. The
  over-cover stays; the fixtures pin today's bands so the next
  calibration argument starts from data.
- **Verify:** gaze suite; deliberately re-introduce the pixel-square
  crop in a scratch branch of the test and watch it fail.
- **Proves it worked:** zero future sessions spent re-deriving
  thresholds after an input fix (the audit counts three).

### B4. Ad-state evidence + the release gate (pain point #5, the tractable half)

"Ads came back" has arrived four times with zero numbers and, twice,
against a phone that did not have the fix.
- **Mechanism:** (i) the Part A report's `engine` block — rules
  generation hash, OTA age/outcome, per-platform blocked-request count,
  scriptlets-applied flag, injected CSS bytes — so the next "ads came"
  message comes with WHICH rules generation the phone was running and
  whether the network path fired at all (the counter is the one new
  instrument in Part A: an AtomicU64 in `blocks_request`, lib.rs:440).
  (ii) A process rule written into CLAUDE.md's working agreements: an
  ad fix is UNDONE until released AND phone-confirmed — this cluster
  has twice been "fixed" into an unreleased commit.
- **Accuracy/cost trade:** none; a counter increment on a path that
  already parses the request.
- **Verify:** cargo test that a blocked request increments and an
  allowed one does not; counter appears in a desktop report.
- **Proves it worked:** the next ad report is answerable in one session
  from its attached numbers instead of a mechanism hunt.

### B5. Patch validity invariant (pain point #4 — stray/ghost overlays)

Five bespoke fixes, each patching one invalidation path after a
screenshot. `clipToBounds` (video-region.mjs:779, applied at 846) is
the first class-level fix; finish the generalization.
- **Mechanism:** one per-heartbeat validity check for every drawn patch,
  in both overlay owners (video-region.mjs render loop; region-blur.mjs
  heartbeat): host element still connected AND visually rendered
  (`getClientRects().length > 0` — one read, the heartbeat's probe-guard
  already batches reads), patch rect intersects host rect (clipToBounds
  already provides the intersection), playing-state consistent (the
  1034 sweep listener stays). One kill path: `display:none` the patch,
  keep the track (state is not destroyed; the patch returns the moment
  the host is valid again).
- **Accuracy/cost trade:** improves both — ghost patches are the
  accuracy failure he photographs, and skipping reposition work for
  dead hosts is a (small) cost win.
- **The risk, named:** this is the one item where an over-eager check
  could HIDE a legitimate patch — exposure, the cardinal sin. Bound it:
  the kill path may fire only when the HOST is not rendered (nothing
  visible to expose — a patch over an invisible host covers nothing) or
  the intersection is empty (the patch is not over the subject anyway).
  Never on any confidence/heuristic signal. Blur-first is preserved by
  construction.
- **Verify:** probe_stray/probe_stuck pattern over 10 scrolls + SPA
  navs + a preview-play on m.youtube: 0 patches whose host fails the
  invariant; plus the gauntlet exposure gate unchanged (EXPOSURE 0) on
  a full round, because the kill path must never fire during normal
  playback.
- **Proves it worked:** `render.dispWrites` in phone reports stays
  proportional to real hide/show events; no sixth stray-patch
  screenshot class.

### B6. Models out of the page-side eval (pain point #2's biggest candidate) — GATED ON B1 NUMBERS

The page evals the full ~22MB artifact (tfjs + four inlined base64
models) on EVERY page load even when the worker owns all inference and
the page-side models never load. Eval'd strings are never byte-cached
in WebView (measured, session 2026-08-23). If `evalMs` on the G88 is
seconds — plausible; it exists precisely to be measured
(init-entry.js:101-108) — this is the largest single cut available.
- **Mechanism (sketch, to be specced when numbers land):** the build
  emits the model payloads as separate synthetic resources
  (`/__tamescroll/models/<name>.bin`) served by the same interceptor
  that serves the worker script (lib.rs `synthetic_resource`, :429 —
  extended from one static str to a small table); model-embed modules
  fetch same-origin instead of carrying base64. The worker fetches them
  on init; the in-page FALLBACK path fetches them only when it actually
  loads models (worker dead) — the fallback survives intact, it just
  pays its cost only when used. Page-side eval drops to the ~2MB logic
  bundle.
- **Accuracy/cost trade:** none in verdicts — same bytes, same models.
  The trade is complexity risk: the loader path forks, and CSP behavior
  of same-origin fetch on each platform must be verified per site (the
  worker-script precedent says same-origin is the allowed shape, but
  `connect-src` governs fetch, not worker creation — this must be
  MEASURED per platform before commit, the same way the worker was).
- **Why gated:** if evalMs on the G88 is ~300ms, this is complexity for
  nothing; if it is 3–8s per page load, it is the whole "loads a lot"
  complaint. Do not build until a phone report answers.
- **Verify:** desktop first (evalMs before/after, fallback forced via
  `__TS_NO_WORKER` still reaches verdicts on all five platforms), then
  a release and a phone report showing the new evalMs.

### B7. m.youtube SABR / streamingData drop (pain point #5, the risky half) — GATED ON B1 NUMBERS + OWNER OK

Desktop drops `streamingData` from the embedded player response and
measured 24–37s → 4.4–11.5s to first frame. m.youtube deliberately
keeps the old field list "until phone numbers exist" because dropping
the embedded fallback stream on mobile is player-red-line territory.
- **Mechanism:** extend the existing desktop scriptlet's field list to
  the m.youtube payload — the code path exists; the decision doesn't.
- **Trade:** this is pure upside IF the phone shows the same fake-buffer
  stall, and a broken mobile player if m.youtube's player handles a
  missing embedded stream differently. Highest player risk in this
  file, which is why it is ranked last despite "ads are the biggest
  issue we have."
- **Gate:** `ttff.watchMs` from phone reports first. If p50 is already
  <8s on the phone, the stall may not exist there and the risk buys
  nothing. If it is 20s+, bring the owner the number and the desktop
  precedent and let him take the red-line call.
- **Verify:** phone-first by necessity: release behind the OTA rules
  channel where possible so a bad outcome is revertable OTA, and watch
  `ttff.watchMs` move in reports.

### Deliberately NOT proposed

- **A smaller face model** ("the ceiling is now per-image cost"): an
  accuracy call only the owner can make, and only worth making after
  phone reports show the per-image ms and gap numbers on the G88.
  Bring him `images.ring[].ms` percentiles from his own phone plus the
  audit's dead-end list; do not pre-empt the call.
- **Any re-tuning of patch geometry, feather, or margins** — settled by
  the owner on real hardware; B2 exists to keep it settled.
- **The three measured dead ends** (cross-image batching — BlazeFace's
  batch dim is fixed; URL verdict cache — 4–8% hit; scroll budget
  fraction — no effect): recorded as dead, not retried.

## What cannot be settled without numbers from his phone

(= Part A's payload justification, item by item)
1. Worker tfjs backend on Android WebView (`worker.backend`) — decides
   whether the worker-video path runs on his phone AT ALL.
2. Bundle eval cost per page load (`boot.evalMs`) — gates B6.
3. Per-image cost and inter-image gaps (`images.ring[].ms`, `gapsP95`)
   — decides whether the halting is solved, and gates the
   smaller-model conversation.
4. Model load wall-clocks (`boot.timing`, worker `loaded*`) — how long
   a playing video sits whole-blurred on the G88.
5. Watch-page time-to-first-frame (`ttff.watchMs`) — gates B7.
6. Long-task pressure during scroll (`main.longTasks`) — whether
   comments/related still starve behind inference on the G88 (the
   isInputPending yield shipped 1019 and was never phone-verified).
