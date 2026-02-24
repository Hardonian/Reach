#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function readJSON(relPath) {
  const fullPath = path.resolve(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function parseRange(range) {
  const normalized = String(range || '').trim();
  const lowerMatch = normalized.match(/>=\s*(\d+)\./);
  const upperMatch = normalized.match(/<\s*(\d+)\./);
  if (!lowerMatch || !upperMatch) {
    throw new Error(`unsupported engine range format: ${normalized}`);
  }
  return { minMajor: Number(lowerMatch[1]), maxExclusiveMajor: Number(upperMatch[1]), raw: normalized };
}

function main() {
  const root = readJSON('package.json');
  const arcade = readJSON('apps/arcade/package.json');

  const rootNode = root.engines && root.engines.node;
  const arcadeNode = arcade.engines && arcade.engines.node;
  if (!rootNode || !arcadeNode) {
    throw new Error('both root and apps/arcade package.json must declare engines.node');
  }

  const rootRange = parseRange(rootNode);
  const arcadeRange = parseRange(arcadeNode);

  const rootContainsArcade = rootRange.minMajor <= arcadeRange.minMajor && rootRange.maxExclusiveMajor >= arcadeRange.maxExclusiveMajor;
  if (!rootContainsArcade) {
    throw new Error(`root engines.node (${rootRange.raw}) must include apps/arcade engines.node (${arcadeRange.raw})`);
  }

  console.log(`node engine compatibility passed: root=${rootRange.raw} app=${arcadeRange.raw}`);
}

try {
  main();
} catch (error) {
  console.error(`node engine compatibility failed: ${error.message}`);
  process.exit(1);
}
