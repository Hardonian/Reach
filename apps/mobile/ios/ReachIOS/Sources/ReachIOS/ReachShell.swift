import Foundation
import SwiftUI

public struct RunSummary: Identifiable, Codable {
    public let id: String
    public let status: String
}



public struct ConnectorSummary: Identifiable, Codable {
    public let id: String
    public let provider: String
    public let scopes: [String]
    public let risk: String
    public var enabled: Bool
}

struct SseEnvelope: Decodable {
    let runId: String?
    let eventId: String?
    let type: String?
    let payload: [String: String]?
}

@MainActor
public final class ReachViewModel: ObservableObject {
    @Published public private(set) var runs: [RunSummary] = []
    @Published public private(set) var terminalLines: [String] = []
    @Published public var command: String = ""
    @Published public var connectors: [ConnectorSummary] = [
        .init(id: "github-core", provider: "github", scopes: ["workspace:read", "repo:read"], risk: "moderate", enabled: true),
        .init(id: "filesystem-admin", provider: "filesystem", scopes: ["workspace:write"], risk: "strict", enabled: false),
        .init(id: "jira-experimental", provider: "jira", scopes: ["tickets:read", "tickets:write"], risk: "experimental", enabled: false)
    ]

    private var streamTask: Task<Void, Never>?
    private let maxEvents = 200

    public init() {}

    deinit {
        streamTask?.cancel()
    }

    public func connectSSE(baseURL: URL, runID: String, lastEventID: String? = nil) {
        streamTask?.cancel()
        streamTask = Task {
            await stream(baseURL: baseURL, runID: runID, lastEventID: lastEventID)
        }
    }

    private func stream(baseURL: URL, runID: String, lastEventID: String?) async {
        var request = URLRequest(url: baseURL.appending(path: "/v1/runs/\(runID)/events"))
        request.timeoutInterval = 60
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        if let lastEventID, !lastEventID.isEmpty {
            request.setValue(lastEventID, forHTTPHeaderField: "Last-Event-ID")
        }

        do {
            let (bytes, response) = try await URLSession.shared.bytes(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                terminalLines = ["SSE connection failed"]
                return
            }

            var currentEventId: String?
            var payloadLines: [String] = []

            for try await line in bytes.lines {
                if Task.isCancelled { break }
                if line.hasPrefix("id:") {
                    currentEventId = line.dropFirst(3).trimmingCharacters(in: .whitespaces)
                    continue
                }
                if line.hasPrefix("data:") {
                    payloadLines.append(line.dropFirst(5).trimmingCharacters(in: .whitespaces))
                    continue
                }
                if line.isEmpty {
                    if !payloadLines.isEmpty {
                        let payload = payloadLines.joined(separator: "\n")
                        appendEventLine(payload, fallbackEventID: currentEventId)
                    }
                    payloadLines.removeAll(keepingCapacity: true)
                    currentEventId = nil
                }
            }
        } catch {
            terminalLines = ["SSE error: \(error.localizedDescription)"]
        }
    }

    public func setConnectorEnabled(_ id: String, enabled: Bool) {
        connectors = connectors.map { item in
            guard item.id == id else { return item }
            return .init(id: item.id, provider: item.provider, scopes: item.scopes, risk: item.risk, enabled: enabled)
        }
    }

    private func appendEventLine(_ raw: String, fallbackEventID: String?) {
        if let data = raw.data(using: .utf8),
           let envelope = try? JSONDecoder().decode(SseEnvelope.self, from: data) {
            let eventID = envelope.eventId ?? fallbackEventID ?? "-"
            let eventType = envelope.type ?? "message"
            let line = "[\(eventID)] \(eventType) \(raw)"
            terminalLines = Array((terminalLines + [line]).suffix(maxEvents))
            return
        }

        terminalLines = Array((terminalLines + [raw]).suffix(maxEvents))
    }
}

public struct ReachShellView: View {
    @StateObject private var model = ReachViewModel()

    public init() {}

    public var body: some View {
        VStack(spacing: 8) {
            List(model.runs) { run in
                Text("\(run.id) · \(run.status)")
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
            }
            .frame(maxHeight: 120)



            List {
                ForEach(model.connectors) { connector in
                    VStack(alignment: .leading, spacing: 4) {
                        Toggle("\(connector.id) (\(connector.provider))", isOn: Binding(
                            get: { connector.enabled },
                            set: { model.setConnectorEnabled(connector.id, enabled: $0) }
                        ))
                        Text("Scopes: \(connector.scopes.joined(separator: ", "))")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(.cyan)
                        Text("Risk: \(connector.risk)")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(connector.risk == "strict" ? .red : connector.risk == "experimental" ? .yellow : .green)
                    }
                }
            }
            .frame(maxHeight: 180)

            List(model.terminalLines, id: \.self) { line in
                Text(line)
                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                    .lineLimit(2)
            }

            HStack(spacing: 8) {
                TextField("Command", text: $model.command)
                    .textFieldStyle(.roundedBorder)
                Button("Send") { model.command = "" }
            }
            .padding(.horizontal, 8)
        }
        .padding(.vertical, 8)
        .background(Color.black)
    }
}
