# Canonical Language Policy

Reach public surfaces must use user-safe terminology. Internal execution terms are restricted to architecture/protocol/internal paths.

Policy source: `config/canonical-language.json`.

## Enforcement

Run:

```bash
npm run validate:language
```

The validator emits file/line evidence and replacement guidance from the `public_terms` map.
