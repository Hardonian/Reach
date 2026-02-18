import XCTest
@testable import ReachSDK

final class ReachSDKTests: XCTestCase {
    func testJSONValueRoundTrip() throws {
        let input = "{\"a\":\"x\",\"b\":true}".data(using: .utf8)!
        let obj = try JSONDecoder().decode([String: JSONValue].self, from: input)
        XCTAssertNotNil(obj["a"])
        XCTAssertNotNil(obj["b"])
    }
}
