/**
 * validate-simplicity.ts
 *
 * CI-enforced "Simplicity DNA" scanner for the ReadyLayer presentation layer.
 *
 * Scans for:
 *  1. Banned jargon terms (configurable list)
 *  2. Paragraphs > 2 sentences (heuristic)
 *  3. Missing primary CTA on the homepage
 *  4. Empty states without a visible action
 *
 * Modes:
 *  - Advisory (default): prints report, exits 0
 *  - Enforce: AGENTS_ENFORCE=1 → exits 1 on violations
 *
 * Usage:
 *   npx tsx scripts/validate-simplicity.ts
 *   AGENTS_ENFORCE=1 npx tsx scripts/validate-simplicity.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname_compat = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname_compat, '..');
const ENFORCE = process.env.AGENTS_ENFORCE === '1';

// ── Configuration ────────────────────────────────────────────────────────────

const PRESENTATION_PATHS = [
  'apps/arcade/src/app/page.tsx',
  'apps/arcade/src/app/playground/page.tsx',
  'apps/arcade/src/app/dashboard/page.tsx',
  'apps/arcade/src/app/templates/page.tsx',
  'apps/arcade/src/app/docs/quick-start/page.tsx',
  'apps/arcade/src/components/NavBar.tsx',
  'apps/arcade/src/components/Footer.tsx',
  'apps/arcade/src/components/HomepageClient.tsx',
  'apps/arcade/src/lib/copy/index.ts',
];

/**
 * Jargon terms that should NOT appear in user-facing copy.
 * Each entry: [banned_term, preferred_replacement]
 */
const BANNED_JARGON: [RegExp, string][] = [
  [/\bdeterministic pipeline\b/i, 'Use: "Same input, same result"'],
  [/\borchestration infrastructure\b/i, 'Use: "platform" or specific feature name'],
  [/\bglobal edge network\b/i, 'Use: "platform" or omit'],
  [/\brun artifacts\b/i, 'Use: "reports"'],
  [/\brun capsule\b/i, 'Use: "saved check"'],
  [/\btrace explorer\b/i, 'Use: "step-by-step log" or "trace"'],
  [/\badversarial safety monitor\b/i, 'Use: "safety checks"'],
  [/\bbackpressure\b/i, 'Avoid in UI copy — technical internal term'],
  [/\btelemetry rollup\b/i, 'Use: "usage summary"'],
  [/\bfederat(ed|ion)\b/i, 'Avoid in user-facing copy — too technical'],
  [/\bentitlement\b/i, 'Use: "plan limits" or "what you can do"'],
  [/\borganic compound\b/i, 'N/A'],
  [/\bspawn depth\b/i, 'Avoid in UI copy'],
];

/**
 * Heuristic: count sentences in a text block.
 * A sentence ends with . ! ? followed by a space or end-of-string.
 */
function countSentences(text: string): number {
  const matches = text.match(/[.!?](\s|$)/g);
  return matches ? matches.length : 0;
}

/**
 * Extract JSX string literals from a TSX file (very approximate).
 * This catches most user-visible strings without a full AST parser.
 */
function extractTextBlocks(content: string): { text: string; lineNum: number }[] {
  const lines = content.split('\n');
  const blocks: { text: string; lineNum: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip code lines (imports, JSX attributes except text content, etc.)
    if (
      line.trim().startsWith('import ') ||
      line.trim().startsWith('//') ||
      line.trim().startsWith('*') ||
      line.trim().startsWith('export ') ||
      line.trim().startsWith('const ') ||
      line.trim().startsWith('function ') ||
      /^\s*<\w/.test(line) // JSX opening tags
    ) continue;

    // Look for string content in JSX text nodes and string literals
    const textMatch = line.match(/>\s*([A-Z][^<{]{20,})\s*</) ??
                      line.match(/["']([A-Z][^"']{20,})["']/);
    if (textMatch) {
      blocks.push({ text: textMatch[1].trim(), lineNum: i + 1 });
    }
  }

  return blocks;
}

// ── Violation types ───────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

const violations: Violation[] = [];

// ── Rule 1: Banned jargon ─────────────────────────────────────────────────────

function checkBannedJargon(filePath: string, content: string): void {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [pattern, suggestion] of BANNED_JARGON) {
      if (pattern.test(lines[i])) {
        violations.push({
          file: path.relative(REPO_ROOT, filePath),
          line: i + 1,
          rule: `Banned jargon. ${suggestion}`,
          text: lines[i].trim(),
        });
      }
    }
  }
}

// ── Rule 2: Paragraphs > 2 sentences ─────────────────────────────────────────

function checkLongParagraphs(filePath: string, content: string): void {
  const blocks = extractTextBlocks(content);
  for (const block of blocks) {
    if (countSentences(block.text) > 2) {
      violations.push({
        file: path.relative(REPO_ROOT, filePath),
        line: block.lineNum,
        rule: 'Paragraph exceeds 2 sentences. Break it up or cut.',
        text: block.text.slice(0, 100) + (block.text.length > 100 ? '…' : ''),
      });
    }
  }
}

// ── Rule 3: Homepage must have primary CTA ─────────────────────────────────────

function checkHomepageCTA(filePath: string, content: string): void {
  if (!filePath.endsWith('apps/arcade/src/app/page.tsx')) return;
  const hasPrimaryCTA =
    content.includes('btn-primary') &&
    (content.includes('PLAYGROUND') || content.includes('/playground') || content.includes('Run a demo'));
  if (!hasPrimaryCTA) {
    violations.push({
      file: path.relative(REPO_ROOT, filePath),
      line: 1,
      rule: 'Homepage is missing a primary CTA linking to /playground.',
      text: '(homepage level check)',
    });
  }
}

// ── Rule 4: Empty states must have an action ──────────────────────────────────

function checkEmptyStates(filePath: string, content: string): void {
  // Heuristic: look for "empty" / "no results" / "nothing here" without a button/link nearby
  const emptyPatterns = [
    /no\s+results/i,
    /nothing\s+here/i,
    /no\s+data\s+yet/i,
    /empty\s+state/i,
    /no\s+items\s+found/i,
  ];

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of emptyPatterns) {
      if (pattern.test(lines[i])) {
        // Check if btn-primary or a href appears within 5 lines
        const surrounding = lines.slice(Math.max(0, i - 3), i + 5).join('\n');
        if (!surrounding.includes('btn-primary') && !surrounding.includes('href=')) {
          violations.push({
            file: path.relative(REPO_ROOT, filePath),
            line: i + 1,
            rule: 'Empty state lacks a primary action (btn-primary or link). Add one.',
            text: lines[i].trim(),
          });
        }
      }
    }
  }
}

// ── Scanner ───────────────────────────────────────────────────────────────────

function scanFile(relPath: string): void {
  const absPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.warn(`  SKIP (not found): ${relPath}`);
    return;
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  checkBannedJargon(absPath, content);
  checkLongParagraphs(absPath, content);
  checkHomepageCTA(absPath, content);
  checkEmptyStates(absPath, content);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('\nvalidate:simplicity — ReadyLayer Simplicity DNA Scanner');
console.log(`Mode: ${ENFORCE ? 'ENFORCE (AGENTS_ENFORCE=1)' : 'advisory'}`);
console.log(`Scanning ${PRESENTATION_PATHS.length} files…\n`);

for (const p of PRESENTATION_PATHS) {
  scanFile(p);
}

if (violations.length === 0) {
  console.log(`✅ PASS: No simplicity violations found in ${PRESENTATION_PATHS.length} scanned files.\n`);
  process.exit(0);
} else {
  const sevCount = violations.length;
  console.warn(`⚠ Found ${sevCount} simplicity violation${sevCount === 1 ? '' : 's'}:\n`);
  for (const v of violations) {
    console.warn(`  ${v.file}:${v.line}`);
    console.warn(`  Rule: ${v.rule}`);
    console.warn(`  Text: ${v.text}`);
    console.warn('');
  }

  if (ENFORCE) {
    console.error('FAIL: Enforce mode active. Fix violations before merging.');
    process.exit(1);
  } else {
    console.log('Advisory mode: violations reported but not blocking. Set AGENTS_ENFORCE=1 to block.\n');
    process.exit(0);
  }
}
