# Reach

Deterministic execution fabric for AI systems. Verifiable, replayable, auditable.

## What is Reach?

Reach provides deterministic execution guarantees for AI-driven workflows. In a world where AI agents make autonomous decisions, Reach ensures those decisions are:

- **Verifiable**: Cryptographic proof of what executed and when
- **Replayable**: Identical inputs produce identical outputs, always
- **Auditable**: Complete chain of custody for every execution

## Quick Start

```bash
# Install the CLI
npm install -g @reach/cli

# Or use npx
npx @reach/cli --version

# Verify installation
reach doctor

# Run your first deterministic execution
reach demo
```

## Verify Your Download

All Reach releases include cryptographic signatures and checksums for verification. We use Cosign for keyless signing, ensuring supply chain security.

### Download Checksums

```bash
# Replace VERSION with the release version (e.g., 0.3.1)
VERSION="0.3.1"
curl -fsSL -o SHA256SUMS "https://github.com/reach/reach/releases/download/v${VERSION}/SHA256SUMS"
curl -fsSL -o SHA256SUMS.sig "https://github.com/reach/reach/releases/download/v${VERSION}/SHA256SUMS.sig"
```

### Verify Checksum

```bash
# Verify the checksum file integrity
sha256sum -c SHA256SUMS

# Example output:
# reach-0.3.1-linux-amd64.tar.gz: OK
```

### Verify Cosign Signature

```bash
# Install cosign if needed
cosign install

# Verify the checksum file signature
cosign verify \
  --certificate-identity "https://github.com/reach/reach/.github/workflows/release.yml@refs/tags/v${VERSION}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  SHA256SUMS

# Verify individual artifacts
cosign verify \
  --certificate-identity "https://github.com/reach/reach/.github/workflows/release.yml@refs/tags/v${VERSION}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "reach-${VERSION}-linux-amd64.tar.gz"
```

### Verify SBOM

```bash
# Download and verify SBOM
curl -fsSL -o reach-sbom.cyclonedx.json "https://github.com/reach/reach/releases/download/v${VERSION}/reach-sbom.cyclonedx.json"
curl -fsSL -o reach-sbom.cyclonedx.json.sig "https://github.com/reach/reach/releases/download/v${VERSION}/reach-sbom.cyclonedx.json.sig"

# Verify SBOM signature
cosign verify \
  --certificate-identity "https://github.com/reach/reach/.github/workflows/release.yml@refs/tags/v${VERSION}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  reach-sbom.cyclonedx.json
```

## Documentation

- [Specifications](spec/) - Protocol and implementation specs
- [Whitepapers](docs/whitepapers/) - Technical deep-dives
- [Examples](examples/) - Usage patterns and tutorials
- [API Reference](docs/api/) - Complete API documentation

## Determinism Guarantee

Reach uses canonical fingerprinting across all execution boundaries. Every input, state transition, and output is deterministically hashed, creating an immutable execution trace.

See [DETERMINISM_ROADMAP.md](DETERMINISM_ROADMAP.md) for the complete technical specification.

## Architecture

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Runner     │────▶│   Engine    │
│   (CLI/SDK) │     │ (Execution)  │     │ (Core Logic)│
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Artifact   │
                     │   Store      │
                     └──────────────┘
```

## Development

```bash
# Clone and setup
git clone https://github.com/reach/decision-engine.git
cd decision-engine
npm install

# Run verification
npm run verify

# Run tests
npm test
```

## License

MIT - See [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Note**: This is the open-source core. Enterprise cloud features (SaaS hosting, team collaboration, audit dashboards) are available in [Reach Cloud](https://reach.dev). See our [roadmap](ROADMAP.md) for upcoming features including cloud-hosted runners, advanced analytics, and team governance.
