# Reach Studio Marketplace Submission Pack

This document captures the current submission readiness workflow for distribution channels used by Reach clients.

## 1) Google Play (Android)

### Build + SDK requirements
- Android Gradle wrapper present in `apps/mobile/android/`.
- Required Android SDK components:
  - platform-tools
  - build-tools;35.0.0
  - platforms;android-35
  - cmdline-tools;latest

### Release artifacts
- Build signed AAB:
  - `cd apps/mobile/android`
  - `./gradlew bundleRelease`
- Output path:
  - `apps/mobile/android/app/build/outputs/bundle/release/*.aab`

### Policy + listing checklist
- Data safety form completed using Reach data flow map (no secrets in logs).
- Content rating questionnaire completed.
- App access declarations included (if test account is required).
- Cryptography declaration set to standard TLS + signing only.

## 2) Apple App Store (iOS)

### Build + SDK requirements
- Xcode 16+ and iOS SDK 18+.
- Matching bundle identifier and signing profile configured in App Store Connect.

### Release artifacts
- Archive with Xcode Organizer, export for App Store Connect.
- Upload through Xcode Organizer or Transporter.

### Compliance checklist
- Privacy nutrition labels mapped from Reach telemetry/events.
- Encryption export compliance answered for TLS/signing usage.
- App Review notes include deterministic replay + policy-gate behavior summary.

## 3) Additional channels

### Microsoft Store (Windows)
- Package with MSIX (or PWA packaging if web-first distribution).
- Provide privacy URL, support URL, and deterministic execution disclosure.

### macOS notarized distribution
- Produce signed app bundle.
- Run notarization + staple process before release.

### Linux package registries
- Provide reproducible build metadata.
- Include detached signatures and checksums.

## 4) Shared approval packet (all stores)

Attach the following for every store submission:
- Security model references:
  - `SECURITY.md`
  - `SECURITY_MODEL.md`
  - `PLUGIN_SIGNING.md`
- Determinism + replay references:
  - `RUN_CAPSULES_REPLAY.md`
  - `GRAPH_EXECUTION_SPEC.md`
- Policy and federation references:
  - `FEDERATED_EXECUTION_SPEC.md`
  - `TRUST_NEGOTIATION_SPEC.md`
- Support and escalation:
  - `support/kb_index.json`

## 5) Submission sign-off matrix

Before submitting, verify:
- lint/typecheck/test/build all pass in CI.
- No secrets or API keys committed.
- Policy gate and signature verification paths are enabled by default.
- Public routes degrade gracefully when optional integrations are unavailable.
