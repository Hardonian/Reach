const fs = require("fs");

const files = [
  "src/cli/workflow-cli.ts",
  "src/cli/render-cli.ts",
  "src/cli/doctor-cli.ts",
  "src/cli/controlplane-cli.ts",
  "src/cli/analyze-pr-cli.ts",
  "src/core/zeolite-core.ts",
  "src/core/shim.ts",
];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, "utf8");
  let original = content;

  // Add the import if needed
  if (!content.includes("hashString") && content.includes("createHash")) {
    if (file.includes("core/")) {
      content = `import { hashString } from "../determinism/index.js";\n` + content;
    } else {
      content = `import { hashString } from "../determinism/index.js";\n` + content;
    }
  }

  // Remove crypto createHash import if it's the only one
  content = content.replace(
    /import\s+\{\s*createHash\s*\}\s*from\s+[\"']node:crypto[\"'];\r?\n/,
    "",
  );
  content = content.replace(
    /import\s+\{\s*createHash,\s*(generateKeyPairSync|randomUUID)\s*\}\s*from\s+[\"']node:crypto[\"'];\r?\n/,
    'import { $1 } from "node:crypto";\n',
  );

  // match single-line with nested parens
  content = content.replace(
    /createHash\([\"'](?:sha256|sha1)[\"']\)\s*\.update\((.*?)\)\s*\.digest\([\"']hex[\"']\)/g,
    "hashString($1)",
  );

  // match multi-line
  content = content.replace(
    /createHash\([\"'](?:sha256|sha1)[\"']\)\s*\n\s*\.update\((.*?)\)\s*\n\s*\.digest\([\"']hex[\"']\)/g,
    "hashString($1)",
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log("Updated", file);
  } else {
    // console.log('No change in', file);
  }
}
