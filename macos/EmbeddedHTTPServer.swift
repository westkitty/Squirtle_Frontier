import Foundation
import Network

enum EmbeddedHTTPServerError: LocalizedError {
    case invalidRoot(URL)
    case invalidPort(UInt16)
    case startTimedOut
    case startFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidRoot(let url):
            return "Embedded site directory is missing or invalid: \(url.path)"
        case .invalidPort(let port):
            return "Invalid embedded HTTP port: \(port)"
        case .startTimedOut:
            return "Embedded HTTP server did not become ready."
        case .startFailed(let message):
            return "Embedded HTTP server could not start: \(message)"
        }
    }
}

final class EmbeddedHTTPServer {
    let root: URL
    let origin: URL

    private let listener: NWListener
    private let queue = DispatchQueue(label: "com.westkitty.squirtlefrontier.http")
    private let startupSignal = DispatchSemaphore(value: 0)
    private let startupLock = NSLock()

    private var startupFinished = false
    private var startupError: Error?

    init(root: URL, port rawPort: UInt16 = 4173) throws {
        let fileManager = FileManager.default
        let canonicalRoot = root.resolvingSymlinksInPath().standardizedFileURL
        var isDirectory: ObjCBool = false

        guard canonicalRoot.isFileURL,
              fileManager.fileExists(atPath: canonicalRoot.path, isDirectory: &isDirectory),
              isDirectory.boolValue
        else {
            throw EmbeddedHTTPServerError.invalidRoot(root)
        }

        guard let port = NWEndpoint.Port(rawValue: rawPort) else {
            throw EmbeddedHTTPServerError.invalidPort(rawPort)
        }

        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: port)

        self.root = canonicalRoot
        self.origin = URL(string: "http://127.0.0.1:\(rawPort)/")!
        self.listener = try NWListener(using: parameters)

        listener.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                self?.finishStartup(error: nil)
            case .waiting(let error), .failed(let error):
                self?.finishStartup(error: error)
            default:
                break
            }
        }

        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }
    }

    func start(timeout: DispatchTimeInterval = .seconds(3)) throws {
        listener.start(queue: queue)

        guard startupSignal.wait(timeout: .now() + timeout) == .success else {
            listener.cancel()
            throw EmbeddedHTTPServerError.startTimedOut
        }

        if let startupError {
            listener.cancel()
            throw EmbeddedHTTPServerError.startFailed(String(describing: startupError))
        }
    }

    func stop() {
        listener.cancel()
    }

    private func finishStartup(error: Error?) {
        startupLock.lock()
        defer { startupLock.unlock() }

        guard !startupFinished else { return }
        startupFinished = true
        startupError = error
        startupSignal.signal()
    }

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        receiveRequest(on: connection, buffer: Data())
    }

    private func receiveRequest(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16 * 1024) {
            [weak self] data, _, complete, error in
            guard let self else {
                connection.cancel()
                return
            }

            var request = buffer
            if let data { request.append(data) }

            if request.count > 64 * 1024 {
                self.sendError(431, "Request Header Fields Too Large", connection: connection)
                return
            }

            let delimiter = Data([13, 10, 13, 10])
            if request.range(of: delimiter) != nil {
                self.respond(to: request, on: connection)
                return
            }

            if error != nil || complete {
                connection.cancel()
                return
            }

            self.receiveRequest(on: connection, buffer: request)
        }
    }

    private func respond(to request: Data, on connection: NWConnection) {
        let delimiter = Data([13, 10, 13, 10])

        guard let end = request.range(of: delimiter) else {
            sendError(400, "Bad Request", connection: connection)
            return
        }

        let header = String(decoding: request[..<end.lowerBound], as: UTF8.self)
        guard let requestLine = header.components(separatedBy: "\r\n").first else {
            sendError(400, "Bad Request", connection: connection)
            return
        }

        let parts = requestLine.split(separator: " ", omittingEmptySubsequences: true)
        guard parts.count >= 2 else {
            sendError(400, "Bad Request", connection: connection)
            return
        }

        let method = String(parts[0])
        let target = String(parts[1])

        guard method == "GET" || method == "HEAD" else {
            sendError(405, "Method Not Allowed", connection: connection)
            return
        }

        guard let components = URLComponents(string: target),
              var path = components.percentEncodedPath.removingPercentEncoding
        else {
            sendError(400, "Bad Request", connection: connection)
            return
        }

        if path == "/" {
            path = "/index.html"
        } else if path.hasSuffix("/") {
            path += "index.html"
        }

        guard path.hasPrefix("/"), !path.contains("\0") else {
            sendError(400, "Bad Request", connection: connection)
            return
        }

        let relativePath = String(path.dropFirst())
        let candidate = root
            .appendingPathComponent(relativePath)
            .resolvingSymlinksInPath()
            .standardizedFileURL
        let rootPrefix = root.path + "/"

        guard candidate.path.hasPrefix(rootPrefix) else {
            sendError(403, "Forbidden", connection: connection)
            return
        }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory),
              !isDirectory.boolValue
        else {
            sendError(404, "Not Found", connection: connection)
            return
        }

        do {
            let body = try Data(contentsOf: candidate, options: .mappedIfSafe)
            send(
                status: 200,
                reason: "OK",
                contentType: mimeType(for: candidate),
                body: body,
                headOnly: method == "HEAD",
                connection: connection
            )
        } catch {
            sendError(500, "Internal Server Error", connection: connection)
        }
    }

    private func sendError(_ status: Int, _ reason: String, connection: NWConnection) {
        let body = Data("\(status) \(reason)\n".utf8)
        send(
            status: status,
            reason: reason,
            contentType: "text/plain; charset=utf-8",
            body: body,
            headOnly: false,
            connection: connection
        )
    }

    private func send(
        status: Int,
        reason: String,
        contentType: String,
        body: Data,
        headOnly: Bool,
        connection: NWConnection
    ) {
        let header = [
            "HTTP/1.1 \(status) \(reason)",
            "Content-Type: \(contentType)",
            "Content-Length: \(body.count)",
            "Cache-Control: no-cache",
            "X-Content-Type-Options: nosniff",
            "Connection: close",
            "",
            ""
        ].joined(separator: "\r\n")

        var response = Data(header.utf8)
        if !headOnly { response.append(body) }

        connection.send(content: response, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    private func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html":
            return "text/html; charset=utf-8"
        case "css":
            return "text/css; charset=utf-8"
        case "js", "mjs":
            return "text/javascript; charset=utf-8"
        case "json":
            return "application/json"
        case "webmanifest":
            return "application/manifest+json"
        case "wasm":
            return "application/wasm"
        case "glb":
            return "model/gltf-binary"
        case "gltf":
            return "model/gltf+json"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "webp":
            return "image/webp"
        case "gif":
            return "image/gif"
        case "svg":
            return "image/svg+xml"
        case "ico":
            return "image/x-icon"
        case "woff":
            return "font/woff"
        case "woff2":
            return "font/woff2"
        case "ttf":
            return "font/ttf"
        case "otf":
            return "font/otf"
        case "mp3":
            return "audio/mpeg"
        case "wav":
            return "audio/wav"
        case "ogg":
            return "audio/ogg"
        case "mp4":
            return "video/mp4"
        case "webm":
            return "video/webm"
        default:
            return "application/octet-stream"
        }
    }
}
