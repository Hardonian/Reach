import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const FORBIDDEN_SDK_IMPORTS = ["stripe", "auth0", "@google-cloud", "aws-sdk", "azure-sdk"];

const OSS_PATHS = ["core", "services/runner", "protocol"];

function validate() {
  console.log("Validating OSS Purity (Zero-Cloud Build Lock)...");

  if (process.env.REACH_CLOUD === "1") {
    console.log("Skipping: REACH_CLOUD is set.");
    return;
  }

  let hasError = false;

  for (const ossPath of OSS_PATHS) {
    const fullPath = path.join(process.cwd(), ossPath);
    if (!fs.existsSync(fullPath)) continue;

    for (const sdk of FORBIDDEN_SDK_IMPORTS) {
      try {
        const output = execSync(`rg "import.*${sdk}" ${fullPath} --vimgrep`, {
          encoding: "utf8",
        });
        if (output) {
          console.error(`[PURITY ERROR] Cloud SDK '${sdk}' found in OSS path: ${ossPath}`);
          console.error(output);
          hasError = true;
        }
      } catch (e) {
        // No matches
      }
    }
  }

  if (hasError) {
    console.error("FAIL: OSS purity check failed. Cloud dependencies detected in OSS-only paths.");
    process.exit(1);
  }

  console.log("✓ OSS build purity verified (zero-cloud lock).");
}

validate();
