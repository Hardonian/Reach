import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../..');
const ARCADE_APP_ROOT = path.join(REPO_ROOT, 'apps/arcade/src/app');

function getRoutes(): string[] {
  const routes: string[] = [];
  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (file === 'page.tsx' || file === 'route.ts') {
        let routePath = '/' + path.relative(ARCADE_APP_ROOT, path.dirname(filePath)).replace(/\\/g, '/');
        if (routePath === '/.') routePath = '/';
        // Skip catch-all and dynamic routes for simple smoke test
        if (!routePath.includes('[') && !routePath.includes('(')) {
          routes.push(routePath);
        }
      }
    }
  }
  walk(ARCADE_APP_ROOT);
  return routes;
}

async function runSmokeTests() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  console.log(`--- Docs Route Smoke Test ---`);
  console.log(`Target: ${baseUrl}`);
  
  const routes = getRoutes().filter(r => r.startsWith('/docs') || r === '/faq' || r === '/support' || r === '/pricing');
  console.log(`Testing ${routes.size} documentation routes...`);

  let failures = 0;
  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[OK] ${route}`);
      } else {
        console.error(`[FAIL] ${route} -> Status ${res.status}`);
        failures++;
      }
    } catch (err) {
      console.error(`[ERR] ${route} -> ${err.message}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n❌ Smoke tests failed with ${failures} errors.`);
    process.exit(1);
  } else {
    console.log(`\n✅ All documentation routes are accessible.`);
  }
}

runSmokeTests().catch(err => {
  console.error(err);
  process.exit(1);
});
