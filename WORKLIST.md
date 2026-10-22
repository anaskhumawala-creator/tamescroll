# Worklist -- open work moved to GitHub Issues

Open work now lives in GitHub Issues:
https://github.com/anaskhumawala-creator/tamescroll/issues

The August to-do sections of this file are in git history; the
still-open ad items are #11, the deferred ones #15 and #17. The harness
gotchas below stay here because the gauntlet skill points at them.

## Harness gotchas — do not repeat

A LOCAL EDIT TO `rules/` IS INVISIBLE UNTIL IT IS PUSHED. The OTA fetches
`rules/*` from raw GitHub main on launch and installs them as OVERRIDES,
which win over the `include_str!`'d copies compiled into the binary. So a
freshly-rebuilt dev app immediately overwrites your local rule edits with
whatever is on main, and the log line that says so is easy to skim past:

    rules ota: updated 2 rule file(s)

Sequence that actually works: edit rules → `node scripts/gen-rules-manifest.mjs`
→ commit + push → wait for raw.githubusercontent to serve BOTH the file and
the new `manifest.json` (they propagate independently; a refresh in between
fails hash verification, and a refresh before either lands reports the
honest but misleading "rules up to date") → `refresh_rules` → RELAUNCH.

THE RULES CSS IS BAKED AT WINDOW CREATION. Reloading the page or clicking
the platform tile again reuses the existing webview and re-injects the SAME
string — the injected `#tamescroll-rules` length stays pinned (4312 across
four reloads while the cache on disk already held the new rules). Only a
fresh window, i.e. an app relaunch, picks up refreshed rules. Verify by
reading that style element's length, not by trusting the refresh return.

NEVER run the dev app as a TRACKED background task. `npx tauri dev` ran
that way for 13 hours, and a session holding a live tracked task never
reaches idle — which is the only state a scheduled ping can fire in. Not
one tick fired in five attempts at four different intervals, and the
cron expression was never the problem. Launch it DETACHED instead:

    powershell -NoProfile -Command "
      $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
      Start-Process cmd.exe -ArgumentList '/c','npx tauri dev > Z:\Apps\Disconnect\spikes\devapp.log 2>&1'         -WorkingDirectory 'Z:\Apps\Disconnectpp' -WindowStyle Hidden"

Then poll `curl http://127.0.0.1:9223/json` in the FOREGROUND with a
bounded loop. Log lands in spikes/devapp.log.

NEVER launch `until <cond>; do sleep N; done` with run_in_background.
One of those spun for 12h39m waiting on a condition that had already
passed, and a session with a live background task never goes idle — so
the scheduled ping could not fire even once. That, not the cron
expression, is why the loop looked dead. Poll in the FOREGROUND with a
bounded timeout, or just re-check on the next ping.
