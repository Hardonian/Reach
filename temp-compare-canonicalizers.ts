#!/usr/bin/env node
import { stableStringify } from './packages/core/src/nl-compiler/deterministic';
import { canonicalJson } from './src/determinism/canonicalJson.js';

const testCases = [
    { a: 1, b: 2 },
    { b: 2, a: 1 },
    { x: 0.1, y: 0.2 },
    { z: 0.30000000000000004 },
    [1, 2, 3],
    { foo: { bar: 'baz', qux: 123 } },
    { null: null, bool: true, str: 'test' },
    {},
    [],
];

console.log('=== Comparing Canonicalization Functions ===');
console.log('StableStringify (nl-compiler) vs CanonicalJson (src/determinism)');
console.log('==============================================');

testCases.forEach((test, i) => {
    const s1 = stableStringify(test);
    const s2 = canonicalJson(test);
    
    if (s1 === s2) {
        console.log(`✅ Test ${i + 1}: Identical output`);
    } else {
        console.log(`❌ Test ${i + 1}: Different outputs`);
        console.log(`   StableStringify: ${s1}`);
        console.log(`   CanonicalJson:   ${s2}`);
    }
});
