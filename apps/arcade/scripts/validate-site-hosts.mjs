#!/usr/bin/env node
import fs from 'node:fs';

const siteConfig = fs.readFileSync('src/lib/site.ts', 'utf8');
const required = ['reach-cli.com', 'ready-layer.com'];
for (const host of required) {
  if (!siteConfig.includes(host)) {
    console.error(`missing host in site config: ${host}`);
    process.exit(1);
  }
}
console.log('site host validation passed');
