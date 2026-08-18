package app.tamescroll.client

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private lateinit var webView: WebView

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView

    // tamescroll: on Android everything runs in this one WebView, so the
    // system Back key must always land on our launcher before it is
    // allowed to background the app — otherwise an exhausted back-stack
    // falls through to whatever task sits underneath in recents
    // (observed on the emulator 2026-08-18). Registered after wry's own
    // callback, so this one wins the dispatch.
    val callback = object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        // Launcher first: it is the app's home screen, so Back there
        // always backgrounds the app — even though history may still
        // hold platform entries (loadUrl below pushes one), walking
        // back into a feed from home would turn Back into a toggle
        // (observed on the emulator 2026-08-18, press-2 anomaly).
        val onLauncher = webView.url?.contains("tauri.localhost") == true
        when {
          // moveTaskToBack, never finish(): finishing destroys the
          // Activity while the Rust process lives on, and Tauri cannot
          // attach a fresh Activity to an already-initialized process —
          // the relaunch renders permanently blank (emulator evidence
          // 2026-08-18, new Task with zero webview activity).
          onLauncher -> moveTaskToBack(true)
          // Never history-restore INTO the launcher: goBack() onto the
          // custom-protocol page revives a back/forward-cache zombie
          // document that stays visible but detached — taps land in it
          // and its invokes never reach Rust (CDP evidence 2026-08-18,
          // spikes/logcat-probe6.log: two tauri.localhost targets, the
          // visible one attached:false). A fresh loadUrl creates one
          // live document instead.
          webView.canGoBack() && !backEntryIsLauncher() -> webView.goBack()
          else -> webView.loadUrl("http://tauri.localhost/")
        }
      }
    }
    onBackPressedDispatcher.addCallback(this, callback)

    super.onWebViewCreate(webView)
  }

  private fun backEntryIsLauncher(): Boolean {
    val list = webView.copyBackForwardList()
    if (list.currentIndex <= 0) return false
    val prev = list.getItemAtIndex(list.currentIndex - 1).url ?: return false
    return prev.contains("tauri.localhost")
  }
}
