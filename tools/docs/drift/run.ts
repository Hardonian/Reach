import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "../../..");
const IS_FIX_MODE = process.argv.includes("--fix");

const SCRIPTS = ["links.ts", "truth.ts", "claims.ts", "spelllinks.ts"];

function runDoctor() {
  console.log("====================================");
  console.log("       REACH DOCS DOCTOR            ");
  console.log("====================================");
  if (IS_FIX_MODE) console.log("MODE: AUTOFIX");
  console.log();

  let totalIssues = 0;
  let failed = false;

  for (const script of SCRIPTS) {
    const scriptPath = path.join(__dirname, script);
    const args = [scriptPath];
    if (IS_FIX_MODE && script !== "claims.ts") {
      args.push("--fix");
    }

    console.log(`Running ${script}...`);
    const result = spawnSync("npx", ["tsx", ...args], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: true,
    });

    if (result.status !== 0) {
      failed = true;
    }
    console.log("------------------------------------");
  }

  if (failed) {
    console.error("\n❌ Documentation drift detected! See reports in .artifacts/docs-drift/");
    process.exit(1);
  } else {
    console.log("\n✅ No documentation drift detected.");
  }
}

runDoctor();
