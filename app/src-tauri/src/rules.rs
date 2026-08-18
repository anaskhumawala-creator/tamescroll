//! Builds the adblock-rust engine from the vendored filter lists and
//! scriptlet resources. Split out of lib.rs because the list of vendored
//! files is long and only grows; lib.rs stays focused on the app shell.
//!
//! Everything here is compiled into the binary (`include_str!`), the same
//! convention `rules/youtube.txt` already used, so a shipped build never
//! reads these files off disk. Refresh the snapshots with
//! `node scripts/update-lists.mjs`; see rules/vendor/README.md.
//!
//! Scriptlets are OUR OWN clean-room implementations (MPL-2.0) in
//! `app/src-tauri/scriptlets/` — uBlock Origin's scriptlet file is GPLv3
//! and compiling GPL code into this MPL binary would both violate the
//! repo's licence rule (see NOTICE) and poison App Store distribution.
//! The filter LISTS below reference scriptlets by name; our resources
//! answer to those names.

use adblock::lists::{FilterSet, ParseOptions};
use adblock::resources::{MimeType, PermissionMask, Resource, ResourceType};
use adblock::Engine;

/// Our own cosmetic rules — algorithmic-surface removal, not ad blocking.
/// Each file's header carries the design rules that govern it.
const YOUTUBE_RULES: &str = include_str!("../../../rules/youtube.txt");
const REDDIT_RULES: &str = include_str!("../../../rules/reddit.txt");
const X_RULES: &str = include_str!("../../../rules/x.txt");

/// Upstream filter lists. These block ads and trackers by network pattern
/// and cosmetic selector; the scriptlet resources below are what actually
/// let the `##+js(...)` rules inside them do anything.
const EASYLIST: &str = include_str!("../../../rules/vendor/easylist.txt");
const EASYPRIVACY: &str = include_str!("../../../rules/vendor/easyprivacy.txt");
const UBO_FILTERS: &str = include_str!("../../../rules/vendor/ubo-filters.txt");
const UBO_QUICK_FIXES: &str = include_str!("../../../rules/vendor/ubo-quick-fixes.txt");
const UBO_UNBREAK: &str = include_str!("../../../rules/vendor/ubo-unbreak.txt");

/// Brave's own scriptlet/redirect resources (MPL-2.0), already in the
/// exact JSON shape `adblock::resources::Resource` deserializes from.
/// Carries Brave's additions (de-amp, playback fixes, etc.) — not the
/// generic uBO scriptlet names; ours below cover those.
const BRAVE_RESOURCES_JSON: &str = include_str!("../../../rules/vendor/resources.json");

/// Our clean-room scriptlets. Function-style: the body starts with
/// `function name(` so adblock-rust injects the body once as a dependency
/// and emits `name(arg1, arg2, ...)` calls per matching filter rule, with
/// arguments properly quoted by the engine.
///
/// (name, aliases, body). Names and aliases carry the `.js` suffix
/// because the engine's lookup appends it to the name a filter uses —
/// `##+js(set, ...)` looks up `set.js`.
///
/// Coverage is deliberately the set the YouTube ad rules in
/// ubo-filters.txt actually call. Known-unimplemented names those lists
/// also reference (`trusted-json-edit-xhr-request`,
/// `trusted-prevent-dom-bypass`, `rpnt`, `rmnt`, `nano-stb`): their rules
/// are skipped silently by the engine — they are anti-detection
/// countermeasures, not the core ad strip. Add implementations here if
/// they ever become load-bearing.
const SCRIPTLETS: &[(&str, &[&str], &str)] = &[
    (
        "set-constant.js",
        &["set.js"],
        include_str!("../scriptlets/set-constant.js"),
    ),
    (
        "json-prune.js",
        &[],
        include_str!("../scriptlets/json-prune.js"),
    ),
    (
        "json-prune-fetch-response.js",
        &[],
        include_str!("../scriptlets/json-prune-fetch-response.js"),
    ),
    (
        "trusted-replace-fetch-response.js",
        &[],
        include_str!("../scriptlets/trusted-replace-fetch-response.js"),
    ),
    (
        "trusted-replace-xhr-response.js",
        &[],
        include_str!("../scriptlets/trusted-replace-xhr-response.js"),
    ),
];

/// Builds the engine the whole app shares: every vendored filter list
/// compiled in, plus the scriptlet resources those lists' `+js(...)`
/// filters need to actually produce injectable JavaScript.
pub fn build_engine() -> Engine {
    let mut set = FilterSet::new(false);
    for list in [
        YOUTUBE_RULES,
        REDDIT_RULES,
        X_RULES,
        EASYLIST,
        EASYPRIVACY,
        UBO_FILTERS,
        UBO_QUICK_FIXES,
        UBO_UNBREAK,
    ] {
        set.add_filter_list(list.to_string(), ParseOptions::default());
    }

    let mut engine = Engine::new_with_filter_set(set);
    engine.use_resources(resources());
    engine
}

/// All scriptlet/redirect resources available to `+js(...)` filters:
/// Brave's own set, plus our clean-room implementations of the generic
/// names the lists call.
fn resources() -> Vec<Resource> {
    let mut resources: Vec<Resource> = serde_json::from_str(BRAVE_RESOURCES_JSON)
        .expect("rules/vendor/resources.json must deserialize into Vec<adblock::resources::Resource>");

    for (name, aliases, body) in SCRIPTLETS {
        resources.push(Resource {
            name: (*name).to_string(),
            aliases: aliases.iter().map(|a| (*a).to_string()).collect(),
            kind: ResourceType::Mime(MimeType::ApplicationJavascript),
            content: base64_encode(body.as_bytes()),
            dependencies: Vec::new(),
            // Default mask = usable from any list we compile in. The
            // `trusted-` names are safe here because every list is a
            // curated snapshot in this repo, not user-supplied input.
            permission: PermissionMask::default(),
        });
    }

    resources
}

/// Standard base64 (RFC 4648, with padding) — `Resource::content` must be
/// base64-encoded (adblock-rust decodes it with `BASE64_STANDARD`), and
/// pulling in a whole crate for this one call site isn't worth it.
fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        out.push(ALPHABET[((n >> 18) & 0x3F) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[((n >> 6) & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[(n & 0x3F) as usize] as char
        } else {
            '='
        });
    }
    out
}
