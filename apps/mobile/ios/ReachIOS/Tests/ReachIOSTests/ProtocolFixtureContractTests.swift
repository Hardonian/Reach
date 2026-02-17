import Foundation
import XCTest
@testable import ReachIOS

final class ProtocolFixtureContractTests: XCTestCase {
    func testGoldenFixturesAreParseableAndVersioned() throws {
        let fixtures = ["spawn_event.json", "guardrail_stop.json", "session_started.json", "capsule_sync.json"]
        let root = try locateRepoRoot(from: URL(fileURLWithPath: #filePath))

        for fixture in fixtures {
            let fixtureURL = root.appendingPathComponent("protocol/examples/\(fixture)")
            let data = try Data(contentsOf: fixtureURL)
            let object = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
            XCTAssertEqual(object?["schemaVersion"] as? String, "1.0.0")
            XCTAssertFalse((object?["eventId"] as? String ?? "").isEmpty)
            XCTAssertFalse((object?["type"] as? String ?? "").isEmpty)
            let payload = object?["payload"] as? [String: Any]
            XCTAssertEqual(payload?["schemaVersion"] as? String, "1.0.0")
        }
    }

    private func locateRepoRoot(from filePath: URL) throws -> URL {
        var current = filePath
        for _ in 0..<12 {
            let candidate = current.appendingPathComponent("protocol/examples")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return current
            }
            current.deleteLastPathComponent()
        }
        throw NSError(domain: "ReachIOSTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "repo root not found"])
    }
}
