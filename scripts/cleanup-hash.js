const fs = require('fs');

const files = [
  'src/lib/observability.ts',
  'src/lib/generateViewModel.ts',
  'src/cli/pack-cli.ts',
  'src/cli/replay-cli.ts',
  'src/cli/studio-cli.ts',
  'src/cli/workflow-cli.ts',
  'src/cli/render-cli.ts',
  'src/cli/doctor-cli.ts',
  'src/cli/controlplane-cli.ts',
  'src/cli/analyze-pr-cli.ts'
];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // import substitution
  content = content.replace(
    /import\s+\{\s*createHash\s*\}\s*from\s+[\"']node:crypto[\"'];\r?\n/,
    'import { hashString } from \"../determinism/index.js\";\n'
  );

  content = content.replace(
    /import\s+\{\s*createHash,\s*randomUUID\s*\}\s*from\s+[\"']node:crypto[\"'];\r?\n/,
    'import { randomUUID } from \"node:crypto\";\nimport { hashString } from \"../determinism/index.js\";\n'
  );

  // function substitution
  // createHash("sha256").update(contents).digest("hex")
  content = content.replace(/createHash\([\"']sha1?256?[\"']\)\s*\.update\(([^)]+)\)\s*\.digest\([\"']hex[\"']\)/g, 'hashString($1)');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  } else {
    console.log('No change in', file);
  }
}
