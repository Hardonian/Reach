/**
 * Rust/WASM Engine Adapter
 * 
 * Provides type-safe integration with the Rust decision engine compiled to WebAssembly.
 * This adapter replaces unsafe type casts with proper interface definitions.
 * 
 * @module engine/adapters/rust
 */

import { ExecRequest, ExecResult } from '../contract';
import { toRustFormat, fromRustFormat } from '../translate';
import { ProcessSemaphore, getSemaphore, deriveSeed, BaseEngineAdapter } from './base';

/**
 * Proper interface matching actual WASM module exports
 * This interface defines the expected API surface of the compiled Rust WASM module.
 * 
 * The Rust engine exposes these functions:
 * - evaluate: Main decision evaluation function
 * - version: Returns the engine version string
 * - validate_input: Validates input parameters
 */
export interface RustWasmModule {
  /**
   * Evaluate a decision request using the Rust engine
   * 
   * @param requestJson - JSON string of the decision request
   * @returns JSON string of the decision result
   */
  evaluate(requestJson: string): string;
  
  /**
   * Get the engine version
   * 
   * @returns Version string (e.g., "0.3.1")
   */
  version(): string;
  
  /**
   * Validate input parameters
   * 
   * @param requestJson - JSON string to validate
   * @returns "true" if valid, "false" otherwise
   */
  validate_input(requestJson: string): string;
  
  /**
   * Get supported algorithms
   * 
   * @returns JSON array of supported algorithm names
   */
  get_algorithms(): string;
  
  /**
   * Memory access (if needed for debugging)
   */
  memory?: WebAssembly.Memory;
}

/**
 * Validation result from the WASM module
 */
export interface WasmValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Runtime validation result for the loaded WASM module
 */
export interface WasmModuleValidation {
  isValid: boolean;
  version?: string;
  algorithms?: string[];
  errors: string[];
}

/**
 * Check if an object has the expected WASM module interface
 * 
 * @param module - The potential WASM module to validate
 * @returns Validation result
 */
export function validateWasmModule(module: unknown): WasmModuleValidation {
  const errors: string[] = [];
  
  // Check if module is an object
  if (module === null || typeof module !== 'object') {
    return {
      isValid: false,
      errors: ['Module is not an object'],
    };
  }
  
  const wasmModule = module as Record<string, unknown>;
  
  // Validate required functions
  const requiredFunctions = ['evaluate', 'version', 'validate_input', 'get_algorithms'];
  
  for (const func of requiredFunctions) {
    if (typeof wasmModule[func] !== 'function') {
      errors.push(`Missing required function: ${func}`);
    }
  }
  
  // If there are missing functions, the module is invalid
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }
  
  // Try to get version if available
  let version: string | undefined;
  let algorithms: string[] | undefined;
  
  try {
    if (typeof wasmModule.version === 'function') {
      const versionResult = (wasmModule.version as () => string)();
      version = versionResult;
    }
  } catch (e) {
    // Version call failed, that's okay
  }
  
  try {
    if (typeof wasmModule.get_algorithms === 'function') {
      const algResult = (wasmModule.get_algorithms as () => string)();
      algorithms = JSON.parse(algResult);
    }
  } catch (e) {
    // Algorithms call failed, that's okay
  }
  
  return {
    isValid: true,
    version,
    algorithms,
    errors: [],
  };
}

/**
 * Safely load and validate a WASM module
 * 
 * @param wasmPath - Path to the WASM file
 * @returns Promise resolving to the validated WASM module
 * @throws Error if module validation fails
 */
export async function loadWasmModule(wasmPath: string): Promise<RustWasmModule> {
  // Dynamic import of WASM
  const wasm = await import(wasmPath);
  
  // Initialize the WASM module if needed
  let module: unknown = wasm;
  
  // Handle different WASM loading patterns
  if (wasm.default) {
    // Some WASM modules are exported as default
    module = wasm.default;
  }
  
  // Validate the module
  const validation = validateWasmModule(module);
  
  if (!validation.isValid) {
    throw new Error(
      `WASM module validation failed: ${validation.errors.join(', ')}`
    );
  }
  
  return module as RustWasmModule;
}

/**
 * Create a Rust engine adapter with proper type safety
 * Now extends BaseEngineAdapter for semaphore and seed support
 */
export class RustEngineAdapter extends BaseEngineAdapter {
  private wasmModule: RustWasmModule | null = null;
  private isLoaded = false;
  private loadError: Error | null = null;
  
  constructor() {
    super(); // Initialize base class with semaphore
  }
  
  /**
   * Initialize the WASM module
   * 
   * @param wasmPath - Optional custom path to WASM file
   */
  async initialize(wasmPath: string = '../pkg/decision_engine_rs.js'): Promise<void> {
    try {
      this.wasmModule = await loadWasmModule(wasmPath);
      this.isLoaded = true;
      this.loadError = null;
    } catch (error) {
      this.isLoaded = false;
      this.loadError = error instanceof Error ? error : new Error(String(error));
      throw this.loadError;
    }
  }
  
  /**
   * Check if the engine is ready
   */
  isReady(): boolean {
    return this.isLoaded && this.wasmModule !== null;
  }
  
  /**
   * Get the engine version
   */
  getVersion(): string | null {
    if (!this.wasmModule) {
      return null;
    }
    try {
      return this.wasmModule.version();
    } catch {
      return null;
    }
  }
  
  /**
   * Validate input before sending to WASM
   */
  validateInput(request: ExecRequest): WasmValidationResult {
    if (!this.wasmModule) {
      return {
        valid: false,
        errors: ['WASM module not loaded'],
      };
    }
    
    try {
      const requestJson = toRustFormat(request);
      const result = this.wasmModule.validate_input(requestJson);
      const isValid = result === 'true';
      
      return {
        valid: isValid,
        errors: isValid ? undefined : ['Validation failed by WASM module'],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
  
  /**
   * Evaluate a decision request
   * Uses semaphore to limit concurrent executions and seed for determinism
   * 
   * @param request - The execution request
   * @returns The execution result
   */
  async evaluate(request: ExecRequest): Promise<ExecResult> {
    // Use semaphore protection and ensure seed is derived
    return this.executeWithSemaphore(request, async (req) => {
      return this.doEvaluate(req);
    });
  }
  
  /**
   * Internal evaluation logic (called within semaphore)
   */
  private async doEvaluate(request: ExecRequest): Promise<ExecResult> {
    if (!this.wasmModule) {
      throw new Error('WASM module not loaded. Call initialize() first.');
    }
    
    // Validate input first
    const validation = this.validateInput(request);
    if (!validation.valid) {
      throw new Error(`Input validation failed: ${validation.errors?.join(', ')}`);
    }
    
    // Convert request to Rust format
    const requestJson = toRustFormat(request);
    
    // Call WASM evaluate function
    const startTime = performance.now();
    const resultJson = this.wasmModule.evaluate(requestJson);
    const durationMs = Math.round(performance.now() - startTime);
    
    // Parse result
    const result = fromRustFormat(resultJson, request.requestId, durationMs);
    
    return result;
  }
  
  /**
   * Get the last load error if any
   */
  getLoadError(): Error | null {
    return this.loadError;
  }
}

/**
 * Singleton instance of the Rust engine adapter
 */
let rustEngineInstance: RustEngineAdapter | undefined;

/**
 * Get or create the singleton Rust engine adapter
 */
export function getRustEngine(): RustEngineAdapter {
  if (!rustEngineInstance) {
    rustEngineInstance = new RustEngineAdapter();
  }
  return rustEngineInstance;
}

/**
 * Initialize the Rust engine with proper error handling
 */
export async function initRustEngine(wasmPath?: string): Promise<RustEngineAdapter> {
  const engine = getRustEngine();
  await engine.initialize(wasmPath);
  return engine;
}

/**
 * Safely evaluate a decision using the Rust engine
 * Returns null if engine is not available
 */
export async function evaluateWithRust(
  request: ExecRequest,
  wasmPath?: string,
): Promise<ExecResult | null> {
  try {
    const engine = getRustEngine();
    
    if (!engine.isReady()) {
      await engine.initialize(wasmPath);
    }
    
    return await engine.evaluate(request);
  } catch (error) {
    console.error('Rust engine evaluation failed:', error);
    return null;
  }
}
