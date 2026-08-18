//! tamescroll — a narrow shell that opens only the feeds, cleaned.
//!
//! The blocking engine is Brave's `adblock` crate. We do not implement
//! filtering ourselves; we hand it EasyList-syntax rules and ask it what
//! to hide for a given URL. See NOTICE.

use std::collections::HashMap;
use std::sync::OnceLock;

use adblock::cosmetic_filter_cache::ProceduralOrActionFilter;
use adblock::Engine;
use serde::Serialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

mod rules;

/// Rules are compiled in for now. Phase 6 replaces this with a cached
/// fetch of the hosted list so fixes ship without an app update — the
/// engine stays put, only the data moves. Building it from the full
/// vendored list set (EasyList, EasyPrivacy, uBO filters, scriptlet
/// resources) takes on the order of a second, so `run()` warms it on a
/// background thread instead of paying that cost on the first tile click.
static ENGINE: OnceLock<Engine> = OnceLock::new();

fn engine() -> &'static Engine {
    ENGINE.get_or_init(rules::build_engine)
}

#[derive(Serialize, Clone)]
pub struct Platform {
    id: &'static str,
    name: &'static str,
    url: &'static str,
    /// Brand colour, used by the launcher tile.
    tint: &'static str,
    /// Whether this platform is coherent once cleaned. See docs/plan.md —
    /// TikTok is deliberately absent because removing the For You feed
    /// leaves nothing to open.
    ready: bool,
}

const PLATFORMS: &[Platform] = &[
    Platform {
        id: "youtube",
        name: "YouTube",
        url: "https://www.youtube.com/",
        tint: "#FF0033",
        ready: true,
    },
    Platform {
        id: "reddit",
        name: "Reddit",
        url: "https://www.reddit.com/",
        tint: "#FF4500",
        ready: true,
    },
    Platform {
        id: "x",
        name: "X",
        // /home lands on the timeline; our rules remove the For-you tab
        // there, leaving Following as the only one.
        url: "https://x.com/home",
        tint: "#71767B",
        ready: true,
    },
    Platform {
        id: "instagram",
        name: "Instagram",
        url: "https://www.instagram.com/",
        tint: "#E1306C",
        ready: false,
    },
];

#[tauri::command]
fn platforms() -> Vec<Platform> {
    PLATFORMS.to_vec()
}

/// Build the CSS the engine says applies to this URL.
fn cosmetic_css(url: &str) -> String {
    let res = engine().url_cosmetic_resources(url);

    let mut css = String::new();

    if !res.hide_selectors.is_empty() {
        let mut selectors: Vec<&String> = res.hide_selectors.iter().collect();
        // Deterministic output keeps the injected script stable between
        // runs, which makes debugging a broken rule far easier.
        selectors.sort();
        // ONE RULE PER SELECTOR — never join them. In a comma-separated
        // selector list, a single invalid selector invalidates the whole
        // rule, and with thousands of upstream EasyList selectors in play
        // one bad apple silently turned off ALL hiding (Shorts came back;
        // caught by screenshot 2026-08-18). Per-selector rules contain
        // the damage to the one selector that is broken.
        for selector in selectors {
            css.push_str(selector);
            css.push_str(" { display: none !important; }\n");
        }
    }

    // `:style()` rules and other actioned filters arrive JSON-encoded.
    // Those expressible as plain CSS become rules here; the rest need a
    // JS-side evaluator we do not have yet, so they are skipped rather
    // than half-applied. Skipping a blur is survivable; a broken
    // selector that hides the player is not.
    let mut styled: Vec<(String, String)> = res
        .procedural_actions
        .iter()
        .filter_map(|encoded| serde_json::from_str::<ProceduralOrActionFilter>(encoded).ok())
        .filter_map(|filter| filter.as_css())
        .collect();
    styled.sort();
    for (selector, declarations) in styled {
        css.push_str(&format!("{selector} {{ {declarations} }}\n"));
    }

    css
}

#[tauri::command]
fn rules_summary() -> HashMap<String, usize> {
    let mut out = HashMap::new();
    for p in PLATFORMS {
        let count = engine().url_cosmetic_resources(p.url).hide_selectors.len();
        out.insert(p.id.to_string(), count);
    }
    out
}

/// The script injected into every platform webview.
///
/// `scriptlets` is the engine's `injected_script` for this URL — the
/// scriptlets that strip ad data out of the page before its own scripts
/// read it (YouTube's player response, mainly; see VISION.md). It runs
/// first, and is wrapped in its own `try`/`catch` on top of the one each
/// individual scriptlet already gets from adblock-rust: a vendored
/// scriptlet that fails to parse must not be able to take the CSS
/// injection down with it.
///
/// The CSS block re-applies on SPA navigation because these sites rewrite
/// their own DOM without a page load, and Tauri's initialisation script is
/// not guaranteed to run before the site's own JavaScript on remote URLs.
/// Re-applying is cheap; missing a navigation is not.
fn injection_script(css: &str, scriptlets: &str) -> String {
    let escaped = css.replace('\\', "\\\\").replace('`', "\\`");
    format!(
        r#"
(function () {{
  try {{
{scriptlets}
  }} catch (e) {{}}
}})();

(function () {{
  var CSS = `{escaped}`;
  var STYLE_ID = "tamescroll-rules";

  function apply() {{
    if (document.getElementById(STYLE_ID)) return;
    var head = document.head || document.documentElement;
    if (!head) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    head.appendChild(el);
  }}

  apply();
  document.addEventListener("DOMContentLoaded", apply);

  // These sites navigate without a page load. Re-assert after each one.
  ["pushState", "replaceState"].forEach(function (name) {{
    var original = history[name];
    history[name] = function () {{
      var result = original.apply(this, arguments);
      setTimeout(apply, 0);
      return result;
    }};
  }});
  window.addEventListener("popstate", function () {{ setTimeout(apply, 0); }});

  // Last resort: if the site tears our style out, put it back.
  new MutationObserver(function () {{ apply(); }})
    .observe(document.documentElement, {{ childList: true, subtree: false }});
}})();
"#
    )
}

#[tauri::command]
async fn open_platform(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let platform = PLATFORMS
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("unknown platform: {id}"))?;

    if let Some(existing) = app.get_webview_window(platform.id) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = platform
        .url
        .parse()
        .map_err(|_| format!("bad platform url: {}", platform.url))?;

    let resources = engine().url_cosmetic_resources(platform.url);
    let script = injection_script(&cosmetic_css(platform.url), &resources.injected_script);

    WebviewWindowBuilder::new(&app, platform.id, WebviewUrl::External(url))
        .title(platform.name)
        .inner_size(1200.0, 860.0)
        .initialization_script(&script)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Warm the engine off the critical path: building it from the full
    // vendored list set takes on the order of a second, and nothing about
    // startup needs it until the first `open_platform` call.
    std::thread::spawn(|| {
        #[cfg(debug_assertions)]
        let started = std::time::Instant::now();
        engine();
        #[cfg(debug_assertions)]
        eprintln!("adblock engine warmed in {:?}", started.elapsed());
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            platforms,
            open_platform,
            rules_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tamescroll");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Proves the two halves of in-app ad blocking VISION.md describes are
    /// actually wired: cosmetic hiding (already worked) and scriptlet
    /// injection (the point of this change). A regression here means
    /// either the vendored lists didn't load or the scriptlet resources
    /// didn't — see rules.rs and rules/vendor/README.md.
    #[test]
    fn youtube_gets_hide_selectors_and_a_scriptlet_injection() {
        let resources =
            engine().url_cosmetic_resources("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
        assert!(
            !resources.injected_script.is_empty(),
            "expected a non-empty scriptlet injection for a YouTube watch page — \
             this is what strips ad data out of the player response"
        );
        // Our clean-room scriptlets, resolved by name from the filter
        // lists: the initial-load pin and the SPA-navigation strippers.
        for needle in [
            "setConstant(",
            "trustedReplaceFetchResponse(",
            "trustedReplaceXhrResponse(",
        ] {
            assert!(
                resources.injected_script.contains(needle),
                "expected {needle:?} in the YouTube injection — a scriptlet \
                 name stopped resolving (see rules.rs SCRIPTLETS)"
            );
        }

        let resources = engine().url_cosmetic_resources("https://www.youtube.com/");
        assert!(
            !resources.hide_selectors.is_empty(),
            "expected cosmetic hide selectors for the YouTube home page"
        );
    }

    /// Our own platform rules must survive the trip through the engine —
    /// a selector that fails to parse is silently dropped, and this is
    /// where that would surface.
    #[test]
    fn reddit_and_x_rules_survive_parsing() {
        let reddit = engine().url_cosmetic_resources("https://www.reddit.com/");
        assert!(
            reddit.hide_selectors.iter().any(|s| s.contains("shreddit-ad-post")),
            "reddit.txt's ad rules should be present for reddit.com"
        );

        let x = engine().url_cosmetic_resources("https://x.com/home");
        assert!(
            !x.hide_selectors.is_empty() || !x.procedural_actions.is_empty(),
            "x.txt rules should produce hide selectors or procedural actions for x.com"
        );
    }
}
