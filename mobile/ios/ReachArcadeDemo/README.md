# ReachArcadeDemo (minimal harness)

This repository includes a compile-oriented harness directory intended for an Xcode app shell consuming `ReachSDK`.

## Setup

1. Open Xcode and create an iOS App project in this folder named `ReachArcadeDemo`.
2. Add local package dependency: `../ReachSDK`.
3. Set base URL in an `.xcconfig` file:
   - `REACH_BASE_URL = http://localhost:8080`
4. Build and run on iPhone simulator.

The app should expose connect, run safe pack, timeline, and share views using the SDK APIs.
