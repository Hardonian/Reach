import Foundation
#if canImport(SwiftUI)
import SwiftUI
#endif

public struct RunSummary: Identifiable, Codable {
    public let id: String
    public let status: String

    public init(id: String, status: String) {
        self.id = id
        self.status = status
    }
}

public struct SessionMember: Identifiable, Codable {
    public let id: String
    public let role: String

    public init(id: String, role: String) {
        self.id = id
        self.role = role
    }
}

#if canImport(SwiftUI)
public struct ReachShellView: View {
    public init() {}

    public var body: some View {
        Text("Reach iOS")
    }
}
#endif
