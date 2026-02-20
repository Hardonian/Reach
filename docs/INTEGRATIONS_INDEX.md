# Reach Integrations Index ## Official Integrations

### Frameworks | Integration | Language | Status | Docs |
|-------------|----------|--------|------|
| [Next.js App Router](/integrations/nextjs) | TypeScript | Stable | [README](/integrations/nextjs/README.md) |
| [Express](/integrations/express) | TypeScript | Stable | [README](/integrations/express/README.md) |
| [FastAPI](/integrations/fastapi) | Python | Stable | [README](/integrations/fastapi/README.md) |

### SDKs | SDK | Language | Package | Status |
|-----|----------|---------|--------|
| [TypeScript SDK](/sdk/ts) | TypeScript | `@reach/sdk` | Stable |
| [Python SDK](/sdk/python) | Python | `reach-sdk` | Stable |

## Community Integrations Community integrations are maintained by third parties:

| Integration | Maintainer | Language | Link |
|-------------|------------|----------|------|
| Django | Community | Python | [reach-django](https://github.com/example/reach-django) |
| Laravel | Community | PHP | [reach-laravel](https://github.com/example/reach-laravel) |
| Spring Boot | Community | Java | [reach-spring](https://github.com/example/reach-spring) |

## Integration Patterns ### Webhook Pattern

```
Your App → Reach Server → Webhook → Your App
                ↓
            Event Log
```

Use this when:
- You need async processing
- You want to trigger actions on run completion
- You're building event-driven architectures

### SDK Pattern ```
Your App → SDK → Reach Server
          ↓
      Type Safety
```

Use this when:
- You want type safety
- You're building synchronous workflows
- You need error handling

### API Pattern ```
Your App → HTTP API → Reach Server
```

Use this when:
- You don't want dependencies
- You're using a language without an SDK
- You need maximum flexibility

## Choosing an Integration ### For Web Applications

| Framework | Recommended Integration |
|-----------|------------------------|
| Next.js | `@reach/sdk` + Route Handlers |
| React + Express | `@reach/sdk` + Express middleware |
| Vue + FastAPI | `reach-sdk` + FastAPI routes |
| SvelteKit | `@reach/sdk` + Server routes |

### For Backend Services | Language | Recommended Integration |
|----------|------------------------|
| TypeScript/Node.js | `@reach/sdk` |
| Python | `reach-sdk` |
| Go | Use HTTP API directly |
| Rust | Use HTTP API directly |

### For CI/CD | Platform | Integration Method |
|----------|-------------------|
| GitHub Actions | Docker + `reach doctor` |
| GitLab CI | Docker + `reach doctor` |
| Jenkins | CLI or Docker |
| CircleCI | Docker |

## Integration Examples See the `/examples` directory for complete working examples:

- `examples/ts-basic` - TypeScript SDK basics
- `examples/python-basic` - Python SDK basics
- `examples/nextjs-basic` - Next.js integration
- `examples/express-basic` - Express integration
- `examples/fastapi-basic` - FastAPI integration

## Contributing Integrations To add a new integration:

1. Create a directory under `/integrations`
2. Include a comprehensive README.md
3. Provide working examples
4. Add tests if applicable
5. Submit a PR

See [CONTRIBUTING.md](/CONTRIBUTING.md) for details.
