#!/usr/bin/env node
import { stableStringify, sha256Hex } from './packages/core/src/nl-compiler/deterministic';
import fs from 'node:fs';
import path from 'node:path';

const vectorsPath = path.join(process.cwd(), 'determinism.vectors.json');
const vectors = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

// Compute TS fingerprints for all vectors
for (let i = 0; i < vectors.length; i++) {
    const vector = vectors[i];
    const tsFp = sha256Hex(stableStringify(vector.input));
    vector.expected_ts_fingerprint = tsFp;
    console.log(`Updated ${vector.name}: ${tsFp}`);
}

// Write back to file
fs.writeFileSync(vectorsPath, JSON.stringify(vectors, null, 2));
console.log('All TS fingerprints computed and updated in determinism.vectors.json');
