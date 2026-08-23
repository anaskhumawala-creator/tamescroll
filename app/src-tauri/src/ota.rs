//! Hosted rules updates (docs/rules-updates.md, Phase 6). Rules are
//! DATA and travel over the air; scriptlets are CODE and ship in the
//! binary only — that split is store policy, not ours to relax.
//!
//! Flow: `rules/manifest.json` in the public repo lists every OTA-able
//! file with its SHA-256. On launch (+ every 24h + manual refresh) we
//! fetch the manifest, download files whose hash differs from what the
//! app is currently using, verify each download against the manifest
//! hash, sanity-check it, cache it under the app data dir, and swap the
//! engine + surfaces in place. A failed fetch is invisible: the app
//! keeps the cache, or the embedded snapshot (NO NAGS rule).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock, RwLock};

use sha2::{Digest, Sha256};

use crate::rules;

/// Where updates come from. The repo IS the source of truth; raw URLs
/// are free, cached by Fastly, and need no server of ours. Overridable
/// for tests and for the eventual rules.tamescroll.com move.
const DEFAULT_BASE_URL: &str =
    "https://raw.githubusercontent.com/anaskhumawala-creator/tamescroll/main/rules/";

pub fn base_url() -> String {
    std::env::var("TAMESCROLL_RULES_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string())
}

/// Runtime overrides: file name (manifest-relative, e.g. "youtube.txt",
/// "blur/youtube.css", "vendor/easylist.txt") -> replacement text.
/// Everything that reads a rules file goes through `rules_text`, so an
/// entry here wins everywhere at the next engine/surfaces rebuild.
static OVERRIDES: RwLock<Option<HashMap<String, String>>> = RwLock::new(None);

pub fn rules_text(name: &str) -> String {
    if let Some(map) = OVERRIDES.read().unwrap().as_ref() {
        if let Some(text) = map.get(name) {
            return text.clone();
        }
    }
    rules::embedded(name).unwrap_or("").to_string()
}

fn set_overrides(new: HashMap<String, String>) {
    *OVERRIDES.write().unwrap() = Some(new);
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    let out = h.finalize();
    let mut s = String::with_capacity(64);
    for b in out {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// The manifest is a flat name->sha256 map. Anything else in the JSON
/// is ignored so the format can grow without breaking old clients.
pub fn parse_manifest(json: &str) -> Result<HashMap<String, String>, String> {
    let v: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let files = v
        .get("files")
        .and_then(|f| f.as_object())
        .ok_or("manifest missing files object")?;
    let mut out = HashMap::new();
    for (name, entry) in files {
        let hash = entry
            .get("sha256")
            .and_then(|h| h.as_str())
            .ok_or_else(|| format!("manifest entry {name} missing sha256"))?;
        out.insert(name.clone(), hash.to_lowercase());
    }
    Ok(out)
}

/// A downloaded payload is accepted only if it hashes to what the
/// manifest promised AND looks like rules, not an error page. Loose on
/// purpose: the engine and the CSS pipeline are the real parsers; this
/// only has to reject obvious garbage (GitHub HTML error bodies, empty
/// truncations) so a bad fetch can never blank the blocking.
pub fn validate_payload(text: &str, expected_sha256: &str) -> Result<(), String> {
    // LF-normalized like the manifest generator and plan_updates: if a
    // future commit lands CRLF in the git index (contributor without
    // autocrlf, community PR), raw bytes would never hash to the LF
    // manifest and that file's updates would be dead forever
    // (review 2026-08-23 #6).
    if sha256_hex(text.replace("\r\n", "\n").as_bytes()) != expected_sha256.to_lowercase() {
        return Err("hash mismatch".into());
    }
    let head = text.trim_start();
    if head.is_empty() {
        return Err("empty payload".into());
    }
    if head.starts_with('<') {
        return Err("looks like HTML, not rules".into());
    }
    Ok(())
}

/// Which manifest entries need downloading, judged against what the app
/// is CURRENTLY using (override or embedded). Pure so it's testable.
pub fn plan_updates(manifest: &HashMap<String, String>) -> Vec<String> {
    let mut out: Vec<String> = manifest
        .iter()
        .filter(|(name, hash)| {
            // Manifest hashes are over git-blob bytes (LF). include_str!
            // embeds working-tree bytes, which core.autocrlf may have
            // turned CRLF on Windows — normalize before comparing or a
            // byte-identical file would re-download forever.
            let current = rules_text(name).replace("\r\n", "\n");
            rules::embedded(name).is_some() && sha256_hex(current.as_bytes()) != **hash
        })
        .map(|(name, _)| name.clone())
        .collect();
    out.sort();
    out
}

static CACHE_DIR: OnceLock<PathBuf> = OnceLock::new();
/// Serialises refreshes: the manual command and the 24h loop must not
/// interleave downloads and rebuilds.
static REFRESH_LOCK: Mutex<()> = Mutex::new(());

fn cache_file_path(dir: &Path, name: &str) -> PathBuf {
    // Manifest names contain forward slashes ("blur/youtube.css");
    // flatten them so the cache stays a single directory (no traversal
    // surface, nothing to mkdir per platform).
    dir.join(name.replace('/', "__"))
}

/// Loads the cached rule set from a previous refresh, verifying every
/// file against the cached manifest before trusting it. Corrupt or
/// missing entries silently fall back to the embedded snapshot.
pub fn load_cache(dir: &Path) {
    // A cache written by an OLDER app build can be staler than this
    // build's embedded snapshot — after an app update the embedded rules
    // are the newest thing on the device until a refresh succeeds
    // (review 2026-08-23 #11). Version-stamped: mismatch = ignore cache.
    let version_ok = std::fs::read_to_string(dir.join("app-version"))
        .map(|v| v.trim() == env!("CARGO_PKG_VERSION"))
        .unwrap_or(false);
    if !version_ok {
        return;
    }
    let manifest_path = dir.join("manifest.json");
    let Ok(json) = std::fs::read_to_string(&manifest_path) else {
        return;
    };
    let Ok(manifest) = parse_manifest(&json) else {
        return;
    };
    let mut overrides = HashMap::new();
    for (name, hash) in &manifest {
        if rules::embedded(name).is_none() {
            continue; // unknown file: a future app may use it, this one can't
        }
        let Ok(text) = std::fs::read_to_string(cache_file_path(dir, name)) else {
            continue;
        };
        if validate_payload(&text, hash).is_ok() {
            overrides.insert(name.clone(), text);
        }
    }
    if !overrides.is_empty() {
        set_overrides(overrides);
    }
}

pub(crate) fn http_get(url: &str) -> Result<String, String> {
    ureq::get(url)
        .timeout(std::time::Duration::from_secs(30))
        .call()
        .map_err(|e| e.to_string())?
        .into_string()
        .map_err(|e| e.to_string())
}

/// One full refresh: manifest -> plan -> download+verify -> cache ->
/// swap overrides -> rebuild engine and surfaces. Returns a short
/// human-readable summary for the settings pane; errors are returned,
/// never surfaced as UI nags by this layer.
pub fn refresh() -> Result<String, String> {
    let _guard = REFRESH_LOCK.lock().unwrap();
    let base = base_url();
    let manifest_json = http_get(&format!("{base}manifest.json"))?;
    let manifest = parse_manifest(&manifest_json)?;
    let todo = plan_updates(&manifest);
    if todo.is_empty() {
        return Ok("rules up to date".into());
    }

    // Per-file isolation (review 2026-08-23 #6): one unfetchable or
    // corrupt file must not block every other file's update — skip it,
    // apply the rest, and let the next refresh retry it.
    let mut fetched: HashMap<String, String> = HashMap::new();
    let mut skipped = 0usize;
    for name in &todo {
        let ok = http_get(&format!("{base}{name}"))
            .and_then(|text| validate_payload(&text, &manifest[name]).map(|()| text));
        match ok {
            Ok(text) => {
                fetched.insert(name.clone(), text);
            }
            Err(_e) => {
                skipped += 1;
                #[cfg(debug_assertions)]
                eprintln!("rules ota: skipping {name}: {_e}");
            }
        }
    }
    if fetched.is_empty() {
        return Err(format!("all {skipped} changed file(s) failed to fetch/verify"));
    }

    // All-or-nothing from here: only after every download verified do we
    // touch disk or live state, so a mid-run network failure changes
    // nothing.
    if let Some(dir) = CACHE_DIR.get() {
        let _ = std::fs::create_dir_all(dir);
        for (name, text) in &fetched {
            let _ = std::fs::write(cache_file_path(dir, name), text);
        }
        let _ = std::fs::write(dir.join("manifest.json"), &manifest_json);
        let _ = std::fs::write(dir.join("app-version"), env!("CARGO_PKG_VERSION"));
    }

    let applied = fetched.len();
    let mut merged = OVERRIDES.read().unwrap().clone().unwrap_or_default();
    for (name, text) in fetched {
        merged.insert(name, text);
    }
    set_overrides(merged);
    crate::rebuild_rules();

    Ok(if skipped == 0 {
        format!("updated {applied} rule file(s)")
    } else {
        format!("updated {applied} rule file(s), {skipped} retrying later")
    })
}

/// Call once at app setup: remembers the cache dir, restores the last
/// good cache, then keeps rules fresh in the background — on launch and
/// every 24h, silently (docs/rules-updates.md: no nag surface; a failed
/// fetch is invisible).
pub fn init(cache_dir: PathBuf) {
    let _ = CACHE_DIR.set(cache_dir.clone());
    load_cache(&cache_dir);
    if OVERRIDES.read().unwrap().is_some() {
        crate::rebuild_rules();
    }
    std::thread::spawn(|| loop {
        // A failed refresh retries in 15 minutes, not 24 hours — the
        // launch-time attempt very often races the network coming up
        // (review 2026-08-23 #10).
        let sleep_secs = match refresh() {
            Ok(_msg) => {
                #[cfg(debug_assertions)]
                eprintln!("rules ota: {_msg}");
                24 * 60 * 60
            }
            Err(_e) => {
                #[cfg(debug_assertions)]
                eprintln!("rules ota: fetch failed (keeping current rules): {_e}");
                15 * 60
            }
        };
        std::thread::sleep(std::time::Duration::from_secs(sleep_secs));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The two tests below both mutate the process-global OVERRIDES (and
    /// one rebuilds the engine); serialised so cargo's parallel runner
    /// can't interleave them.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    /// Minimal one-thread HTTP server for the end-to-end test: serves the
    /// given path->body map until the listener is dropped.
    fn serve(responses: HashMap<String, String>) -> String {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}/", listener.local_addr().unwrap());
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader, Write};
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { break };
                let mut line = String::new();
                if BufReader::new(&stream).read_line(&mut line).is_err() {
                    continue;
                }
                let path = line.split_whitespace().nth(1).unwrap_or("/");
                let reply = match responses.get(path.trim_start_matches('/')) {
                    Some(body) => format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    ),
                    None => "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                        .to_string(),
                };
                let _ = stream.write_all(reply.as_bytes());
            }
        });
        base
    }

    /// The whole OTA path, end to end: a hosted youtube.txt that grew a
    /// new rule must — after one refresh() — show up in the CSS a page
    /// load receives, with no rebuild and no reinstall. This is the test
    /// that proves the feature the owner asked for.
    #[test]
    fn refresh_applies_a_hosted_rule_change_to_injected_css() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());

        let updated = format!(
            "{}\nwww.youtube.com##.ts-ota-test-rule\n",
            rules::embedded("youtube.txt").unwrap()
        );
        let manifest = format!(
            r#"{{"version":1,"files":{{"youtube.txt":{{"sha256":"{}"}}}}}}"#,
            sha256_hex(updated.replace("\r\n", "\n").as_bytes())
        );
        let mut responses = HashMap::new();
        responses.insert("manifest.json".to_string(), manifest);
        responses.insert("youtube.txt".to_string(), updated.replace("\r\n", "\n"));
        let base = serve(responses);
        std::env::set_var("TAMESCROLL_RULES_URL", &base);

        let result = refresh();
        std::env::remove_var("TAMESCROLL_RULES_URL");
        assert_eq!(result.as_deref(), Ok("updated 1 rule file(s)"));

        let css = crate::page_css("https://www.youtube.com/", "youtube", false, &[]);
        assert!(
            css.contains(".ts-ota-test-rule"),
            "OTA-delivered rule must reach the injected CSS without a rebuild"
        );

        // Restore the embedded snapshot for every other test.
        set_overrides(HashMap::new());
        crate::rebuild_rules();
        let css = crate::page_css("https://www.youtube.com/", "youtube", false, &[]);
        assert!(!css.contains(".ts-ota-test-rule"), "reset must drop the override");
    }

    #[test]
    fn manifest_parses_and_rejects_garbage() {
        let m = parse_manifest(r#"{"version":3,"files":{"youtube.txt":{"sha256":"AB12"}}}"#)
            .expect("valid manifest");
        assert_eq!(m["youtube.txt"], "ab12");
        assert!(parse_manifest("{}").is_err());
        assert!(parse_manifest("<html>").is_err());
    }

    #[test]
    fn payload_validation_requires_matching_hash_and_non_html() {
        let text = "! test: something\nytd-thing { display: none }";
        let good = sha256_hex(text.as_bytes());
        assert!(validate_payload(text, &good).is_ok());
        assert!(validate_payload(text, &good.to_uppercase()).is_ok());
        assert!(validate_payload("tampered", &good).is_err());
        // CRLF payload must verify against the LF manifest hash — a
        // CRLF blob in the repo must degrade to nothing worse than a
        // working download (review 2026-08-23 #6).
        assert!(validate_payload(&text.replace('\n', "\r\n"), &good).is_ok());
        let html = "<html><body>404</body></html>";
        let html_hash = sha256_hex(html.as_bytes());
        assert!(validate_payload(html, &html_hash).is_err(), "error pages must be rejected");
        let empty_hash = sha256_hex(b"  \n ");
        assert!(validate_payload("  \n ", &empty_hash).is_err());
    }

    #[test]
    fn plan_updates_only_lists_known_changed_files() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let mut manifest = HashMap::new();
        // Matches what the app currently uses -> no download.
        manifest.insert(
            "youtube.txt".to_string(),
            sha256_hex(rules_text("youtube.txt").as_bytes()),
        );
        // Differs -> download.
        manifest.insert("reddit.txt".to_string(), "0".repeat(64));
        // Unknown to this build -> ignored entirely.
        manifest.insert("newplatform.txt".to_string(), "1".repeat(64));
        assert_eq!(plan_updates(&manifest), vec!["reddit.txt".to_string()]);
    }

    #[test]
    fn overrides_win_over_embedded_and_reset_cleanly() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let embedded = rules_text("youtube.txt");
        assert!(embedded.contains("!surface:"), "embedded youtube rules expected");
        // Additive override on purpose: OVERRIDES is process-global and
        // other tests read rules concurrently — a functionally-equivalent
        // override keeps them green even mid-window.
        let with_marker = format!("{embedded}! ts-test-override\n");
        let mut map = HashMap::new();
        map.insert("youtube.txt".to_string(), with_marker.clone());
        set_overrides(map);
        assert_eq!(rules_text("youtube.txt"), with_marker);
        assert_eq!(rules_text("reddit.txt"), rules::embedded("reddit.txt").unwrap());
        set_overrides(HashMap::new());
        assert_eq!(rules_text("youtube.txt"), embedded);
    }
}
