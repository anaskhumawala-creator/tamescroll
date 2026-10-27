import Foundation
import SwiftRs
import Tauri
import UIKit
import WebKit

struct PageScriptArgs: Decodable {
  let source: String
}

struct BlockerArgs: Decodable {
  let id: String
  let path: String
}

struct BlockingArgs: Decodable {
  let on: Bool
}

class TsWebkitPlugin: Plugin {
  weak var webview: WKWebView?
  /// The one user script that is ours, so a replacement can drop exactly
  /// it and keep Tauri's own scripts in their original order.
  var pageScript: WKUserScript?
  /// The compiled network block list, once WebKit has it.
  var blocker: WKContentRuleList?
  /// Off while the current platform's Ads switch is Shown.
  var blockingOn = true

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

extension TsWebkitPlugin {
  @objc public func prepareBlocker(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(BlockerArgs.self)
    guard let store = WKContentRuleListStore.default() else {
      invoke.reject("no content rule list store")
      return
    }
    // Lists from earlier builds or earlier rule updates are dead weight.
    store.getAvailableContentRuleListIdentifiers { ids in
      for old in (ids ?? []) where old != args.id {
        store.removeContentRuleList(forIdentifier: old) { _ in }
      }
    }
    store.lookUpContentRuleList(forIdentifier: args.id) { found, _ in
      if let found = found {
        self.install(found)
        invoke.resolve()
        return
      }
      guard let json = try? String(contentsOfFile: args.path, encoding: .utf8) else {
        invoke.reject("cannot read \(args.path)")
        return
      }
      store.compileContentRuleList(forIdentifier: args.id, encodedContentRuleList: json) {
        list, error in
        if let list = list {
          self.install(list)
          invoke.resolve()
        } else {
          invoke.reject(error?.localizedDescription ?? "compile failed")
        }
      }
    }
  }

  @objc public func setBlocking(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(BlockingArgs.self)
    DispatchQueue.main.async {
      self.blockingOn = args.on
      self.applyBlocker()
      invoke.resolve()
    }
  }

  func install(_ list: WKContentRuleList) {
    DispatchQueue.main.async {
      self.blocker = list
      self.applyBlocker()
    }
  }

  func applyBlocker() {
    guard let webview = webview, let blocker = blocker else { return }
    let controller = webview.configuration.userContentController
    controller.remove(blocker)
    if blockingOn {
      controller.add(blocker)
    }
  }
}

@_cdecl("init_plugin_ts_webkit")
func initPlugin() -> Plugin {
  return TsWebkitPlugin()
}
