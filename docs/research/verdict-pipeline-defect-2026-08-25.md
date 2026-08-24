# Verdict pipeline: why no track ever sees a certain read (2026-08-25)

Read-only review. Files: `app/gaze/src/init-entry.js` (working tree, uncommitted).

## Root cause

`init-entry.js:554-557`, inside `memoryLookup()`:

```js
var dbg = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || { mem: 0, sims: [] });
dbg.mem = identityMemory.length;
dbg.sims.push(Math.round(m.sim * 100) / 100);   // <-- TypeError
```

`memoryLookup` is the ONLY site that seeds `__TS_GAZE_IDS` with a `sims`
array. At HEAD that was safe: it was one of only two probe sites
(`grep __TS_GAZE_IDS` on `git show HEAD:...` = lines 549, 1026) and it
ran first.

The diagnostic instrumentation added in the working tree introduced six
more probe sites, all of the form `window.__TS_GAZE_IDS || {}` — no
`sims` key:

- `:811` watchdog `timeouts`
- `:945` gender `reads`
- `:972` attribution `attr`
- `:1105` `vEnter` / `vE` / `vP`
- `:1130` `faceStage`
- `:1167` `errs`

`:1105` (`vEnter`) runs synchronously at the top of every verdict pass,
before any `observePerson`. From that instant `window.__TS_GAZE_IDS` is a
plain `{}`. The first `memoryLookup` call with a non-null descriptor then
evaluates `undefined.push(...)` and throws
`TypeError: Cannot read properties of undefined (reading 'push')`.

## How the throw kills the pass

`:1170-1179`:

```js
chain = chain.then(function () {
  return observePerson(p).catch(function (e) { /* errs probe */ throw e; })
    .then(function (obs) {
      obs.verdictDt = verdictDt;
      obs.remembered = memoryLookup(obs.desc);   // :1176  THROWS
      observations.push(obs);                     // :1177  never runs
    });
});
```

The throw is in the `.then` AFTER `observePerson`, so:

- `chain` rejects -> `chain.then(...)` at `:1181` is skipped -> `vDone`
  never increments, `observations` is never returned.
- the rejection propagates to the outer `.catch` at `:1268` and is
  swallowed as `console.warn('tamescroll gaze: person pass failed', e)`.
- `.finally` at `:1285` still runs, so `sampling` clears and the next
  pass starts normally — which is why the loop keeps ticking instead of
  freezing.
- the `errs` probe at `:1167` wraps `observePerson` only, so it records
  nothing.
- the 900ms watchdog inside `observePerson` never fires: `observePerson`
  resolved fine.

Net effect: **every verdict pass that actually observes a person with a
face descriptor is destroyed after the gender read and before the
tracker.** The only verdict passes that survive to `vDone` are the ones
where `all` came out empty (no MoveNet person AND no extra face), which
resolve `chain` immediately with `observations === []`.

`updatePersonTracks` therefore only ever receives position-only batches
or empty ones. `matchedStep`'s `positionOnly` branch preserves
`lastVerdict`, `clearStreak`, `clearMs` verbatim, so a track initialised
`blurred` stays `blurred` for the life of the video regardless of how
correct the model is.

## Against the eight measurements

| # | Measurement | Accounted for by |
|---|---|---|
| 1 | Gender reads 55/63 male, cert 0.89 | `reads` probe at `:945` is pushed inside `observeCropped`, before the throw. Model is fine; verdict is discarded downstream. |
| 2 | `own:0`, meta `c!` on most reads | `attr` probe at `:972`, also before the throw. Attribution is fine. |
| 3 | Every track `uncertain` / streak 0 / blurred forever | Tracker only ever sees `positionOnly` batches; `matchedStep` preserves verdict fields. |
| 4 | 109-117 batches/22s, ZERO non-positionOnly; batches `P`, `P+P`, `""` | `P`/`P+P` = the `!wasVerdict` early return at `:1094`. `""` = a verdict pass whose `all` was empty (the only kind that survives). Every populated verdict batch was destroyed at `:1176`. |
| 5 | `vEnter` 51, `vDone` 12, and all 12 of length 0 | 51 verdict passes entered; 39 threw at `:1176`; the 12 that reached `:1183` are exactly the empty-`all` passes. The correlation "completes ⇔ length 0" is the signature of this bug, not a coincidence. |
| 6 | Watchdog 0, `errs` 0, gender probe ~40/22s | The failure is after `observePerson` resolves and outside the `errs` catch. Gender probe fires because it is upstream of the throw. |
| 7 | One sampler, one `<video>` | Consistent — this is a single-loop bug, no racing needed. |
| 8 | `dropped` 0 | The epoch guard at `:1211` is downstream of the rejection; the 39 failing passes never reach it. |

## Hypotheses from the brief, ruled in/out

- **Dropped `return` in the inner chain** — RULED OUT. `:1119` returns the
  `detectFaceBoxes` chain, `:1094` returns the position-only array,
  `:1181` returns `chain.then(...)` which returns `observations` at
  `:1200`. Every path is returned.
- **`persons` empty specifically on verdict passes / tensor double-use** —
  RULED OUT. `wasVerdict` is decided at `:1075`, before `detectPersons`
  at `:1078`; nothing about the pass differs at that point.
  `personPixelSource()` is called separately at `:1078` and `:1119`, and
  `detectPersons`/`detectFaceBoxes` each build and dispose their own
  tensors inside `tf.tidy`. No shared tensor, no double-consumption.
- **`picked`/`rest`/`all` empty via round-robin or `.catch`** — REAL but
  only explains the 12 surviving zero-length passes, not the 39 lost
  ones. The round-robin block at `:1132-1149` always returns
  `ZOOM_MAX_PERSONS` entries when `all.length > 3`, so it cannot empty a
  non-empty `all`.
- **`now` / `wasVerdict` / `myEpoch` closure capture** — RULED OUT. All
  are `var`s local to each `sampleOnce()` invocation; and the `sampling`
  guard at `:1060` prevents overlap anyway.
- **`.finally` attached to a chain excluding the verdict work** — RULED
  OUT. `.finally` at `:1285` sits on the outermost chain, which includes
  the verdict work via the returns above.
- **"Is `observations` a different closure than the outer `.then` reads?"**
  — NO. `observations` is declared at `:1157` and returned at `:1200`
  through `chain.then`; the outer `.then` at `:1205` receives that exact
  array. The array is correct; the pushes never happen.

## Minimal patch

`app/gaze/src/init-entry.js:554`

```diff
-      var dbg = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || { mem: 0, sims: [] });
+      var dbg = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
+      if (!dbg.sims) dbg.sims = [];
       dbg.mem = identityMemory.length;
       dbg.sims.push(Math.round(m.sim * 100) / 100);
```

Recommended hardening in the same diff (`:1176`) so no probe can ever
again take down a verdict:

```diff
-                        obs.remembered = memoryLookup(obs.desc);
+                        try {
+                          obs.remembered = memoryLookup(obs.desc);
+                        } catch (memErr) {
+                          obs.remembered = null;
+                        }
```

## Second, independent defect found in the same read

`verdictBusy` (`:632`) is set `true` at `:1076` and — at the moment this
review read the file — was never reset anywhere (`grep verdictBusy` =
3 hits: declaration, read, write; the minified bundle confirms it,
`kj` appears 3 times with no `kj=!1`). That alone would allow exactly ONE
verdict pass per video, producing the same permanent-blur symptom by a
different route. The author appeared to be mid-edit adding a
`VERDICT_STALL_MS = 4000` backstop while this review was in progress —
verify it actually clears `verdictBusy` in `.finally` AND on the stall
path before shipping.

## Confirming probe (if the above is disputed)

The dev console will already contain
`tamescroll gaze: person pass failed TypeError: Cannot read properties of
undefined (reading 'push')` once per lost pass. Read
`__TS_GAZE_IDS.sims` after a run: if it is `undefined` while
`__TS_GAZE_IDS.reads` has entries, the diagnosis is proven outright.
