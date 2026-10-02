import Cocoa
import WebKit

enum LaunchError: LocalizedError {
    case missingEmbeddedSite

    var errorDescription: String? {
        switch self {
        case .missingEmbeddedSite:
            return "The installed app does not contain Contents/Resources/site/index.html."
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var embeddedServer: EmbeddedHTTPServer?
    var targetUrl: URL!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        setupMenus()

        do {
            targetUrl = try determineLaunchURL()
        } catch {
            let alert = NSAlert()
            alert.alertStyle = .critical
            alert.messageText = "Squirtle Frontier could not start"
            alert.informativeText =
                "\(error.localizedDescription)\n\n" +
                "Standalone mode uses the embedded site bundle on 127.0.0.1:4173. " +
                "If another process owns that port, close it and reopen Squirtle Frontier."
            alert.runModal()
            NSApp.terminate(nil)
            return
        }

        setupWindow()
        loadGame()
    }

    func setupMenus() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Squirtle Frontier")
        appMenu.addItem(withTitle: "About Squirtle Frontier", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide Squirtle Frontier", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Squirtle Frontier", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(NSMenuItem(title: "Reload", action: #selector(reloadGame), keyEquivalent: "r"))
        let fullScreenItem = NSMenuItem(title: "Toggle Full Screen", action: #selector(toggleFullScreen), keyEquivalent: "f")
        fullScreenItem.keyEquivalentModifierMask = [.command, .control]
        viewMenu.addItem(fullScreenItem)
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.zoom(_:)), keyEquivalent: "")
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        NSApp.mainMenu = mainMenu
    }

    @objc func showAbout() {
        let alert = NSAlert()
        alert.messageText = "Squirtle Frontier"
        alert.informativeText = "A small body. A wide world.\n\nAuthor: WestKitty\nEngine: Three.js r160 / Vanilla WebGL\nWrapper: Native macOS Desktop"
        alert.alertStyle = .informational
        alert.runModal()
    }

    @objc func reloadGame() {
        webView?.reload()
    }

    @objc func toggleFullScreen() {
        window?.toggleFullScreen(nil)
    }

    func isUrlReachable(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString) else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 0.5
        let semaphore = DispatchSemaphore(value: 0)
        var reachable = false

        let task = URLSession.shared.dataTask(with: request) { _, response, _ in
            if let httpResponse = response as? HTTPURLResponse, (200...399).contains(httpResponse.statusCode) {
                reachable = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 0.6)
        return reachable
    }

    func findEmbeddedSiteDirectory() -> URL? {
        guard let resources = Bundle.main.resourceURL else { return nil }

        let site = resources.appendingPathComponent("site", isDirectory: true)
        var isDirectory: ObjCBool = false

        guard FileManager.default.fileExists(atPath: site.path, isDirectory: &isDirectory),
              isDirectory.boolValue,
              FileManager.default.fileExists(atPath: site.appendingPathComponent("index.html").path)
        else {
            return nil
        }

        return site
    }

    func determineLaunchURL() throws -> URL {
        // Preserve the existing optional live-development attachment.
        if isUrlReachable("http://127.0.0.1:5173/") {
            return URL(string: "http://127.0.0.1:5173/")!
        }

        guard let site = findEmbeddedSiteDirectory() else {
            throw LaunchError.missingEmbeddedSite
        }

        // Production always serves this app bundle itself. Never attach to an
        // unrelated process on 4173: the fixed origin is also the save origin.
        let server = try EmbeddedHTTPServer(root: site, port: 4173)
        try server.start()
        embeddedServer = server
        return server.origin
    }

    func setupWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1280, height: 800)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Squirtle Frontier"
        window.center()
        window.minSize = NSSize(width: 960, height: 600)
        window.collectionBehavior = [.fullScreenPrimary]
        window.delegate = self
        window.titlebarAppearsTransparent = false
        window.isReleasedWhenClosed = false

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window.contentView?.addSubview(webView)
    }

    func loadGame() {
        webView.load(URLRequest(url: targetUrl))
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        embeddedServer?.stop()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
