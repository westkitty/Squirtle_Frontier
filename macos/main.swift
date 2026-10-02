import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverProcess: Process?
    var targetUrl: URL!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        setupMenus()
        determineAndStartServer()
        setupWindow()
        loadGame()
    }

    func setupMenus() {
        let mainMenu = NSMenu()
        
        // App Menu
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

        // View Menu
        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        let reloadItem = NSMenuItem(title: "Reload", action: #selector(reloadGame), keyEquivalent: "r")
        viewMenu.addItem(reloadItem)
        let fullScreenItem = NSMenuItem(title: "Toggle Full Screen", action: #selector(toggleFullScreen), keyEquivalent: "f")
        fullScreenItem.keyEquivalentModifierMask = [.command, .control]
        viewMenu.addItem(fullScreenItem)
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        // Window Menu
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

    func findSiteDirectory() -> String? {
        let fileManager = FileManager.default

        // 1. Check inside App Bundle Resources/site or Resources/dist
        if let resURL = Bundle.main.resourceURL {
            let sitePath = resURL.appendingPathComponent("site").path
            if fileManager.fileExists(atPath: sitePath) { return sitePath }
            let distPath = resURL.appendingPathComponent("dist").path
            if fileManager.fileExists(atPath: distPath) { return distPath }
        }

        // 2. Check local repo dist folder
        let repoDist = "/Users/andrew/Squirtle_Frontier/dist"
        if fileManager.fileExists(atPath: repoDist) { return repoDist }

        return nil
    }

    func determineAndStartServer() {
        // Priority 1: Live Vite dev server on 5173
        if isUrlReachable("http://127.0.0.1:5173/") {
            targetUrl = URL(string: "http://127.0.0.1:5173/")!
            return
        }

        // Priority 2: Existing static server on 4173
        if isUrlReachable("http://127.0.0.1:4173/") {
            targetUrl = URL(string: "http://127.0.0.1:4173/")!
            return
        }

        // Priority 3: Spawn local Python HTTP server on port 4173
        guard let siteDir = findSiteDirectory() else {
            fatalError("Could not find web game directory (dist or site).")
        }

        let port = "4173"
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = ["-m", "http.server", port, "--bind", "127.0.0.1", "--directory", siteDir]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            self.serverProcess = process
            targetUrl = URL(string: "http://127.0.0.1:\(port)/")!

            // Wait for server to come up (up to 3 seconds)
            for _ in 0..<30 {
                if isUrlReachable("http://127.0.0.1:\(port)/") { break }
                Thread.sleep(forTimeInterval: 0.1)
            }
        } catch {
            print("Failed to spawn background python server: \(error)")
            targetUrl = URL(string: "http://127.0.0.1:4173/")!
        }
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

        // Appearance
        window.titlebarAppearsTransparent = false
        window.isReleasedWhenClosed = false

        // WKWebView Configuration
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
        let request = URLRequest(url: targetUrl)
        webView.load(request)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let proc = serverProcess, proc.isRunning {
            proc.terminate()
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
