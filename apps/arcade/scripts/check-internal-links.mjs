import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'src/app');

function collectPages(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) collectPages(full, out);
    if (ent.isFile() && ent.name === 'page.tsx') out.push(full);
  }
  return out;
}

const files = collectPages(root);
const routes = new Set(['/']);
for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/').replace('/page.tsx', '');
  const route = rel ? `/${rel}` : '/';
  routes.add(route.replace(/\/$/, '') || '/');
}

const hrefPattern = /href="(\/[^"#?]*)"/g;
const broken = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(hrefPattern)) {
    const href = match[1].replace(/\/$/, '') || '/';
    if (!routes.has(href)) broken.push({ file, href });
  }
}

if (broken.length) {
  console.error('Broken internal links found:');
  for (const item of broken) console.error(`${item.file}: ${item.href}`);
  process.exit(1);
}

console.log(`Checked ${files.length} page files, no broken internal links.`);
