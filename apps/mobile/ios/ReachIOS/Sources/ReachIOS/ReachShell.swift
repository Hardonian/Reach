import Foundation
import SwiftUI

public struct RunSummary: Identifiable, Codable {
    public let id: String
    public let status: String
}

public struct SessionMember: Identifiable, Codable {
    public let id: String
    public let role: String
}

public final class ReachViewModel: ObservableObject {
    @Published public var runs: [RunSummary] = []
    @Published public var terminalLines: [String] = []
    @Published public var command: String = ""
    @Published public var sessionID: String = ""
    @Published public var members: [SessionMember] = []
    @Published public var assignedNode: String = "-"

    public init() {}

    public func joinSession(id: String, member: String = "ios-user", role: String = "viewer") {
        guard !id.isEmpty else { return }
        sessionID = id
        if members.contains(where: { $0.id == member }) == false {
            members.append(SessionMember(id: member, role: role))
        }
    }

    public func connectSSE(baseURL: URL, runID: String) {
        let endpoint = baseURL.appending(path: "/v1/runs/\(runID)/events")
        let task = URLSession.shared.dataTask(with: endpoint) { data, _, _ in
            guard let data else { return }
            let text = String(decoding: data, as: UTF8.self)
            DispatchQueue.main.async {
                self.terminalLines = text.split(separator: "\n").map(String.init)
                if let line = self.terminalLines.first(where: { $0.contains("run.node.selected") }),
                   let range = line.range(of: "node_id") {
                    self.assignedNode = String(line[range.lowerBound...]).replacingOccurrences(of: "node_id", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }
        task.resume()
    }
}

public struct ReachShellView: View {
    @StateObject private var model = ReachViewModel()

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack {
                HStack {
                    TextField("Session", text: $model.sessionID)
                    Button("Join") { model.joinSession(id: model.sessionID) }
                }.padding(.horizontal)

                Text("Members: \(model.members.map { $0.id }.joined(separator: ", "))")
                    .font(.caption)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                Text("Assigned node: \(model.assignedNode)")
                    .font(.caption)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)

                List(model.runs) { run in
                    Text("\(run.id) · \(run.status)")
                }.frame(maxHeight: 160)
                List(model.terminalLines, id: \.self) { line in
                    Text(line).font(.system(.caption, design: .monospaced))
                }
                HStack {
                    TextField("Command", text: $model.command)
                    Button("Send") { model.command = "" }
                }.padding(.horizontal)
            }
            .navigationTitle("Reach")
        }
    }
}
