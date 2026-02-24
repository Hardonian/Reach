# Dependency Risk + SBOM

## Commands executed
- `go list -m all` (module inventory)
- `go test ./...` (baseline integrity)

## Notes
- Full CVE and SBOM generation should be executed in CI using pinned toolchain (`govulncheck`, `osv-scanner`, `syft`) for reproducible reports.
