//! tamescroll — a narrow shell that opens only the feeds, cleaned.
//!
//! The blocking engine is Brave's `adblock` crate. We do not implement
//! filtering ourselves; we hand it EasyList-syntax rules and ask it what
//! to hide for a given URL. See NOTICE.

use std::collections::HashMap;
use std::sync::OnceLock;

use adblock::cosmetic_filter_cache::ProceduralOrActionFilter;
use adblock::lists::{FilterSet, ParseOptions};
use adblock::Engine;
use serde::Serialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Rules are compiled in for now. Phase 6 replaces this with a cached
/// fetch of the hosted list so fixes ship without an app update — the
/// engine stays put, only the data moves.
const YOUTUBE_RULES: &str = include_str!("../../../rules/youtube.txt");

static ENGINE: OnceLock<Engine> = OnceLock::new();

fn engine() -> &'static Engine {
    ENGINE.get_or_init(|| {
        let mut set = FilterSet::new(false);
        set.add_filter_list(YOUTUBE_RULES.to_string(), ParseOptions::default());
        Engine::new_with_filter_set(set)
    })
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
        ready: false,
    },
    Platform {
        id: "x",
        name: "X",
        url: "https://x.com/",
        tint: "#71767B",
        ready: false,
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
        let joined: Vec<&str> = selectors.iter().map(|s| s.as_str()).collect();
        css.push_str(&format!(
            "{} {{ display: none !important; }}\n",
            joined.join(",\n")
        ));
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
/// It re-applies on SPA navigation because these sites rewrite their own
/// DOM without a page load, and Tauri's initialisation script is not
/// guaranteed to run before the site's own JavaScript on remote URLs.
/// Re-applying is cheap; missing a navigation is not.
fn injection_script(css: &str) -> String {
    let escaped = css.replace('\\', "\\\\").replace('`', "\\`");
    format!(
        r#"
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

    let script = injection_script(&cosmetic_css(platform.url));

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
