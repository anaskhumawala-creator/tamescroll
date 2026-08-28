package app.tamescroll.client

import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import org.json.JSONObject
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
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebResourceError
import android.graphics.Bitmap
import java.io.ByteArrayInputStream
import android.util.Log
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

  companion object {
    // Kept in lockstep with appupdate.rs DEFAULT_MANIFEST_URL. Fixed so
    // no page-supplied URL is ever fetched by the installer.
    private const val UPDATE_MANIFEST_URL =
      "https://raw.githubusercontent.com/anaskhumawala-creator/tamescroll/main/updates/app-manifest.json"
  }

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
      // ime() included: with edge-to-edge enforced (targetSdk 35+) the
      // window no longer resizes for the keyboard, and this listener
      // consumes the insets — without ime() the keyboard would overlap
      // focused inputs (review 2026-08-23 #14).
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars()
          or WindowInsetsCompat.Type.displayCutout()
          or WindowInsetsCompat.Type.ime()
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

  // ---- in-app updater (owner ask 2026-08-23: stop re-sending the APK
  // over WhatsApp). install() downloads the latest build and hands it to
  // the system package installer, which ALWAYS asks the user to confirm.
  //
  // Security: the manifest URL is hardcoded (same GitHub raw host as the
  // rules OTA), the APK URL + sha256 come only from that manifest, and
  // the downloaded file is rejected unless its hash matches. No value
  // from page JavaScript is trusted, so the interface being visible to
  // remote platform pages cannot be turned into an arbitrary-APK install.
  @Volatile
  private var updating = false

  // ---- diagnostics (owner ask 2026-08-28: "can't you implement a
  // diagnostics feature in the app ... so you can always check the
  // logs", then "or give me the control of reporting").
  //
  // NOTHING HERE UPLOADS ANYTHING. A platform page hands over a report
  // that its own redaction gate already passed (diag-report.mjs), and
  // this appends it to one local file the Settings pane can show and
  // share. The owner is the transport.
  //
  // The page is untrusted even though we injected the code that calls
  // this: a hostile page can call submit() with anything. So the input
  // is size-capped, must parse as JSON, must carry our own version
  // marker, and is re-checked for the two things that must never reach
  // a log -- a scheme and a protocol-relative url -- before it is
  // written. The file is capped and rotates.
  inner class DiagBridge {
    @JavascriptInterface
    fun submit(json: String) {
      try {
        if (json.length > 128 * 1024) return
        val o = JSONObject(json)
        if (o.optInt("v", 0) != 1) return
        if (json.contains("://") || json.contains("//")) return
        synchronized(diagLock) {
          val f = File(filesDir, "diagnostics.jsonl")
          if (f.length() > 512 * 1024) {
            // Keep the most recent half rather than deleting the lot:
            // the report that explains a complaint is usually the last
            // one, and a file that vanishes takes the evidence with it.
            val keep = f.readLines().takeLast(40)
            f.writeText(keep.joinToString("\n", postfix = "\n"))
          }
          // One report per line, so the file is appendable, tailable and
          // survives a truncated write at the end.
          f.appendText(json.replace("\n", " ") + "\n")
        }
      } catch (e: Exception) {
        // A diagnostic that crashes the app is the worst possible
        // outcome of a diagnostic.
      }
    }

    /** Everything collected so far, for the Settings pane. */
    @JavascriptInterface
    fun read(): String {
      return try {
        synchronized(diagLock) {
          val f = File(filesDir, "diagnostics.jsonl")
          if (f.exists()) f.readText() else ""
        }
      } catch (e: Exception) {
        ""
      }
    }

    /** Hand the file to the system share sheet. The owner chooses who
     * sees it; the app never chooses for him. */
    @JavascriptInterface
    fun share() {
      runOnUiThread {
        try {
          val f = File(filesDir, "diagnostics.jsonl")
          if (!f.exists() || f.length() == 0L) return@runOnUiThread
          val out = File(cacheDir, "tamescroll-diagnostics.txt")
          f.copyTo(out, overwrite = true)
          val uri = FileProvider.getUriForFile(
            this@MainActivity, "$packageName.fileprovider", out
          )
          val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
          startActivity(Intent.createChooser(send, "Share diagnostics"))
        } catch (e: Exception) {
          // No share target, or a provider refusal: the Copy button in
          // Settings still works.
        }
      }
    }

    @JavascriptInterface
    fun clear() {
      try {
        synchronized(diagLock) { File(filesDir, "diagnostics.jsonl").delete() }
      } catch (e: Exception) {
      }
    }
  }

  private val diagLock = Any()

  inner class UpdateBridge {
    @JavascriptInterface
    fun install() {
      if (updating) return
      updating = true
      Thread {
        try {
          val manifest = JSONObject(httpGet(UPDATE_MANIFEST_URL))
          val versionCode = manifest.optLong("versionCode", 0)
          val apkUrl = manifest.optString("apkUrl", "")
          val sha256 = manifest.optString("sha256", "").lowercase()
          if (versionCode <= BuildConfig.VERSION_CODE || apkUrl.isEmpty() || sha256.isEmpty()) {
            report("No installable update.")
            return@Thread
          }
          report("Downloading update…")
          val apk = File(externalCacheDir, "tamescroll-update.apk")
          val got = download(apkUrl, apk)
          if (got != sha256) {
            apk.delete()
            report("Update failed a security check. Not installed.")
            return@Thread
          }
          report("Starting install…")
          runOnUiThread { launchInstall(apk) }
        } catch (e: Exception) {
          report("Couldn't reach the update server.")
        } finally {
          updating = false
        }
      }.start()
    }

    // Push a one-line status back to the launcher without a nag surface.
    private fun report(msg: String) {
      runOnUiThread {
        if (this@MainActivity::webView.isInitialized) {
          val safe = msg.replace("\\", "\\\\").replace("'", "\\'")
          webView.evaluateJavascript(
            "window.__tsUpdateStatus && window.__tsUpdateStatus('" + safe + "')",
            null,
          )
        }
      }
    }
  }

  private fun httpGet(spec: String): String {
    val conn = URL(spec).openConnection() as HttpURLConnection
    conn.connectTimeout = 15000
    conn.readTimeout = 30000
    conn.instanceFollowRedirects = true
    try {
      return conn.inputStream.bufferedReader().use { it.readText() }
    } finally {
      conn.disconnect()
    }
  }

  // Streams url -> file, returning the lowercase sha256 hex of the bytes
  // written so the caller can verify against the manifest before ever
  // handing the file to the installer.
  private fun download(spec: String, dest: File): String {
    val conn = URL(spec).openConnection() as HttpURLConnection
    conn.connectTimeout = 15000
    conn.readTimeout = 60000
    conn.instanceFollowRedirects = true
    val digest = MessageDigest.getInstance("SHA-256")
    try {
      conn.inputStream.use { input ->
        dest.outputStream().use { output ->
          val buf = ByteArray(64 * 1024)
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            digest.update(buf, 0, n)
            output.write(buf, 0, n)
          }
        }
      }
    } finally {
      conn.disconnect()
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun launchInstall(apk: File) {
    val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startActivity(intent)
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

  // --- Network ad blocking -------------------------------------------
  //
  // Owner 2026-08-25: "ads started appearing again... why were they able
  // to get through?" They always could. The adblock engine shipped in
  // Phase 2.5 with EasyList/EasyPrivacy/uBO compiled in, and the app
  // only ever asked it which ELEMENTS to hide. Hiding cannot stop a
  // request, and a YouTube pre-roll is not an element — it is video
  // served through the player. This is the missing half.
  //
  // shouldInterceptRequest runs on a background thread for every
  // subresource, so the decision has to be synchronous: it calls
  // straight into the Rust engine over JNI rather than through a Tauri
  // command (JS-facing, async, main thread).
  private external fun nativeShouldBlock(
    url: String,
    sourceUrl: String,
    resourceType: String,
  ): Boolean

  /// Resources we answer ourselves on the page's own origin — today the
  /// inference worker. Returns null for every normal request.
  ///
  /// This is what lets the models run off the page's main thread:
  /// YouTube requires Trusted Types for scripts, which refuses a blob:
  /// worker but allows a SAME-ORIGIN script url, and nothing serves such
  /// a url but us.
  private external fun nativeSyntheticResource(url: String): ByteArray?

  /// The script is ~16MB, so it crosses JNI once per process and is then
  /// served from a file: a cached ByteArray would sit in the heap of a
  /// device that has none to spare, and re-reading it per page load
  /// would copy it again.
  private var syntheticFile: java.io.File? = null

  private fun syntheticResponse(url: String): WebResourceResponse? {
    try {
      val cached = syntheticFile
      if (cached != null && cached.exists()) {
        return syntheticStream(java.io.FileInputStream(cached))
      }
      val bytes = nativeSyntheticResource(url) ?: return null
      val out = java.io.File(cacheDir, "tamescroll-synthetic.js")
      out.writeBytes(bytes)
      syntheticFile = out
      return syntheticStream(java.io.FileInputStream(out))
    } catch (e: Throwable) {
      // Falling through means the page simply does not get a worker and
      // the in-page pipeline runs, which is the previous behaviour.
      Log.w("tamescroll", "synthetic resource failed: " + e.message)
      return null
    }
  }

  private fun syntheticStream(stream: java.io.InputStream): WebResourceResponse =
    WebResourceResponse(
      "text/javascript",
      "utf-8",
      200,
      "OK",
      mapOf("Cache-Control" to "no-store"),
      stream,
    )

  /// A blocked request answers with an empty 204 rather than an error.
  /// A hard failure makes pages retry, log errors and sometimes show
  /// their own "content blocked" placeholder — an empty success is the
  /// quiet outcome, and quiet is the product (NO NAGS).
  private fun blockedResponse(): WebResourceResponse =
    WebResourceResponse("text/plain", "utf-8", 204, "No Content", emptyMap(), ByteArrayInputStream(ByteArray(0)))

  /// Filter lists genuinely use resource-type options (script-only,
  /// image-only, third-party-only rules), so the type is part of the
  /// decision, not decoration. Android does not hand us the fetch
  /// destination directly, so it is inferred from the Accept header and
  /// the URL — imperfect, but far better than passing "other" for
  /// everything, which would silently disable every typed rule.
  private fun resourceTypeOf(request: WebResourceRequest): String {
    if (request.isForMainFrame) return "document"
    val accept = request.requestHeaders?.get("Accept").orEmpty()
    val path = request.url.path.orEmpty().lowercase()
    return when {
      accept.contains("text/css") || path.endsWith(".css") -> "stylesheet"
      accept.contains("image/") || Regex("\\.(png|jpe?g|gif|webp|svg|ico)$").containsMatchIn(path) -> "image"
      path.endsWith(".js") || path.endsWith(".mjs") -> "script"
      accept.contains("text/html") -> "sub_frame"
      Regex("\\.(mp4|webm|m4s|ts)$").containsMatchIn(path) -> "media"
      accept.contains("application/json") -> "xhr"
      else -> "other"
    }
  }

  /// Same shape as installFullscreenClient: wry's RustWebViewClient is
  /// final and attached from Rust after onWebViewCreate returns, so this
  /// runs via webView.post and WRAPS it. Every method wry overrides is
  /// forwarded verbatim — the wrapper adds a block check in front of
  /// shouldInterceptRequest and changes nothing else. Getting this wrong
  /// breaks the custom protocol the whole app is served over, so the
  /// delegation is deliberately total.
  private fun installBlockingClient() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val wry = webView.webViewClient
    webView.webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest,
      ): WebResourceResponse? {
        try {
          val url = request.url.toString()
          // Never evaluate our own surfaces: a false positive there
          // bricks the app, and they cannot serve an ad.
          if (!url.startsWith("http")) return wry.shouldInterceptRequest(view, request)
          // Ours before theirs: this url exists only because we answer
          // it, and it must never be run past the block rules.
          if (url.contains("/__tamescroll/")) {
            syntheticResponse(url)?.let { return it }
          }
          val page = view.url.orEmpty()
          if (nativeShouldBlock(url, page, resourceTypeOf(request))) return blockedResponse()
        } catch (e: Throwable) {
          // Fail OPEN. An engine that cannot answer must not take the
          // page down with it: a missed ad is a nuisance, a dead page is
          // a broken app.
          Log.w("tamescroll", "block check failed, allowing: " + e.message)
        }
        return wry.shouldInterceptRequest(view, request)
      }

      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) =
        wry.shouldOverrideUrlLoading(view, request)

      override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) =
        wry.onPageStarted(view, url, favicon)

      override fun onPageFinished(view: WebView, url: String) = wry.onPageFinished(view, url)

      override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
      ) = wry.onReceivedError(view, request, error)
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    webView.addJavascriptInterface(ShortcutBridge(), "TsShortcuts")
    // Updater bridge: only ever reachable from the launcher's About
    // pane. It takes NO url from JS — it re-fetches the fixed manifest
    // itself and hash-pins the download, so a hostile platform page
    // poking it can at most trigger a user-confirmed install of the
    // real app (see UpdateBridge).
    webView.addJavascriptInterface(UpdateBridge(), "TsUpdater")
    // Diagnostics: write-mostly, local-only. See DiagBridge for why a
    // hostile page cannot turn it into anything but a wasted disk write.
    webView.addJavascriptInterface(DiagBridge(), "TsDiag")
    webView.post { installFullscreenClient() }
    webView.post { installBlockingClient() }

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
