const fs = require("fs");

function replaceFile(file, replacer) {
  let content = fs.readFileSync(file, "utf8");
  let newContent = replacer(content);
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log("Fixed", file);
  }
}

// 1. fix observability RedactMode
replaceFile("src/lib/observability.ts", (content) => {
  return content.replace(/loadConfig\(\)\.ZEO_LOG_REDACT/g, "(loadConfig().ZEO_LOG_REDACT as any)");
});

// 2. fix workflow-cli buffers
replaceFile("src/cli/workflow-cli.ts", (content) => {
  let c = content.replace(/hashString\((contents)\)/g, "hashBuffer($1)");
  c = c.replace(
    /import \{ hashString \} from "\.\.\/determinism\/index\.js";/,
    'import { hashString, hashBuffer } from "../determinism/index.js";',
  );

  // ZEO_FIXED_TIME missing fallback
  c = c.replace(
    /return loadConfig\(\)\.ZEO_FIXED_TIME;/g,
    "return loadConfig().ZEO_FIXED_TIME || new Date().toISOString();",
  );
  c = c.replace(
    /Date\.parse\(loadConfig\(\)\.ZEO_FIXED_TIME\)/g,
    "Date.parse(loadConfig().ZEO_FIXED_TIME!)",
  );

  // strict checking boolean error
  c = c.replace(/loadConfig\(\)\.ZEO_STRICT/g, "(loadConfig().ZEO_STRICT ?? true)");
  return c;
});

// 3. fix studio-cli PORT number
replaceFile("src/cli/studio-cli.ts", (content) => {
  return content.replace(
    /PORT:\s*loadConfig\(\)\.PORT\s*\|\|\s*port/g,
    "PORT: String(loadConfig().PORT || port)",
  );
});
