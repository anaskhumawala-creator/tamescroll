package app.tamescroll.client

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private lateinit var webView: WebView

  // Platform requested by a home-screen shortcut before the webview
  // exists (cold start): consumed by ShortcutBridge. @Volatile because
  // @JavascriptInterface methods run on the WebView's JavaBridge
  // thread while onCreate/onNewIntent write from the UI thread — a
  // plain var has no happens-before edge and a cold-start consume()
  // could legally read a stale null on weaker ARM memory models.
  @Volatile
  private var pendingPlatform: String? = null

  // Only ids our shortcuts.xml can send; anything else is dropped so an
  // arbitrary external intent can't steer the launcher.
  private fun platformFromIntent(intent: Intent?): String? {
    val id = intent?.getStringExtra("ts_platform") ?: return null
    return if (id in setOf("youtube", "reddit", "x", "tiktok")) id else null
  }

  // The shortcut lands on the LAUNCHER with ?open=<id>, not directly on
  // the platform URL: the launcher frontend owns mode/prefs sync and
  // calls open_platform itself (main.ts reads the param), so a shortcut
  // launch behaves exactly like a tile tap.
  private fun launcherUrl(platform: String?) =
    if (platform == null) "http://tauri.localhost/"
    else "http://tauri.localhost/?open=$platform"

  override fun onCreate(savedInstanceState: Bundle?) {
    // Edge-to-edge is enforced anyway at targetSdk 35+; dark() forces
    // light status-bar icons so they stay readable on our dark strip.
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
    )
    pendingPlatform = platformFromIntent(intent)
    super.onCreate(savedInstanceState)
    // Owner report 2026-08-20 (Redmi test): page content drew under the
    // phone's status bar — the template's edge-to-edge ships no inset
    // handling. Pad the content view by the system bars and paint the
    // exposed strips launcher-dark so every page sits below the clock.
    window.decorView.setBackgroundColor(0xFF141414.toInt())
    val content = findViewById<ViewGroup>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      WindowInsetsCompat.CONSUMED
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Without this, getIntent() keeps returning the ORIGINAL launching
    // intent forever — an activity recreation (font-scale change,
    // process death restore) would then replay a stale shortcut extra
    // and the app would yank itself to that platform out of nowhere.
    setIntent(intent)
    // Warm shortcut tap (singleTask): the activity already runs, so
    // navigate the live webview straight to the launcher+param.
    platformFromIntent(intent)?.let { id ->
      if (this::webView.isInitialized) {
        webView.loadUrl(launcherUrl(id))
      } else {
        pendingPlatform = id
      }
    }
  }

  // Cold-start shortcut delivery. Loading a URL from onWebViewCreate
  // loses the race — wry loads its configured start URL right after and
  // clobbers the ?open= param (probe12 evidence: cold shortcut sat on
  // the launcher). Instead the launcher page PULLS the pending id via
  // this bridge during start(). consume() is one-shot; the worst a
  // remote page could learn by calling it is an already-consumed "".
  inner class ShortcutBridge {
    @JavascriptInterface
    fun consume(): String {
      val p = pendingPlatform
      pendingPlatform = null
      // The bridge exists for one moment: the launcher's first read on
      // a cold start. Every page in this webview — including remote
      // platform pages and their ad iframes — can see the interface
      // while registered, and `!!window.TsShortcuts` is a free
      // tamescroll fingerprint for the platforms. Warm shortcuts use
      // the ?open= URL param instead, so after the first consume the
      // interface is dead weight: remove it (on the UI thread; this
      // method runs on the JavaBridge thread).
      runOnUiThread {
        if (this@MainActivity::webView.isInitialized) {
          webView.removeJavascriptInterface("TsShortcuts")
        }
      }
      return p ?: ""
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    webView.addJavascriptInterface(ShortcutBridge(), "TsShortcuts")

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
