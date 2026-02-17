// swift-tools-version: 5.9
import PackageDescription

let reachVersion = "0.2.0"

let package = Package(
    name: "ReachIOS",
    platforms: [.iOS(.v16)],
    products: [.library(name: "ReachIOS", targets: ["ReachIOS"])],
    targets: [
        .target(name: "ReachIOS"),
        .testTarget(name: "ReachIOSTests", dependencies: ["ReachIOS"])
    ]
)
