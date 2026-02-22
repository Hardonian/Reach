# OSS Build Guarantee

Reach is committed to maintaining a pure Open Source Software (OSS) core that can be built and run without any dependence on Reach Cloud, proprietary SDKs, or external billing systems.

## Zero-Cloud Lock

Our CI pipeline enforces a "Zero-Cloud" build lock. Every pull request is verified with the `REACH_CLOUD` environment variable unset to ensure:

1.  **No Leaky Dependencies**: No proprietary SDKs (e.g., Stripe, AWS, Google Cloud) are imported in the OSS path.
2.  **Environment Purity**: The system remains fully functional in local-only mode.
3.  **Auditability**: Users can build Reach from source and verify that it does not contain hidden telemetry or cloud-dependent "phone home" logic.

## Verification

The build purity is verified by `scripts/validate-oss-purity.ts`.
To verify locally:
```bash
npm run validate:oss-purity
```

## Exception Handling
If a feature requires cloud capabilities (e.g., decentralized proof storage), it must be implemented via a stub/adapter pattern where the OSS version uses a local stub.
