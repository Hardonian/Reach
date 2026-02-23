# Reach Structural Integrity Guard
# Maintains current baseline and prevents further root-level entropy

$AllowedFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "tsconfig.exports.json",
    "tsconfig.tsbuildinfo",
    "tsconfig.build.tsbuildinfo",
    "vitest.config.ts",
    "README.md",
    "Dockerfile",
    "Dockerfile.dev",
    ".gitignore",
    ".dockerignore",
    ".env.example",
    "go.mod",
    "go.sum",
    "go.work",
    "go.work.sum",
    "Cargo.toml",
    "rust-toolchain.toml",
    "LICENSE",
    "NOTICE",
    "VERSION",
    "Makefile",
    "reach",
    "reachctl.exe",
    "reach-policy.txt",
    "reach-to-readylayer.patch",
    "vercel.json",
    "docker-compose.yml",
    "docker-compose.dev.yml",
    "tsc_errors.txt",
    "tsc_errors_2.txt",
    "tsc_errors_3.txt",
    "tsc_errors_final.txt",
    "tsc_errors_normalized.txt",
    "tsc_errors_final.txt",
    "ADAPTIVE_ENGINE_SPEC.md",
    "AGENTS.md",
    "ARCHITECTURE.md",
    "ARCHITECTURAL_FINDINGS.md",
    "AUDIT_REPORT.md",
    "AUTOPACK_SPEC.md",
    "CAPABILITY_REGISTRY.md",
    "CAPABILITY_SYSTEM.md",
    "CHANGELOG.md",
    "CLOUD_ADAPTER_MODEL.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "DOCS_DRIFT_GUARD.md",
    "EXECUTION_PACK_SPEC.md",
    "EXECUTION_PROTOCOL.md",
    "FEDERATED_EXECUTION_SPEC.md",
    "GAP_LIST.md",
    "GOVERNANCE.md",
    "GRAPH_EXECUTION_SPEC.md",
    "IMPORT_RULES.md",
    "KIP.md",
    "MOBILE_MILESTONE_SUMMARY.md",
    "MODEL_ROUTING_SPEC.md",
    "MODEL_SPEC.md",
    "OSS_BUILD_GUARANTEE.md",
    "PLUGIN_SIGNING.md",
    "READY_LAYER_STRATEGY.md",
    "RELEASE.md",
    "RUN_CAPSULES_REPLAY.md",
    "SECURITY.md",
    "SECURITY_HARDENING_REPORT.md",
    "SECURITY_MODEL.md",
    "SKILLS.md",
    "SPEC_FORMALIZATION_SUMMARY.md",
    "SUPPORT.md",
    "TRUST_NEGOTIATION_SPEC.md"
)

$AllowedDirs = @(
    ".git",
    ".github",
    ".vscode",
    ".gemini",
    ".agent",
    ".artifacts",
    ".kilocode",
    "src",
    "services",
    "sdk",
    "tools",
    "test",
    "crates",
    "contracts",
    "node_modules",
    "dist",
    "agents",
    "apps",
    "compat",
    "config",
    "data",
    "design",
    "docker",
    "docs",
    "examples",
    "extensions",
    "fixtures",
    "integrations",
    "internal",
    "logs",
    "mobile",
    "openapi",
    "pack-devkit",
    "packs",
    "policies",
    "prompts",
    "protocol",
    "scripts",
    "spec",
    "stitch_exports",
    "support",
    "telemetry",
    "templates",
    "testdata",
    "tests",
    "plans",
    "plugins",
    "ARTIFACTS"
)

$EntropyFound = $false

Get-ChildItem -Path "." | ForEach-Object {
    $name = $_.Name
    if ($_.PSIsContainer) {
        if ($name -notin $AllowedDirs) {
            Write-Error "Entropy Detected: Unexpected directory found in root: $name"
            $EntropyFound = $true
        }
    }
    else {
        if ($name -notin $AllowedFiles) {
            Write-Error "Entropy Detected: Unexpected file found in root: $name"
            $EntropyFound = $true
        }
    }
}

if ($EntropyFound) {
    Write-Host "`🚨 Structural violation detected. Maintain normalized structure.`" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`✅ Structural integrity maintained.`" -ForegroundColor Green
    exit 0
}
