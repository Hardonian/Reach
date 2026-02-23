import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..");

const REQUIRED_ROOT_FILES = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  "CHANGELOG.md",
];

const REQUIRED_SCRIPTS = ["lint", "typecheck", "test", "build"];

function checkRepoHealth() {
  let failed = false;

  console.log("--- Checking Root Files ---");
  for (const file of REQUIRED_ROOT_FILES) {
    if (!fs.existsSync(path.join(REPO_ROOT, file))) {
      console.error(`❌ Missing required file: ${file}`);
      failed = true;
    } else {
      console.log(`✅ ${file} exists`);
    }
  }

  console.log("\n--- Checking Package Scripts ---");
  const pkgPath = path.join(REPO_ROOT, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error("❌ Missing package.json");
    failed = true;
  } else {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    for (const script of REQUIRED_SCRIPTS) {
      if (!pkg.scripts || !pkg.scripts[script]) {
        console.error(`❌ Missing package script: ${script}`);
        failed = true;
      } else {
        console.log(`✅ script: ${script} exists`);
      }
    }
  }

  console.log("\n--- Checking Config Consistency ---");
  const rootFiles = fs.readdirSync(REPO_ROOT);
  const eslintConfigs = rootFiles.filter(
    (f) => f.startsWith(".eslintrc") || f.startsWith("eslint.config"),
  );
  if (eslintConfigs.length > 1) {
    console.error(
      `❌ Multiple ESLint configs detected: ${eslintConfigs.join(", ")}`,
    );
    failed = true;
  } else if (eslintConfigs.length === 0) {
    console.warn(
      "⚠️ No ESLint config detected in root (ignoring if intentional)",
    );
  } else {
    console.log(`✅ Single ESLint config: ${eslintConfigs[0]}`);
  }

  if (failed) {
    process.exit(1);
  }
}

checkRepoHealth();
