# rules/vendor/

Unmodified upstream snapshots. Not tamescroll's work — their own licences
apply, and they are **not** covered by `rules/LICENSE` (CC0-1.0), which
only covers the files tamescroll itself writes directly in `rules/`.

Refresh with:

```
node scripts/update-lists.mjs
```

## What's here, and its licence

| File | Source | Licence |
|---|---|---|
| `easylist.txt` | [easylist.to/easylist/easylist.txt](https://easylist.to/easylist/easylist.txt) | GPLv3 / CC BY-SA 3.0 (dual, upstream's choice) |
| `easyprivacy.txt` | [easylist.to/easylist/easyprivacy.txt](https://easylist.to/easylist/easyprivacy.txt) | GPLv3 / CC BY-SA 3.0 (dual) |
| `ubo-filters.txt` | [uBlockOrigin/uAssets filters/filters.txt](https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt) | GPLv3 |
| `ubo-quick-fixes.txt` | [uBlockOrigin/uAssets filters/quick-fixes.txt](https://github.com/uBlockOrigin/uAssets/blob/master/filters/quick-fixes.txt) | GPLv3 |
| `ubo-unbreak.txt` | [uBlockOrigin/uAssets filters/unbreak.txt](https://github.com/uBlockOrigin/uAssets/blob/master/filters/unbreak.txt) | GPLv3 |
| `resources.json` | [brave/adblock-resources dist/resources.json](https://github.com/brave/adblock-resources/blob/master/dist/resources.json) | MPL-2.0 |

These are filter *data*, consumed at build time by the embedded
`adblock-rust` engine (see `../../app/src-tauri/src/rules.rs`). None of it
is redistributed as source in a way that would pull tamescroll itself
(MPL-2.0) under GPL — the engine reads these as plain-text rule data, the
same relationship any adblock-rust-based tool has with EasyList.

## Why there is no scriptlet file here

The `##+js(...)` rules in these lists call scriptlets by NAME. uBlock
Origin's implementations of those scriptlets are GPLv3 **code**, and
compiling GPL code into tamescroll's MPL-2.0 binary is forbidden (see
NOTICE — same reason HaramBlur's AGPL code is off-limits, and GPL
conflicts with App Store terms). tamescroll therefore ships its own
clean-room MPL-2.0 implementations of the needed scriptlet names in
`app/src-tauri/scriptlets/`, registered under the names the lists call.

The lists themselves are treated as filter *data* consumed by the engine
— the same relationship Brave, AdGuard and every adblock-rust-based tool
has with EasyList. If this ever needs to be stricter, the fallback is
loading lists at runtime from the app's data directory (planned anyway
for remote rule updates in Phase 6).
