#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const FORBIDDEN_SDK_IMPORTS = ["stripe", "auth0", "@google-cloud", "aws-sdk", "azure-sdk"];
const FORBIDDEN_ENTERPRISE_IMPORTS = ["/enterprise/", "@/lib/enterprise", "packages/enterprise"];
const OSS_PATHS = ["core", "services/runner", "protocol"];

function safeRipgrep(pattern, targetPath) {
  try {
    return execSync(`rg "${pattern}" ${targetPath} --vimgrep`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function validate() {
  console.log("Validating OSS purity (enterprise env absent, no cloud SDK leakage)...");

  let hasError = false;

  for (const ossPath of OSS_PATHS) {
    const fullPath = path.join(process.cwd(), ossPath);
    if (!fs.existsSync(fullPath)) continue;

    for (const sdk of FORBIDDEN_SDK_IMPORTS) {
      const output = safeRipgrep(`import.*${sdk}|require\\(.*${sdk}`, fullPath);
      if (output) {
        console.error(`[PURITY ERROR] Cloud SDK '${sdk}' found in OSS path: ${ossPath}`);
        console.error(output);
        hasError = true;
      }
    }

    for (const enterpriseRef of FORBIDDEN_ENTERPRISE_IMPORTS) {
      const output = safeRipgrep(`${enterpriseRef}`, fullPath);
      if (output) {
        console.error(
          `[PURITY ERROR] Enterprise reference '${enterpriseRef}' found in OSS path: ${ossPath}`,
        );
        console.error(output);
        hasError = true;
      }
    }
  }

  if (hasError) {
    console.error("FAIL: OSS purity check failed.");
    process.exit(1);
  }

  console.log("✓ OSS purity verified.");
}

validate();
