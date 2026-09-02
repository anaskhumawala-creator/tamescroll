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
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebMessagePortCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

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

  /// Every synthetic url gets its OWN cache entry. A single slot was a
  /// real bug: the first `/__tamescroll/` request (the bundle) filled it
  /// and every later one — the model json and weights the worker fetches
  /// — was answered with those same bytes, so no model ever parsed and
  /// blur-first left every thumbnail covered.
  ///
  /// Bytes cross JNI once per url per process and are then served from a
  /// file: a cached ByteArray would sit in the heap of a device that has
  /// none to spare. The directory is emptied once per process so a new
  /// build can never be served the previous build's bytes.
  private val syntheticFiles = java.util.concurrent.ConcurrentHashMap<String, java.io.File>()
  private var syntheticDir: java.io.File? = null

  private fun syntheticCacheDir(): java.io.File {
    syntheticDir?.let { return it }
    val dir = java.io.File(cacheDir, "tamescroll-synthetic")
    if (dir.exists()) dir.deleteRecursively()
    // The single-slot cache this replaced left a file behind, and it is
    // the whole bundle — dead weight on a phone that has no room for it.
    java.io.File(cacheDir, "tamescroll-synthetic.js").delete()
    dir.mkdirs()
    syntheticDir = dir
    return dir
  }

  private fun syntheticResponse(url: String): WebResourceResponse? {
    try {
      val path = url.substringAfter("/__tamescroll/").substringBefore('?')
      if (path.isEmpty()) return null
      val key = path.replace(Regex("[^A-Za-z0-9._-]"), "_")
      val cached = syntheticFiles[key]
      if (cached != null && cached.exists()) {
        return syntheticStream(path, java.io.FileInputStream(cached))
      }
      val bytes = nativeSyntheticResource(url) ?: return null
      val out = java.io.File(syntheticCacheDir(), key)
      out.writeBytes(bytes)
      syntheticFiles[key] = out
      return syntheticStream(path, java.io.FileInputStream(out))
    } catch (e: Throwable) {
      // Falling through means the page simply does not get a worker and
      // the in-page pipeline runs, which is the previous behaviour.
      Log.w("tamescroll", "synthetic resource failed: " + e.message)
      return null
    }
  }

  private fun syntheticMime(path: String): String =
    when {
      path.endsWith(".json") -> "application/json"
      path.endsWith(".bin") -> "application/octet-stream"
      else -> "text/javascript"
    }

  private fun syntheticStream(path: String, stream: java.io.InputStream): WebResourceResponse =
    WebResourceResponse(
      syntheticMime(path),
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
  /// The top-level page url, written on the main thread and read from
  /// the interceptor's worker thread. See the note in
  /// installBlockingClient for why this exists rather than `view.url`.
  @Volatile private var pageUrlForBlocking: String = ""

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
          // NEVER `view.url` HERE. shouldInterceptRequest runs on a
          // WebView worker thread, and every WebView method must be
          // called on the thread that made it -- so reading view.url
          // threw on EVERY request, the catch below fail-opened, and
          // request blocking never ran on Android at all. It looked
          // healthy from the outside because the synthetic-resource
          // branch above returns before this line, so the inference
          // worker loaded normally while nothing was ever blocked.
          // MEASURED on the emulator 2026-08-30: 1,107 "block check
          // failed" warnings in one logcat, all of them this exception,
          // and the request counter stayed at 0 across three page loads.
          // The page url is recorded on the main thread instead.
          if (nativeShouldBlock(url, pageUrlForBlocking, resourceTypeOf(request))) {
            return blockedResponse()
          }
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

      override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        pageUrlForBlocking = url
        bindNativeInfer(view, url)
        wry.onPageStarted(view, url, favicon)
      }

      // An SPA navigation fires no onPageStarted, and m.youtube is one:
      // tapping a video never leaves the document. Without this the
      // source url handed to the engine would be whatever page was last
      // hard-loaded, and exception rules are scoped by source. (The
      // native-inference port is NOT re-bound here: an SPA nav keeps the
      // document, and the document keeps its port.)
      override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
        pageUrlForBlocking = url
        wry.doUpdateVisitedHistory(view, url, isReload)
      }

      override fun onPageFinished(view: WebView, url: String) {
        wry.onPageFinished(view, url)
      }

      override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
      ) {
        // OFFLINE SCREEN (owner ask 2026-09-01: "when there is no
        // internet and we try to open the YouTube app, it shows the link
        // isn't valid or something like that").
        //
        // WebView's own error page is a Chromium string about an invalid
        // URL, which reads like OUR app is broken rather than like the
        // network is down. Replace it with ours -- but only in the
        // narrow case where that is actually what happened.
        if (shouldShowOffline(request, error)) {
          view.loadDataWithBaseURL(
            null,
            offlineHtml(request.url.toString()),
            "text/html",
            "utf-8",
            // The failing url as the history entry, so Back behaves the
            // way it would have if the page HAD loaded, and a reload
            // retries the real page rather than re-rendering this one.
            request.url.toString(),
          )
          return
        }
        wry.onReceivedError(view, request, error)
      }
    }
  }

  /// Deliberately narrow. Three things have to be true, and each one is
  /// a way this could otherwise hide a real bug behind a friendly page:
  ///
  ///  - MAIN FRAME ONLY. A failed image or an XHR must not blank the
  ///    app; on a feed those fail constantly and by design (we block
  ///    them ourselves).
  ///  - A NETWORK error, not any error. An SSL failure or a bad scheme
  ///    is not "you are offline" and must keep its own page.
  ///  - NOT OUR OWN URLS. If tauri.localhost or a /__tamescroll/ url
  ///    fails, the app is broken and saying "check your connection"
  ///    would send the owner looking at his router.
  private fun shouldShowOffline(request: WebResourceRequest, error: WebResourceError): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
    if (!request.isForMainFrame) return false
    val url = request.url.toString()
    if (!url.startsWith("http")) return false
    if (url.contains("tauri.localhost") || url.contains("/__tamescroll/")) return false
    return when (error.errorCode) {
      WebViewClient.ERROR_HOST_LOOKUP,
      WebViewClient.ERROR_CONNECT,
      WebViewClient.ERROR_TIMEOUT,
      WebViewClient.ERROR_IO,
      WebViewClient.ERROR_UNKNOWN,
      -> true
      else -> false
    }
  }

  /// Self-contained: no network, no fonts, no images. It is the page
  /// shown when nothing can be fetched, so anything it references would
  /// fail too. Colours and type are the launcher's own tokens
  /// (app/src/styles.css) so it reads as part of the app rather than as
  /// a browser error, and the font stacks fall back to the system.
  ///
  /// It states a fact and offers two ways out. It does not apologise,
  /// does not blame, and asks for nothing -- NO NAGS is a hard rule here
  /// and an error screen is exactly where one usually creeps in.
  private fun offlineHtml(failed: String): String {
    val safe = failed
      .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
      .replace("\"", "&quot;")
    return """<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>No connection</title>
<style>
  :root {
    --bg:#141414; --ink:#e7e5e1; --muted:#a3a09a; --faint:#757169;
    --line:#343434; --hairline:rgba(255,255,255,.07);
    --elev:rgba(255,255,255,.035); --gold:#c9a45e;
    --font-ui:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --font-display:"Spectral",Georgia,serif;
  }
  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  html,body { height:100%; }
  body {
    background:var(--bg); color:var(--ink); font-family:var(--font-ui);
    display:flex; align-items:center; justify-content:center;
    padding:32px calc(24px + env(safe-area-inset-left)) 32px calc(24px + env(safe-area-inset-right));
    -webkit-user-select:none; user-select:none;
  }
  main { max-width:340px; width:100%; text-align:center;
         animation:ts-enter .18s cubic-bezier(.2,0,0,1) both; }
  @keyframes ts-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  @media (prefers-reduced-motion: reduce) { main { animation:none; } }
  .mark { font-family:var(--font-display); font-size:26px; letter-spacing:.01em; color:var(--gold); }
  h1 { font-size:19px; font-weight:600; margin-top:22px; }
  p { color:var(--muted); font-size:14.5px; line-height:1.5; margin-top:10px; }
  .host { color:var(--faint); font-size:12.5px; margin-top:18px; word-break:break-all; }
  .row { display:flex; gap:10px; margin-top:26px; }
  a { flex:1; display:block; text-decoration:none; padding:12px 14px; border-radius:10px;
      font-size:14.5px; border:1px solid var(--hairline); background:var(--elev);
      color:var(--muted); transition:border-color .15s ease, transform .15s ease; }
  a.primary { border-color:var(--gold); color:var(--ink); }
  a:active { transform:scale(.97); }
</style></head>
<body><main>
  <div class="mark">tamescroll</div>
  <h1>No connection</h1>
  <p>This page needs the internet, and your phone cannot reach it right now.</p>
  <div class="row">
    <a class="primary" href="$safe">Try again</a>
    <a href="http://tauri.localhost/">Home</a>
  </div>
  <p class="host">$safe</p>
</main></body></html>"""
  }

  // ---- Native on-device inference (2026-09-02 plan): the page keeps
  // all policy (anchors/NMS, parsePersons, gender/age reads, tracking,
  // cadence); Kotlin is a dumb tensor runner reached over a
  // WebMessagePort. See NativeInfer.kt for the protocol and why
  // WebMessagePortCompat.postMessage needs no main-thread hop (it is
  // annotated @AnyThread at the class level -- confirmed by
  // disassembling androidx.webkit 1.14.0's WebMessagePortCompat.class,
  // not merely assumed from the docs).
  //
  // The native tensor runner (NativeInfer.kt). ONE engine for the
  // process -- the GPU delegate spends ~8s compiling the three models on
  // the Redmi, so they are loaded on the first YouTube page and kept.
  // Each DOCUMENT gets its own WebMessagePort, bound from onPageStarted:
  // that is the only hook a new document has before its scripts run, and
  // an SPA navigation (doUpdateVisitedHistory) keeps the document and
  // therefore the port. The page's end is posted as the string message
  // `ts-native-port` with the port attached; the document-start script
  // stashes it, because the gaze bundle is evaluated later and a message
  // nobody is listening for is simply gone. No @JavascriptInterface is
  // involved anywhere in this path.
  @Volatile private var nativeInfer: NativeInfer? = null

  override fun onDestroy() {
    nativeInfer?.close()
    nativeInfer = null
    super.onDestroy()
  }

  private fun isYoutubeHost(host: String?): Boolean =
    host != null && (host == "youtube.com" || host.endsWith(".youtube.com"))

  private fun bindNativeInfer(view: WebView, url: String) {
    try {
      val host = try { Uri.parse(url).host } catch (e: Exception) { null }
      if (!isYoutubeHost(host)) return
      if (!WebViewFeature.isFeatureSupported(WebViewFeature.CREATE_WEB_MESSAGE_CHANNEL) ||
        !WebViewFeature.isFeatureSupported(WebViewFeature.POST_WEB_MESSAGE) ||
        !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_CALLBACK_ON_MESSAGE) ||
        !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
      ) {
        return
      }
      val engine = nativeInfer ?: NativeInfer(this).also { nativeInfer = it }
      val ports = WebViewCompat.createWebMessageChannel(view)
      engine.bind(ports[0])
      WebViewCompat.postWebMessage(
        view,
        WebMessageCompat("ts-native-port", arrayOf(ports[1])),
        Uri.parse("*"),
      )
    } catch (e: Throwable) {
      Log.w("TsNative", "native infer setup failed: " + e.message)
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
    // AUTOFILL. Owner ask: "can't we have the sign in page automatically
    // show the existing accounts on the device". There is no device
    // account chooser available to a WebView -- Android 8+ account
    // visibility only exposes Google accounts to signature-matched apps,
    // so that half is a platform wall, not something we can build. What
    // IS available is the autofill framework: Google Password Manager
    // offers his saved google.com login as a suggestion chip over the
    // field, and the password goes field -> framework without our code
    // ever seeing it. On by default from API 26, but only if nothing in
    // the view tree opts out, and wry never states an intent -- so state
    // it here rather than inherit whatever the parent happens to be.
    // Research: docs/research/google-signin-2026-08-28.md (option 5).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      webView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
    }
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
