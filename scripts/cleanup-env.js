const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = [
  'src/lib/observability.ts',
  'src/core/shim.ts',
  'src/cli/status-cli.ts',
  'src/cli/studio-cli.ts',
  'src/cli/workflow-cli.ts',
  'src/cli/render-cli.ts',
  'src/cli/plugins-cli.ts',
  'src/cli/perf-cli.ts',
  'src/cli/llm-cli.ts',
  'src/cli/doctor-dek-checks.ts',
  'src/cli/doctor-cli.ts',
  'src/cli/controlplane-cli.ts',
];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Add the import if needed
  if (!content.includes('loadConfig') && content.includes('process.env')) {
     const upDirs = file.split('/').length - 2;
     const importPath = '../'.repeat(upDirs) + 'core/env.js';
     content = `import { loadConfig } from "${importPath}";\n` + content;
  }

  // Common replacements
  content = content.replace(/process\.env\.ZEO_LOG_REDACT(?:\s+as\s+RedactMode)?(?:\s*\|\|\s*\"safe\")?/g, 'loadConfig().ZEO_LOG_REDACT');
  content = content.replace(/process\.env\.ZEO_LOG_FORMAT\s*===\s*\"json\"/g, 'loadConfig().ZEO_LOG_FORMAT === "json"');
  content = content.replace(/process\.env\.CI\s*===\s*\"true\"/g, 'loadConfig().CI');

  content = content.replace(/process\.env\.ZEO_FIXED_TIME(!?)(?:\s*\|\|\s*new Date\(\)\.toISOString\(\))?/g, 'loadConfig().ZEO_FIXED_TIME$1');

  content = content.replace(/process\.env\.NODE_ENV/g, 'loadConfig().NODE_ENV');
  content = content.replace(/process\.env\.(?:ZE0|ZEO)_STRICT(?:\s*\|\|\s*\"[0]?[false]?\")?/g, 'loadConfig().ZEO_STRICT');

  content = content.replace(/\{\s*\.\.\.process\.env(?:,\s*PORT\s*:\s*port)?\s*\}/g, '{ ...process.env, PORT: loadConfig().PORT || port }');

  content = content.replace(/process\.env\.ZEO_WORKSPACE_ID\?\.trim\(\)(?:\s*\|\|\s*"default")?/g, 'loadConfig().ZEO_WORKSPACE_ID');

  content = content.replace(/process\.env\.ZEO_SIGNING_HMAC_KEY/g, 'loadConfig().ZEO_SIGNING_HMAC_KEY');
  content = content.replace(/process\.env\.GITHUB_TOKEN/g, 'loadConfig().GITHUB_TOKEN');
  content = content.replace(/process\.env\.SLACK_WEBHOOK_URL/g, 'loadConfig().SLACK_WEBHOOK_URL');
  content = content.replace(/process\.env\.ZEO_PLUGIN_PATH/g, 'loadConfig().ZEO_PLUGIN_PATH');
  content = content.replace(/process\.env\.DEBUG/g, 'loadConfig().DEBUG');

  content = content.replace(/const\s+env\s*=\s*process\.env;/g, 'const env = loadConfig();');

  content = content.replace(/process\.env\.SUPABASE_URL/g, 'loadConfig().SUPABASE_URL');
  content = content.replace(/process\.env\.SUPABASE_SERVICE_KEY/g, 'loadConfig().SUPABASE_SERVICE_KEY');

  content = content.replace(/process\.env\.OPENAI_API_KEY/g, 'loadConfig().OPENAI_API_KEY');
  content = content.replace(/process\.env\.ANTHROPIC_API_KEY/g, 'loadConfig().ANTHROPIC_API_KEY');
  content = content.replace(/process\.env\.OPENROUTER_API_KEY/g, 'loadConfig().OPENROUTER_API_KEY');

  content = content.replace(/process\.env\.ZEO_MODEL(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().ZEO_MODEL');
  content = content.replace(/process\.env\.ZEO_PROVIDER(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().ZEO_PROVIDER');
  content = content.replace(/process\.env\.KEYS_MODEL(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().KEYS_MODEL');
  content = content.replace(/process\.env\.KEYS_PROVIDER(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().KEYS_PROVIDER');
  content = content.replace(/process\.env\.READYLAYER_MODEL(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().READYLAYER_MODEL');
  content = content.replace(/process\.env\.READYLAYER_PROVIDER(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().READYLAYER_PROVIDER');
  content = content.replace(/process\.env\.SETTLER_MODEL(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().SETTLER_MODEL');
  content = content.replace(/process\.env\.SETTLER_PROVIDER(?:\s*\|\|\s*"[^"]+")?/g, 'loadConfig().SETTLER_PROVIDER');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
}
