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

## Documentation

- [Specifications](spec/) - Protocol and implementation specs
- [Whitepapers](docs/whitepapers/) - Technical deep-dives
- [Examples](examples/) - Usage patterns and tutorials
- [API Reference](docs/api/) - Complete API documentation

## Determinism Guarantee

Reach uses canonical fingerprinting across all execution boundaries. Every input, state transition, and output is deterministically hashed, creating an immutable execution trace.

See [DETERMINISM_ROADMAP.md](DETERMINISM_ROADMAP.md) for the complete technical specification.

## Architecture

```
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

**Note**: This is the open-source core. Enterprise features (cloud-hosted runners, advanced analytics, team governance) are available in [Reach Cloud](https://reach.dev).
