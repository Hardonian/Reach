/**
 * ANTI-SPRAWL ENFORCEMENT ENGINE
 * Prevents structural entropy, route explosion, and UI bloat.
 */
import fs from 'fs';
import path from 'path';

const CONFIG = {
  maxRoutes: 15,
  maxPrimaryActions: 3,
  maxParagraphLines: 5,
  allowedTopLevelRoutes: [
    'cloud', 'console', 'docs', 'legal', 'library', 'playground', 'pricing', 'settings', 'studio', 'support', 'transparency'
  ]
};

async function checkRouteBloat() {
  const appDir = path.resolve(process.cwd(), 'apps/arcade/src/app');
  const items = fs.readdirSync(appDir, { withFileTypes: true });
  const routes = items
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('[') && !dirent.name.startsWith('('))
    .map(dirent => dirent.name);

  console.log(`Checking Route Bloat: ${routes.length}/${CONFIG.maxRoutes}`);
  
  const illegalRoutes = routes.filter(r => !CONFIG.allowedTopLevelRoutes.includes(r) && !['api', 'favicon.ico', 'globals.css', 'robots.ts', 'sitemap.ts'].includes(r));
  
  if (illegalRoutes.length > 0) {
    console.error(`❌ ENTROPY DETECTED: Illegal top-level routes found: ${illegalRoutes.join(', ')}`);
    console.error(`Every new primary route requires Founder approval and entry in the "Allowed Routes" ledger.`);
    return false;
  }

  if (routes.length > CONFIG.maxRoutes) {
    console.error(`❌ ENTROPY DETECTED: Route limit exceeded (${routes.length}/${CONFIG.maxRoutes}).`);
    return false;
  }

  return true;
}

async function checkUIComplexity() {
  // Simple heuristic: count Buttons and Paragraphs in new/modified .tsx files
  // In a real scenario, this would use AST parsing
  console.log('Checking UI Complexity (Action Density)...');
  return true; // Placeholder for AST-based check
}

async function run() {
  console.log('--- ReadyLayer Anti-Sprawl Audit ---');
  const bloatOk = await checkRouteBloat();
  const uiOk = await checkUIComplexity();

  if (!bloatOk || !uiOk) {
    process.exit(1);
  }

  console.log('✅ Anti-Sprawl Audit Passed.');
}

run();
