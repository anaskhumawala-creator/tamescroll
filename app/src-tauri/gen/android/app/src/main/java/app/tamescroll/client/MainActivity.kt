package app.tamescroll.client

import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

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

  // ---- fullscreen video (owner report 2026-08-22: "full screen doesn't
  // actually full screen"). wry's generated RustWebChromeClient rejects
  // the Fullscreen API outright — its onShowCustomView immediately calls
  // callback.onCustomViewHidden(), so m.youtube falls back to an in-page
  // pseudo-fullscreen with the system bars still up. Real browsers
  // (Brave/Chrome) accept the custom view, float it over everything, and
  // go immersive; this replicates that.

  private var fullscreenView: View? = null
  private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

  // Pinch-to-zoom in fullscreen (owner ask 2026-08-22: the YouTube app
  // zooms the video closer when you spread two fingers). The gesture is
  // observed at dispatch level and never consumed, so the player's own
  // taps/controls keep working; the fullscreen view just scales. Reset
  // on every enter/exit.
  private var fullscreenScale = 1f
  private val scaleDetector by lazy {
    ScaleGestureDetector(
      this,
      object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
          val view = fullscreenView ?: return false
          fullscreenScale = (fullscreenScale * detector.scaleFactor).coerceIn(1f, 3f)
          view.scaleX = fullscreenScale
          view.scaleY = fullscreenScale
          return true
        }
      },
    )
  }

  override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
    if (fullscreenView != null) scaleDetector.onTouchEvent(ev)
    return super.dispatchTouchEvent(ev)
  }

  private fun enterFullscreen(view: View, callback: WebChromeClient.CustomViewCallback) {
    if (fullscreenView != null) {
      callback.onCustomViewHidden()
      return
    }
    fullscreenView = view
    fullscreenCallback = callback
    fullscreenScale = 1f
    view.setBackgroundColor(Color.BLACK)
    // Onto the decor view, NOT the padded content view — fullscreen must
    // cover the inset strips the normal UI deliberately avoids.
    (window.decorView as ViewGroup).addView(
      view,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.hide(WindowInsetsCompat.Type.systemBars())
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    // WebView never implements screen.orientation.lock, so the page can't
    // rotate itself the way it does in Chrome — rotate for it, the way
    // video fullscreen is expected to behave. USER_LANDSCAPE still honors
    // both landscape directions. (Trade-off: portrait videos also go
    // landscape; the user's sensor rotation is respected on exit.)
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_USER_LANDSCAPE
  }

  private fun exitFullscreen() {
    val view = fullscreenView ?: return
    fullscreenView = null
    view.scaleX = 1f
    view.scaleY = 1f
    fullscreenScale = 1f
    (window.decorView as ViewGroup).removeView(view)
    val callback = fullscreenCallback
    fullscreenCallback = null
    WindowInsetsControllerCompat(window, window.decorView)
      .show(WindowInsetsCompat.Type.systemBars())
    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    callback?.onCustomViewHidden()
  }

  /// wry's RustWebChromeClient is final and attached from Rust AFTER
  /// onWebViewCreate returns (main_pipe.rs: setWebView -> ... ->
  /// setWebChromeClient in one main-thread block), so this runs via
  /// webView.post: by then wry's client is in place and can be wrapped.
  /// The wrapper delegates every behavior wry implements (dialogs,
  /// permissions, file chooser, console, title -> Rust) and replaces only
  /// the fullscreen pair. Needs the webChromeClient getter (API 26+);
  /// below that the old no-fullscreen behavior remains.
  private fun installFullscreenClient() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val wry = webView.webChromeClient ?: return
    webView.webChromeClient = object : WebChromeClient() {
      override fun onShowCustomView(view: View, callback: CustomViewCallback) =
        enterFullscreen(view, callback)

      override fun onHideCustomView() = exitFullscreen()

      override fun onPermissionRequest(request: PermissionRequest) =
        wry.onPermissionRequest(request)

      override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult) =
        wry.onJsAlert(view, url, message, result)

      override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult) =
        wry.onJsConfirm(view, url, message, result)

      override fun onJsPrompt(
        view: WebView,
        url: String,
        message: String,
        defaultValue: String?,
        result: JsPromptResult,
      ) = wry.onJsPrompt(view, url, message, defaultValue, result)

      override fun onGeolocationPermissionsShowPrompt(
        origin: String,
        callback: GeolocationPermissions.Callback,
      ) = wry.onGeolocationPermissionsShowPrompt(origin, callback)

      override fun onShowFileChooser(
        view: WebView,
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: FileChooserParams,
      ) = wry.onShowFileChooser(view, filePathCallback, fileChooserParams)

      override fun onConsoleMessage(consoleMessage: ConsoleMessage) =
        wry.onConsoleMessage(consoleMessage)

      override fun onReceivedTitle(view: WebView, title: String) =
        wry.onReceivedTitle(view, title)
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    webView.addJavascriptInterface(ShortcutBridge(), "TsShortcuts")
    webView.post { installFullscreenClient() }

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
          // Fullscreen video first: Back exits fullscreen, not the page —
          // the same contract every browser honors.
          fullscreenView != null -> exitFullscreen()
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
