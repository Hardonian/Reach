import Foundation
import SwiftUI

public struct RunSummary: Identifiable, Codable {
    public let id: String
    public let status: String
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
    @Published public private(set) var autonomousIterations: Int = 0
    @Published public private(set) var autonomousStatus: String = "idle"

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

    private func appendEventLine(_ raw: String, fallbackEventID: String?) {
        if let data = raw.data(using: .utf8),
           let envelope = try? JSONDecoder().decode(SseEnvelope.self, from: data) {
            let eventID = envelope.eventId ?? fallbackEventID ?? "-"
            let eventType = envelope.type ?? "message"
            let line = "[\(eventID)] \(eventType) \(raw)"
            if eventType == "autonomous.checkpoint",
               let value = envelope.payload?["iteration"], let i = Int(value) {
                autonomousIterations = i
                autonomousStatus = "running"
            }
            if eventType == "autonomous.stopped" {
                autonomousStatus = "stopped"
            }
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

            List(model.terminalLines, id: \.self) { line in
                Text(line)
                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                    .lineLimit(2)
            }

            Text("Autonomous: \(model.autonomousStatus) · Iterations: \(model.autonomousIterations)")
                .foregroundStyle(.green)
                .font(.system(size: 12, weight: .regular, design: .monospaced))

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
