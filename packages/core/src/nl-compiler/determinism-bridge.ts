import { stableStringify, sha256Hex } from './deterministic';

// Define the shape of the WASM module
interface WasmModule {
  compute_fingerprint_json(input: string): string;
  evaluate_decision_json(input: string): string;
  get_engine_version(): string;
}

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

// WASM module instance (lazy-loaded)
let wasmModule: WasmModule | null = null;
let wasmLoading: Promise<WasmModule> | null = null;
let wasmLoadError: Error | null = null;

/**
 * Attempt to load the WASM module dynamically
 * Supports both Node.js and browser environments
 */
async function loadWasmModule(): Promise<WasmModule> {
    // Return cached module if already loaded
    if (wasmModule) {
        return wasmModule;
    }

    // Return existing promise if already loading
    if (wasmLoading) {
        return wasmLoading;
    }

    // If we already tried and failed, throw the same error
    if (wasmLoadError) {
        throw wasmLoadError;
    }

    // Start loading the WASM module
    wasmLoading = (async (): Promise<WasmModule> => {
        try {
            let module: WasmModule;

            // Detect environment and load accordingly
            if (typeof window === 'undefined') {
                // Node.js environment
                module = await loadNodeWasm();
            } else {
                // Browser environment
                module = await loadBrowserWasm();
            }

            wasmModule = module;
            return module;
        } catch (error) {
            wasmLoadError = error instanceof Error 
                ? error 
                : new Error(String(error));
            throw wasmLoadError;
        }
    })();

    return wasmLoading;
}

/**
 * Load WASM module in Node.js environment
 */
async function loadNodeWasm(): Promise<WasmModule> {
    // Try multiple possible paths for the WASM module
    const possiblePaths = [
        './pkg/decision_engine.js',
        '../pkg/decision_engine.js',
        '../../pkg/decision_engine.js',
        '../../../pkg/decision_engine.js',
        './decision_engine.js',
    ];

    let lastError: Error | null = null;

    for (const path of possiblePaths) {
        try {
            // Dynamic import for ESM compatibility
            const wasm = await import(path);
            return extractWasmExports(wasm);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            continue;
        }
    }

    // If none of the paths worked, throw a helpful error
    throw new Error(
        `Failed to load WASM module. Searched paths: ${possiblePaths.join(', ')}. ` +
        `Last error: ${lastError?.message}. ` +
        `Ensure the WASM module is built with: wasm-pack build --target nodejs`
    );
}

/**
 * Load WASM module in browser environment
 */
async function loadBrowserWasm(): Promise<WasmModule> {
    // In browser, the WASM module should be served as a static asset
    const wasmUrl = (globalThis as unknown as { WASM_URL?: string }).WASM_URL || '/pkg/decision_engine.js';

    try {
        const wasm = await import(/* @vite-ignore */ wasmUrl);
        return extractWasmExports(wasm);
    } catch (error) {
        throw new Error(
            `Failed to load WASM module from ${wasmUrl}: ${error instanceof Error ? error.message : String(error)}. ` +
            `Ensure the WASM module is built with: wasm-pack build --target web`
        );
    }
}

/**
 * Extract WASM exports from the loaded module
 * Handles different export styles from wasm-pack
 */
function extractWasmExports(wasm: Record<string, unknown>): WasmModule {
    // wasm-pack can produce different export structures depending on target
    // Handle both default export and named exports
    
    const exports = wasm.default || wasm;

    // Extract the functions we need
    const compute_fingerprint_json = (exports.compute_fingerprint_json || wasm.compute_fingerprint_json) as 
        ((input: string) => string) | undefined;
    const evaluate_decision_json = (exports.evaluate_decision_json || wasm.evaluate_decision_json) as 
        ((input: string) => string) | undefined;
    const get_engine_version = (exports.get_engine_version || wasm.get_engine_version) as 
        (() => string) | undefined;

    if (!compute_fingerprint_json) {
        throw new Error(
            'WASM module does not export compute_fingerprint_json. ' +
            'Available exports: ' + Object.keys(exports).join(', ')
        );
    }

    return {
        compute_fingerprint_json: (input: string): string => {
            try {
                return compute_fingerprint_json(input);
            } catch (e) {
                throw new Error(`WASM compute_fingerprint_json failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        },
        evaluate_decision_json: (input: string): string => {
            if (!evaluate_decision_json) {
                throw new Error('evaluate_decision_json not available in WASM module');
            }
            try {
                return evaluate_decision_json(input);
            } catch (e) {
                throw new Error(`WASM evaluate_decision_json failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        },
        get_engine_version: (): string => {
            if (!get_engine_version) {
                return 'unknown';
            }
            try {
                return get_engine_version();
            } catch (e) {
                return 'unknown';
            }
        },
    };
}

/**
 * Compute fingerprint using Rust implementation via WASM if available
 * @param preimage JSON-serializable value to fingerprint
 * @returns Promise<string> SHA-256 hex string fingerprint
 */
export async function computeFingerprintViaRust(preimage: unknown): Promise<string> {
    const module = await loadWasmModule();
    const jsonString = JSON.stringify(preimage);
    const resultJson = module.compute_fingerprint_json(jsonString);
    const result = JSON.parse(resultJson) as WasmSuccess | WasmError;
    
    if (isWasmSuccess(result)) {
        return result.data.fingerprint;
    } else {
        throw new Error(`Rust fingerprint computation failed: ${result.error.code} - ${result.error.message}`);
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
    const tsFingerprint = computeFingerprintSync(preimage);
    
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

/**
 * Check if the WASM module is available and can be loaded
 * @returns Promise<boolean>
 */
export async function isWasmAvailable(): Promise<boolean> {
    try {
        await loadWasmModule();
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the WASM engine version if available
 * @returns Promise<string | null>
 */
export async function getWasmEngineVersion(): Promise<string | null> {
    try {
        const module = await loadWasmModule();
        const result = module.get_engine_version();
        const parsed = JSON.parse(result) as { ok: boolean; data?: { version: string }; error?: { message: string } };
        if (parsed.ok && parsed.data) {
            return parsed.data.version;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Reset the WASM module (useful for testing)
 */
export function resetWasmModule(): void {
    wasmModule = null;
    wasmLoading = null;
    wasmLoadError = null;
}
