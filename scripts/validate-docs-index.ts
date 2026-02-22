import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const DOCS_INDEX = path.join(DOCS_DIR, 'README.md');

function validateDocsIndex() {
  if (!fs.existsSync(DOCS_INDEX)) {
    console.error('❌ docs/README.md does not exist');
    process.exit(1);
  }

  const indexContent = fs.readFileSync(DOCS_INDEX, 'utf-8');
  const docFiles = fs.readdirSync(DOCS_DIR)
    .filter(file => file.endsWith('.md') && file !== 'README.md');

  const missingEntries: string[] = [];

  for (const file of docFiles) {
    if (!indexContent.includes(file)) {
      missingEntries.push(file);
    }
  }

  if (missingEntries.length > 0) {
    console.error('❌ Missing documentation entries in docs/README.md:');
    missingEntries.forEach(entry => console.error(`   - ${entry}`));
    process.exit(1);
  }

  console.log('✅ All documentation files are listed in docs/README.md');
}

validateDocsIndex();
