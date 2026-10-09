import * as fs from 'fs';
import * as path from 'path';

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'target',
  'crates',
  'services',
  'build',
  'ARTIFACTS',
  '.next',
  '.git',
]);

function walkDir(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (entry.isFile() && /\.(md|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

function collectFiles(): string[] {
  const out: string[] = [];
  walkDir(process.cwd(), out);
  return out;
}

const RULES = [
  {
    name: 'No "click here"',
    pattern: /\[\s*click\s+here\s*\]/gi,
    message: 'Avoid "click here" as link text. Use descriptive labels instead.',
  },
  {
    name: 'No double spaces in titles',
    pattern: /^#+[ \t]+.*[ \t]{2,}.*$/m,
    message: 'Double spaces detected in heading.',
  },
  {
    name: 'Trailing whitespace',
    pattern: /[ \t]+$/m,
    message: 'Trailing whitespace detected.',
  },
  {
    name: 'Empty link text',
    pattern: /\[\]\(.*?\)/g,
    message: 'Empty link text detected.',
  },
];

export async function auditSpelling(fix: boolean = false) {
  console.log('--- Smart Spelling & Markdown Hygiene ---');

  const files = collectFiles();

  let issueCount = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    for (const rule of RULES) {
      const match = content.match(rule.pattern);
      if (match) {
        if (
          fix &&
          (rule.name === 'Trailing whitespace' ||
            rule.name === 'No double spaces in titles')
        ) {
          const original = content;
          if (rule.name === 'Trailing whitespace') {
            content = content.replace(/[ \t]+$/gm, '');
          } else if (rule.name === 'No double spaces in titles') {
            // Fix double spaces within headings only if they are on the same line
            // and don't look like they were merging two structural elements.
            const lines = content.split(/\r?\n/);
            const fixedLines = lines.map((line) => {
              if (line.startsWith('#')) {
                // Only replace multiple spaces that aren't leading or trailing
                return line
                  .trimEnd()
                  .replace(/([^\s])[ \t]{2,}([^\s])/g, '$1 $2');
              }
              return line;
            });
            content = fixedLines.join('\n');
          }
          if (content !== original) {
            modified = true;
            console.log(`[FIXED] ${rule.name} in ${file}`);
          }
        } else {
          console.warn(
            `[HYGIENE] ${rule.name} in ${file}: ${rule.message} (Matched: "${match[0].replace(/\n/g, '\\n')}")`,
          );
          issueCount++;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(file, content);
    }
  }

  if (issueCount === 0) {
    console.log('✅ Markdown hygiene looks clean!');
  } else {
    console.warn(`⚠️ Found ${issueCount} hygiene issues.`);
  }

  return issueCount === 0;
}

if (process.argv[1].endsWith('spelllinks.ts')) {
  auditSpelling(process.argv.includes('--fix')).then((ok) => {
    if (!ok) process.exit(1);
  });
}
