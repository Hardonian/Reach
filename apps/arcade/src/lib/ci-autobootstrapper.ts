/**
 * ReadyLayer CI Auto-Bootstrapper
 *
 * CLI command to generate CI workflow:
 * - Repo analyzer (detect language)
 * - Inject correct workflow template
 * - Validate GitHub App wiring
 * - Validate Gate binding
 *
 * @module ci-autobootstrapper
 */

import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, extname } from "path";

// ── Supported Languages ────────────────────────────────────────────────────────

/**
 * Supported programming languages.
 */
export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "ruby"
  | "php"
  | "unknown";

// ── Language Detection ────────────────────────────────────────────────────────

/**
 * Detects the primary language of a repository.
 */
export function detectLanguage(repoPath: string): {
  language: SupportedLanguage;
  confidence: number;
  files: string[];
} {
  const extensions = new Map<string, number>();

  // Count file extensions
  const scanDir = (dir: string): string[] => {
    const files: string[] = [];
    try {
      const entries = require("fs").readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = require("fs").statSync(fullPath);

        if (stat.isDirectory()) {
          if (
            !entry.startsWith(".") &&
            entry !== "node_modules" &&
            entry !== "dist"
          ) {
            files.push(...scanDir(fullPath));
          }
        } else {
          const ext = extname(entry);
          if (ext) {
            files.push(ext);
            extensions.set(ext, (extensions.get(ext) || 0) + 1);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
    return files;
  };

  const files = scanDir(repoPath);

  // Map extensions to languages
  const langMap: Record<string, SupportedLanguage> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
  };

  const langCounts: Record<SupportedLanguage, number> = {
    javascript: 0,
    typescript: 0,
    python: 0,
    go: 0,
    rust: 0,
    java: 0,
    csharp: 0,
    ruby: 0,
    php: 0,
    unknown: 0,
  };

  for (const ext of files) {
    const lang = langMap[ext];
    if (lang) {
      langCounts[lang]++;
    }
  }

  // Find dominant language
  let maxCount = 0;
  let dominantLang: SupportedLanguage = "unknown";

  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantLang = lang as SupportedLanguage;
    }
  }

  const total = files.length;
  const confidence = total > 0 ? maxCount / total : 0;

  return {
    language: dominantLang,
    confidence,
    files,
  };
}

// ── Workflow Templates ────────────────────────────────────────────────────────

/**
 * Workflow template for ReadyLayer Gate integration.
 */
export const WORKFLOW_TEMPLATES: Record<SupportedLanguage, string> = {
  javascript: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  typescript: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  python: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  go: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          cache: true
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  rust: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  java: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  csharp: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0'
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  ruby: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  php: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,

  unknown: `name: ReadyLayer Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  readylayer-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run ReadyLayer Gate
        uses: reach/readylayer-gate-action@v1
        with:
          gate-id: \${{ secrets.READILAYER_GATE_ID }}
          api-key: \${{ secrets.READILAYER_API_KEY }}
        env:
          READILAYER_GATE_ID: \${{ secrets.READILAYER_GATE_ID }}
          READILAYER_API_KEY: \${{ secrets.READILAYER_API_KEY }}
`,
};

// ── Bootstrap Functions ────────────────────────────────────────────────────────

/**
 * Bootstraps CI workflow for a repository.
 */
export function bootstrapCI(
  repoPath: string,
  gateId?: string,
  apiKey?: string,
  options?: { force?: boolean },
): BootstrapResult {
  const result: BootstrapResult = {
    success: false,
    language: "unknown",
    confidence: 0,
    workflow_created: false,
    errors: [],
    warnings: [],
  };

  // Detect language
  const detection = detectLanguage(repoPath);
  result.language = detection.language;
  result.confidence = detection.confidence;

  if (detection.confidence < 0.5) {
    result.warnings.push(
      `Low confidence (${(detection.confidence * 100).toFixed(0)}%) in language detection`,
    );
  }

  // Check if workflow already exists
  const workflowPath = join(
    repoPath,
    ".github",
    "workflows",
    "readylayer-gate.yml",
  );

  if (existsSync(workflowPath) && !options?.force) {
    result.errors.push(
      "Workflow file already exists. Use --force to overwrite.",
    );
    return result;
  }

  // Generate workflow
  const template = WORKFLOW_TEMPLATES[detection.language];

  // Ensure directory exists
  const workflowDir = join(repoPath, ".github", "workflows");
  try {
    require("fs").mkdirSync(workflowDir, { recursive: true });
  } catch (err) {
    result.errors.push(`Failed to create workflow directory: ${err}`);
    return result;
  }

  // Write workflow file
  try {
    let content = template;

    // Replace placeholder values if provided
    if (gateId) {
      content = content.replace(/READILAYER_GATE_ID/g, gateId);
    }
    if (apiKey) {
      content = content.replace(/READILAYER_API_KEY/g, apiKey);
    }

    writeFileSync(workflowPath, content);
    result.workflow_created = true;
  } catch (err) {
    result.errors.push(`Failed to write workflow file: ${err}`);
    return result;
  }

  // Validate GitHub App wiring (placeholder - would need actual GitHub API)
  if (!gateId) {
    result.warnings.push(
      "Gate ID not provided. Add gate-id to workflow or configure via GitHub secrets.",
    );
  }

  // Validate Gate binding (placeholder - would need actual API call)
  if (!apiKey) {
    result.warnings.push(
      "API key not provided. Add api-key to workflow or configure via GitHub secrets.",
    );
  }

  result.success = result.workflow_created;
  return result;
}

export interface BootstrapResult {
  success: boolean;
  language: SupportedLanguage;
  confidence: number;
  workflow_created: boolean;
  errors: string[];
  warnings: string[];
}

// ── Zod Schemas ────────────────────────────────────────────────────────────

export const BootstrapOptionsSchema = z.object({
  repo_path: z.string(),
  gate_id: z.string().optional(),
  api_key: z.string().optional(),
  force: z.boolean().default(false),
});

export const BootstrapResultSchema = z.object({
  success: z.boolean(),
  language: z.enum([
    "javascript",
    "typescript",
    "python",
    "go",
    "rust",
    "java",
    "csharp",
    "ruby",
    "php",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  workflow_created: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// ── CLI Entry Point ────────────────────────────────────────────────────────────

/**
 * CLI command entry point.
 */
export async function runBootstrapCLI(args: string[]): Promise<void> {
  const options = BootstrapOptionsSchema.parse({
    repo_path: args[0] || process.cwd(),
    gate_id: args[1],
    api_key: args[2],
    force: args.includes("--force"),
  });

  console.log("ReadyLayer CI Auto-Bootstrapper");
  console.log("================================\n");

  console.log(`Analyzing repository: ${options.repo_path}`);

  const result = bootstrapCI(
    options.repo_path,
    options.gate_id,
    options.api_key,
    { force: options.force },
  );

  console.log(
    `\nDetected language: ${result.language} (${(result.confidence * 100).toFixed(0)}% confidence)`,
  );

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }

  if (result.success) {
    console.log("\n✓ Workflow file created successfully!");
    console.log(
      `  Location: ${options.repo_path}/.github/workflows/readylayer-gate.yml`,
    );
    console.log("\nNext steps:");
    console.log(
      "  1. Add READILAYER_GATE_ID and READILAYER_API_KEY to GitHub secrets",
    );
    console.log("  2. Commit and push the workflow file");
    console.log("  3. Configure your Gate in the ReadyLayer dashboard");
  }
}
