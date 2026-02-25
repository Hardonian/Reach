import { stableStringify, sha256Hex } from './deterministic';

// Define the shape of the WASM success response
interface WasmSuccess {
    ok: true;
    data: {
        fingerprint: string;
    };
}

// Define the shape of the WASM error response
interface WasmError {
    ok: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

// Type guard for WASM success response
function isWasmSuccess(response: WasmSuccess | WasmError): response is WasmSuccess {
    return response.ok === true;
}

// Attempt to load the WASM module (lazy initialization)
let wasmModule: any | null = null;
let wasmLoading: Promise<void> | null = null;

async function loadWasmModule(): Promise<any> {
    if (wasmModule) {
        return wasmModule;
    }

    if (!wasmLoading) {
        wasmLoading = new Promise((resolve, reject) => {
            // In a real implementation, we would import the WASM module here
            // For now, simulate WASM not being available
            setTimeout(() => {
                reject(new Error('WASM module not available'));
            }, 0);
        });
    }

    try {
        wasmModule = await wasmLoading;
        return wasmModule;
    } catch (error) {
        wasmLoading = null;
        throw error;
    }
}

/**
 * Compute fingerprint using Rust implementation via WASM if available
 * @param preimage JSON-serializable value to fingerprint
 * @returns Promise<string> SHA-256 hex string fingerprint
 */
export async function computeFingerprintViaRust(preimage: unknown): Promise<string> {
    try {
        const module = await loadWasmModule();
        const jsonString = JSON.stringify(preimage);
        const resultJson = module.compute_fingerprint_json(jsonString);
        const result = JSON.parse(resultJson) as WasmSuccess | WasmError;
        
        if (isWasmSuccess(result)) {
            return result.data.fingerprint;
        } else {
            throw new Error(`Rust fingerprint computation failed: ${result.error.code} - ${result.error.message}`);
        }
    } catch (error) {
        throw new Error(`Failed to use Rust fingerprint implementation: ${(error as Error).message}`);
    }
}

/**
 * Verify that Rust and TS implementations produce the same fingerprint for a given preimage
 * @param preimage JSON-serializable value to test
 * @returns Promise<{ match: boolean; ts: string; rust: string; diff?: string }>
 */
export async function verifyRustMatchesTs(preimage: unknown): Promise<{
    match: boolean;
    ts: string;
    rust: string;
    diff?: string;
}> {
    const tsFingerprint = computeFingerprint(preimage);
    
    try {
        const rustFingerprint = await computeFingerprintViaRust(preimage);
        const match = tsFingerprint === rustFingerprint;
        
        return {
            match,
            ts: tsFingerprint,
            rust: rustFingerprint,
            diff: match ? undefined : `TS: ${tsFingerprint}\nRust: ${rustFingerprint}`,
        };
    } catch (error) {
        return {
            match: false,
            ts: tsFingerprint,
            rust: `Error: ${(error as Error).message}`,
            diff: 'Rust implementation unavailable',
        };
    }
}

/**
 * Compute fingerprint using preferred implementation (Rust if available, otherwise TS)
 * @param preimage JSON-serializable value to fingerprint
 * @returns Promise<string> SHA-256 hex string fingerprint
 */
export async function computeFingerprint(preimage: unknown): Promise<string> {
    try {
        return await computeFingerprintViaRust(preimage);
    } catch (error) {
        // Fall back to TypeScript implementation
        return sha256Hex(stableStringify(preimage));
    }
}

/**
 * Synchronous version of computeFingerprint that always uses TypeScript implementation
 * @param preimage JSON-serializable value to fingerprint
 * @returns string SHA-256 hex string fingerprint
 */
export function computeFingerprintSync(preimage: unknown): string {
    return sha256Hex(stableStringify(preimage));
}
