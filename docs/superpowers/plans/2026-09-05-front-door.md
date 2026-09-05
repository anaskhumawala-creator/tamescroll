# Plan: front door (spec 2026-09-05-front-door.md)

1. Android bridge (`MainActivity.kt`, manifest)
   - `<queries><package android:name="com.google.android.youtube"/></queries>`.
   - `LinksBridge`: `openDefaultApps(pkg)` (ours or YouTube only),
     `openAppInfo(pkg)` (YouTube only), `probe()`, `pinShortcut(id)`,
     `state()` JSON `{ours:{hosts,allowed}, youtube:{allowed,installed}, probed:bool}`.
     All gated to the launcher origin like the existing method.
   - `linkFromIntent`: a url carrying `ts_probe=1` sets the
     `links.probed` SharedPreference before it is routed.
2. Rust: confirm the youtu.be rewrite keeps `ts_probe` (test).
3. Frontend
   - `index.html`: new `#view-links`; home links card; onboarding gains
     step counter + Back; settings restructured.
   - `main.ts`: links module (state read, row ticks, actions, probe
     result on arrival), view routing for `links`, onboarding commit
     before the link step, home card render.
   - `styles.css`: token pass, tiles, cards, rows, toggles, onboarding,
     links view, settings on phone.
4. Verify on his phone per the spec; screenshots into scratch.
5. Release 1108 by the recipe; CLAUDE.md session state; autonomy log.
