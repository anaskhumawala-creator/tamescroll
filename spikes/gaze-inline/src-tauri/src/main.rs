// Throwaway spike. Not part of the main app. See docs/gaze-research.md and
// spikes/gaze-inline/README (findings) for context.
//
// Loads https://www.reddit.com/ (worst-case CSP: default-src 'none') with a
// pre-injected initialization_script that base64-embeds a BlazeFace model
// and runs tfjs inference on the main thread. The script reports success or
// failure by setting document.title (it cannot fetch/postMessage/IPC out of
// a remote origin without granting that origin a Tauri capability, which
// gaze-research.md §3b rules out on security grounds).
//
// document.title does NOT automatically propagate to the native window's
// caption/HWND title in Tauri/WebView2 (confirmed empirically: polling
// WebviewWindow::title() from Rust just returns the last value passed to
// set_title() — it is not a live DOM query, so it never observed the
// script's title changes). The correct hook is WebView2's own
// DocumentTitleChanged COM event, which Tauri exposes directly as
// `on_document_title_changed` — wiring that to `window.set_title()` is what
// makes the native caption (and thus `Get-Process ... MainWindowTitle`)
// actually track document.title.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

const INIT_JS: &str = include_str!("../../dist/init.js");

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("https://www.reddit.com/".parse().unwrap()),
            )
            .title("SPIKE_PENDING")
            .inner_size(1000.0, 800.0)
            .initialization_script(INIT_JS)
            .on_document_title_changed(|window, title| {
                eprintln!("[spike] document title changed: {title}");
                let _ = window.set_title(&title);
            })
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running spike app");
}
