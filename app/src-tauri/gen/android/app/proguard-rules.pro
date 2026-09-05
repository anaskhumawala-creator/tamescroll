# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# tamescroll: every WebView bridge (TsLinks, TsDiag, TsPerf, ...) is an
# inner class of MainActivity reached by name from page JS. Release
# minification must keep those methods or the launcher silently loses
# its bridges.
-keepclassmembers class app.tamescroll.client.MainActivity$* {
  @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
