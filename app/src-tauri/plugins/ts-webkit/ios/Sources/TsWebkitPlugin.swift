import Foundation
import SwiftRs
import Tauri
import UIKit
import WebKit

struct PageScriptArgs: Decodable {
  let source: String
}

class TsWebkitPlugin: Plugin {
  weak var webview: WKWebView?
  /// The one user script that is ours, so a replacement can drop exactly
  /// it and keep Tauri's own scripts in their original order.
  var pageScript: WKUserScript?

  override func load(webview: WKWebView) {
    self.webview = webview
    // iPhone has no Back button. The edge swipe is how people expect to
    // go back, including from a platform to the launcher.
    webview.allowsBackForwardNavigationGestures = true
  }

  @objc public func setPageScript(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PageScriptArgs.self)
    DispatchQueue.main.async {
      guard let webview = self.webview else {
        invoke.reject("no webview yet")
        return
      }
      let controller = webview.configuration.userContentController
      // WebKit can remove only ALL user scripts, so keep the others and
      // put them back in the order they were added.
      let keep = controller.userScripts.filter { $0 !== self.pageScript }
      controller.removeAllUserScripts()
      keep.forEach { controller.addUserScript($0) }
      let script = WKUserScript(
        source: args.source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
      controller.addUserScript(script)
      self.pageScript = script
      invoke.resolve()
    }
  }
}

@_cdecl("init_plugin_ts_webkit")
func initPlugin() -> Plugin {
  return TsWebkitPlugin()
}
