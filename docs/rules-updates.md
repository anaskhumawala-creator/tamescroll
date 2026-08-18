# Hosted rules updates — design note (Phase 6 prep)

Status: DESIGN ONLY, nothing implemented. Written 2026-08-18 so Phase 6
doesn't start from a blank page. Everything here is changeable; the two
store-policy constraints are not.

## The problem

Rules (`rules/*.txt`, `rules/blur/*.css`) are compiled into the binary
with `include_str!`. Platforms change their DOM every few weeks; an
app-store release cycle per selector fix is days-to-weeks of broken
hiding for every installed user. The fix must travel as **data**, not as
an app update.

## Two constraints that are not ours to relax

1. **Rules are data; scriptlets are code.** Apple (and in practice
   Google) forbid executing remotely fetched code. Filter lists are
   plain data — every content blocker updates them over the air. Our
   scriptlets (`app/src-tauri/scriptlets/*.js`) are JavaScript = code:
   they ship in the binary ONLY and never update remotely. A remote rule
   may reference a bundled scriptlet by name; an unknown name is
   silently dropped (the engine already resolves names against the
   bundled set).
2. **No new nag surface.** Updates are silent and automatic. No "rules
   updated!" toast, no update button, no failure banner. A failed fetch
   is invisible; the app just keeps using what it has.

## Design

- **Source of truth:** the public repo's `rules/` directory, served as
  flat files over HTTPS (GitHub raw or `rules.tamescroll.com` once the
  domain exists). One manifest file (`rules/manifest.json`) lists each
  file with a version counter and SHA-256.
- **Client flow (background thread, never in the critical path):**
  1. On launch + every 24h: GET manifest (ETag; skip if unchanged).
  2. Compare versions; download changed files; verify hash; reject any
     file that fails to parse as EasyList/CSS.
  3. Write to app data dir; swap the engine's FilterSet on the warm-up
     thread (same path as today's 1.6s background compile).
  4. Bundled rules are the permanent fallback: first run, corrupt
     download, downgrade, or fetch failure all land on them.
- **Ordering:** injection at page load uses whatever set is currently
  compiled — never blocks on the network (INSTANT rule).
- **Signing (decide at implementation):** HTTPS + SHA-256-in-manifest is
  the floor. A detached minisign/ed25519 signature over the manifest is
  cheap and removes the CDN as a trust point — worth doing since keys
  can be generated offline. Key handling is owner-gated.
- **Surfaces metadata travels too:** `!surface:` markers are parsed at
  compile time today (`rules.rs`). Remote update must reuse the same
  parser at load time so new toggleable surfaces appear in the settings
  pane without an app update. `always_on` ids ("ads", "mobile_nags",
  "promoted") stay hardcoded in the binary — a compromised rules file
  must not be able to un-hide ads by flipping a flag.

## Out of scope here

The §3 AI watcher (detects broken selectors upstream) feeds the repo,
not the client — separate Phase 6 work. Vendored EasyList snapshots
(`rules/vendor/`) update by re-vendoring in-repo for now; OTA for those
multi-MB lists is a later decision (bandwidth vs staleness).

## Open questions for the owner

- Host on GitHub raw (free, ties updates to the public-repo decision)
  or own domain (independent, costs the domain purchase)?
- Signature key custody (owner machine? sealed backup?).
