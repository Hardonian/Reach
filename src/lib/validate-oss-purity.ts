import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const RUNNER_ROOT = path.join(ROOT, "services", "runner");

// These packages must NEVER appear in the OSS runner build path
const TOXIC_IMPORTS = [
  "github.com/aws/aws-sdk-go",
  "cloud.google.com/go",
  "github.com/Azure/azure-sdk-for-go",
  "github.com/stripe/stripe-go",
  "github.com/auth0/go-auth0",
];

// Exceptions: Adapters explicitly designed for cloud injection
const ALLOWED_PATHS = ["services/runner/internal/adapters/cloud"];

function walk(dir: string, callback: (file: string) => void) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walk(filepath, callback);
    } else if (stats.isFile() && file.endsWith(".go")) {
      callback(filepath);
    }
  }
}

let errors = 0;

walk(RUNNER_ROOT, (file) => {
  const relPath = path.relative(ROOT, file).replace(/\\/g, "/");

  // Skip allowed paths
  if (ALLOWED_PATHS.some((allowed) => relPath.includes(allowed))) return;

  const content = fs.readFileSync(file, "utf-8");

  for (const toxic of TOXIC_IMPORTS) {
    if (content.includes(`"${toxic}`)) {
      console.error(`[PURITY VIOLATION] ${relPath}`);
      console.error(`  Imported Cloud SDK: ${toxic}`);
      console.error(
        `  Remediation: Use an interface in internal/adapters and inject implementation at runtime.`,
      );
      errors++;
    }
  }
});

if (errors > 0) {
  console.error(`\nFound ${errors} OSS purity violations.`);
  process.exit(1);
}
console.log("✅ OSS purity verified. No cloud SDKs in core paths.");
