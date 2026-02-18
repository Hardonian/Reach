import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct ReachSessionConfig: Sendable {
    public let cookie: String?
    public init(cookie: String? = nil) { self.cookie = cookie }
}

public struct HandshakeSession: Codable, Sendable { public let session_token: String; public let expires_in_seconds: Int; public let node_id: String; public let org_id: String }
public struct PolicyDecision: Codable, Sendable { public let allowed: Bool; public let required_gate: Bool; public let missing_capabilities: [String] }
public struct RunCreateResponse: Codable, Sendable { public let run_id: String }
public struct TimelineEvent: Codable, Sendable { public let id: Int64; public let type: String; public let payload: [String: JSONValue]; public let created_at: String }
public struct RunTimeline: Codable, Sendable { public let run_id: String; public let timeline: [TimelineEvent] }
public struct ShareTokenResponse: Codable, Sendable { public let token: String }

public enum JSONValue: Codable, Sendable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
}

public final class ReachClient {
    private let baseURL: URL
    private let sessionConfig: ReachSessionConfig
    private let session: URLSession

    public init(baseURL: String, sessionConfig: ReachSessionConfig = .init(), session: URLSession = .shared) {
        self.baseURL = URL(string: baseURL)!
        self.sessionConfig = sessionConfig
        self.session = session
    }

    public func handshake(nodeId: String, orgId: String, publicKey: String, signatureProvider: (String) -> String) async throws -> HandshakeSession {
        let challengeResp: [String: String] = try await request(path: "/v1/mobile/handshake/challenge", method: "POST", body: ["node_id": nodeId, "org_id": orgId, "public_key": publicKey])
        let challenge = challengeResp["challenge"] ?? ""
        let signature = signatureProvider(challenge)
        return try await request(path: "/v1/mobile/handshake/complete", method: "POST", body: ["challenge": challenge, "signature": signature])
    }

    public func policyPreflight(pack: [String]) async throws -> PolicyDecision {
        try await request(path: "/v1/mobile/policy/preflight", method: "POST", body: ["capabilities": pack])
    }

    public func runPack(pack: [String], mode: String = "arcadeSafe") async throws -> String {
        let payload: [String: AnyCodable] = ["capabilities": .array(pack.map { .string($0) }), "plan_tier": .string(mode == "arcadeSafe" ? "free" : "pro")]
        let r: RunCreateResponse = try await request(path: "/v1/runs", method: "POST", body: payload)
        return r.run_id
    }

    public func getRun(runId: String) async throws -> RunTimeline { try await request(path: "/v1/mobile/runs/\(runId)", method: "GET", body: Optional<Int>.none as Int?) }
    public func createShareToken(runId: String) async throws -> String {
        let r: ShareTokenResponse = try await request(path: "/v1/mobile/share-tokens", method: "POST", body: ["run_id": runId])
        return r.token
    }
    public func fetchSharedRun(token: String) async throws -> RunTimeline { try await request(path: "/v1/mobile/share/\(token)", method: "GET", body: Optional<Int>.none as Int?) }

    private func request<T: Decodable, B: Encodable>(path: String, method: String, body: B?) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let cookie = sessionConfig.cookie { req.setValue(cookie, forHTTPHeaderField: "Cookie") }
        if let body { req.httpBody = try JSONEncoder().encode(body) }
        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, 200..<300 ~= http.statusCode else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

public enum AnyCodable: Encodable {
    case string(String), array([AnyCodable])
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self { case .string(let s): try c.encode(s); case .array(let a): try c.encode(a) }
    }
}
