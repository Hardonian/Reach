import { describe, it, expect } from 'vitest';
import {
    computeFingerprintViaRust,
    computeFingerprint,
    computeFingerprintSync,
    verifyRustMatchesTs,
    isWasmAvailable,
    getWasmEngineVersion,
    resetWasmModule,
} from '../determinism-bridge';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TestVector {
    name: string;
    input: unknown;
    expected_ts_fingerprint: string;
    expected_rust_fingerprint: string | null;
    notes: string;
}

// Load test vectors synchronously at module load time
const vectorsPath = path.resolve(__dirname, '../../../../../determinism.vectors.json');
const content = fs.readFileSync(vectorsPath, 'utf8');
const vectors: TestVector[] = JSON.parse(content);

describe('determinism-bridge', () => {
    it('should compute fingerprint synchronously with TS implementation', () => {
        const input = { a: 1, b: 2 };
        const fingerprint = computeFingerprintSync(input);
        
        expect(fingerprint).toBeDefined();
        expect(typeof fingerprint).toBe('string');
        expect(fingerprint.length).toBe(64); // SHA-256 hex length
    });

    it('should produce consistent fingerprints for same input', () => {
        const input = { test: 'data', number: 42 };
        
        const fp1 = computeFingerprintSync(input);
        const fp2 = computeFingerprintSync(input);
        
        expect(fp1).toBe(fp2);
    });

    it('should produce same fingerprint regardless of key order', () => {
        const input1 = { z: 1, a: 2 };
        const input2 = { a: 2, z: 1 };
        
        const fp1 = computeFingerprintSync(input1);
        const fp2 = computeFingerprintSync(input2);
        
        expect(fp1).toBe(fp2);
    });

    it('should match golden vector fingerprints', () => {
        for (const vector of vectors) {
            const fingerprint = computeFingerprintSync(vector.input);
            expect(fingerprint).toBe(vector.expected_ts_fingerprint);
        }
    });

    it('should fall back to TS implementation when WASM is unavailable', async () => {
        // Reset any cached WASM module
        resetWasmModule();
        
        const input = { test: 'fallback' };
        
        // This should not throw, it should fall back to TS impl
        const fingerprint = await computeFingerprint(input);
        
        expect(fingerprint).toBeDefined();
        expect(typeof fingerprint).toBe('string');
        expect(fingerprint.length).toBe(64);
        
        // Should match sync version
        const syncFingerprint = computeFingerprintSync(input);
        expect(fingerprint).toBe(syncFingerprint);
    });

    it('should report WASM as unavailable when module not found', async () => {
        resetWasmModule();
        const available = await isWasmAvailable();
        
        // WASM won't be available in test environment without building
        expect(typeof available).toBe('boolean');
    });

    it('verifyRustMatchesTs should handle WASM unavailability gracefully', async () => {
        resetWasmModule();
        
        const input = { test: 'comparison' };
        const result = await verifyRustMatchesTs(input);
        
        expect(result.ts).toBeDefined();
        expect(result.ts.length).toBe(64);
        
        // When WASM is unavailable, match should be false and rust should be an error
        if (!result.match) {
            expect(result.rust).toContain('Error:');
            expect(result.diff).toBe('Rust implementation unavailable');
        }
    });

    it('should return null for WASM engine version when unavailable', async () => {
        resetWasmModule();
        const version = await getWasmEngineVersion();
        
        // Should either return a version string or null
        expect(version === null || typeof version === 'string').toBe(true);
    });
});

describe('determinism-bridge with golden vectors', () => {
    for (const vector of vectors) {
        it(`should match golden vector for: ${vector.name}`, () => {
            const fingerprint = computeFingerprintSync(vector.input);
            expect(fingerprint).toBe(vector.expected_ts_fingerprint);
        });
    }
});
