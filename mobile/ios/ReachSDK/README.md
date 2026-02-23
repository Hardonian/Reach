# ReachSDK (Swift SPM) ## Build

```bash
cd mobile/ios/ReachSDK
swift build
swift test
```

## Use ```swift

let client = ReachClient(baseURL: ProcessInfo.processInfo.environment["REACH_BASE_URL"] ?? "http://localhost:8080")

```

Set `REACH_BASE_URL` for hosted/dev environments.
```
