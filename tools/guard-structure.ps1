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
    ".prettierignore",
    ".npmrc",
    ".nvmrc",
    ".node-version",
    ".dockerignore",
    ".env.example",
    ".editorconfig",
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
    "vercel.json",
    "docker-compose.yml",
    "docker-compose.dev.yml",
    "CHANGELOG.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "GOVERNANCE.md",
    "SECURITY.md",
    "SUPPORT.md",
    "eslint.config.js",
    "cspell.json",
    "determinism.vectors.json",
    "DETERMINISM_ROADMAP.md",
    "WASM_BUILD.md",
    "CLI_COMMAND_MATRIX.md",
    "PRODUCTION_HARDENING_REPORT.md",
    "test-ts-implementation.ts"
)

$AllowedDirs = @(
    "src",
    "services",
    "sdk",
    "tools",
    "test",
    "crates",
    "contracts",
    "node_modules",
    "dist",
    "build",
    "agents",
    "apps",
    "packages",
    "compat",
    "config",
    "data",
    "demo-report",
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
    "policy-packs",
    "presets",
    "prompts",
    "protocol",
    "scripts",
    "spec",
    "support",
    "telemetry",
    "templates",
    "testdata",
    "tests",
    "plans",
    "plugins",
    "web",
    "ARTIFACTS",
    ".git",
    ".github",
    ".vscode",
    ".agent",
    ".artifacts"
)

$script:EntropyFound = $false

Get-ChildItem -Path "." | ForEach-Object {
    $name = $_.Name
    if ($_.PSIsContainer) {
        if ($name -notin $AllowedDirs) {
            Write-Error "Entropy Detected: Unexpected directory found in root: $name"
            $script:EntropyFound = $true
        }
    }
    else {
        if ($name -notin $AllowedFiles) {
            Write-Error "Entropy Detected: Unexpected file found in root: $name"
            $script:EntropyFound = $true
        }
    }
}

if ($script:EntropyFound) {
    Write-Host "`🚨 Structural violation detected. Maintain normalized structure.`" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`✅ Structural integrity maintained.`" -ForegroundColor Green
    exit 0
}
