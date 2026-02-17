import Foundation
import SwiftUI

public struct RunSummary: Identifiable, Codable {
    public let id: String
    public let status: String
}

public final class ReachViewModel: ObservableObject {
    @Published public var runs: [RunSummary] = []
    @Published public var terminalLines: [String] = []
    @Published public var command: String = ""

    public init() {}

    public func connectSSE(baseURL: URL, runID: String) {
        let endpoint = baseURL.appending(path: "/v1/runs/\(runID)/events")
        let task = URLSession.shared.dataTask(with: endpoint) { data, _, _ in
            guard let data else { return }
            let text = String(decoding: data, as: UTF8.self)
            DispatchQueue.main.async {
                self.terminalLines = text.split(separator: "\n").map(String.init)
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
