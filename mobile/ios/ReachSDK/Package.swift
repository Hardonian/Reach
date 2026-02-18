// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ReachSDK",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "ReachSDK", targets: ["ReachSDK"]),
    ],
    targets: [
        .target(name: "ReachSDK"),
        .testTarget(name: "ReachSDKTests", dependencies: ["ReachSDK"]),
    ]
)
