/**
 * Reach Engine Abstraction Layer
 * 
 * Provides a unified interface for multiple execution engines:
 * - Requiem (C++) - Primary engine
 * - Rust (WASM/TS) - Fallback engine
 * - Dual-Run - Safety comparison mode
 * 
 * @module engine
 */

// Export contracts and types
export * from './contract';
export * from './config';

// Export errors
export * from './errors';

// Export translation utilities
export * from './translate';

// Export adapters
export { EngineAdapter, DualRunAdapter, DaemonAdapter, BaseEngineAdapter } from './adapters/base';
export { RustEngineAdapter, createRustAdapter } from './adapters/rust';
export { RequiemEngineAdapter, createRequiemAdapter } from './adapters/requiem';
export { DualRunEngineAdapter, createDualAdapter, createCustomDualAdapter } from './adapters/dual';

// ============================================================================
// Engine Factory
// ============================================================================

import {
  EngineAdapter,
  EngineConfig,
  EngineType,
  DEFAULT_ENGINE_CONFIG,
  EngineHealth,
} from './contract';
import { createRustAdapter } from './adapters/rust';
import { createRequiemAdapter } from './adapters/requiem';
import { createDualAdapter } from './adapters/dual';

/**
 * Configuration for engine factory
 */
export interface FactoryConfig {
  /** Engine type to use */
  engine?: EngineType | string;
  /** Path to Requiem binary */
  requiemBin?: string;
  /** Enable daemon mode */
  daemonEnabled?: boolean;
  /** Auto-start daemon */
  daemonAutoStart?: boolean;
  /** Enable auto-fallback */
  autoFallback?: boolean;
  /** Dual-run sample rate (0-1) */
  dualSampleRate?: number;
  /** Fail on dual-run mismatch */
  dualFailOnMismatch?: boolean;
}

/**
 * Global engine instance cache
 */
let engineInstance: EngineAdapter | null = null;
let engineConfig: EngineConfig | null = null;

/**
 * Create an engine adapter based on configuration
 */
export function createEngine(config?: FactoryConfig): EngineAdapter {
  const engineType = resolveEngineType(config?.engine);
  
  const engineConfig: EngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    defaultEngine: engineType,
    autoFallback: config?.autoFallback ?? DEFAULT_ENGINE_CONFIG.autoFallback,
    dualSampleRate: config?.dualSampleRate ?? DEFAULT_ENGINE_CONFIG.dualSampleRate,
    dualFailOnMismatch: config?.dualFailOnMismatch ?? DEFAULT_ENGINE_CONFIG.dualFailOnMismatch,
    requiemBin: config?.requiemBin,
    daemon: {
      enabled: config?.daemonEnabled ?? false,
      autoStart: config?.daemonAutoStart ?? false,
    },
    timeouts: DEFAULT_ENGINE_CONFIG.timeouts,
    rollback: DEFAULT_ENGINE_CONFIG.rollback,
  };
  
  switch (engineType) {
    case 'requiem':
      return createRequiemAdapter(engineConfig);
      
    case 'rust':
      return createRustAdapter();
      
    case 'dual':
      return createDualAdapter(engineConfig);
      
    default:
      // Default to Requiem with fallback
      return createRequiemAdapter(engineConfig);
  }
}

/**
 * Get or create singleton engine instance
 */
export async function getEngine(config?: FactoryConfig): Promise<EngineAdapter> {
  if (!engineInstance) {
    engineInstance = createEngine(config);
    
    if (engineInstance.initialize) {
      await engineInstance.initialize();
    }
  }
  
  return engineInstance;
}

/**
 * Reset the singleton engine instance
 */
export async function resetEngine(): Promise<void> {
  if (engineInstance?.shutdown) {
    await engineInstance.shutdown();
  }
  
  engineInstance = null;
  engineConfig = null;
}

/**
 * Resolve engine type from string
 */
function resolveEngineType(type?: string): EngineType {
  if (!type) {
    // Check environment variable
    const envEngine = process.env.REACH_ENGINE;
    if (envEngine) {
      return normalizeEngineType(envEngine);
    }
    
    // Check for force rollback
    if (process.env.REACH_ENGINE_FORCE_RUST) {
      console.warn('[Engine] REACH_ENGINE_FORCE_RUST set - using Rust engine');
      return 'rust';
    }
    
    // Default to Requiem
    return 'requiem';
  }
  
  return normalizeEngineType(type);
}

/**
 * Normalize engine type string
 */
function normalizeEngineType(type: string): EngineType {
  const normalized = type.toLowerCase().trim();
  
  switch (normalized) {
    case 'requiem':
    case 'cpp':
    case 'c++':
      return 'requiem';
      
    case 'rust':
    case 'wasm':
    case 'ts':
    case 'typescript':
      return 'rust';
      
    case 'dual':
    case 'compare':
    case 'both':
      return 'dual';
      
    default:
      console.warn(`[Engine] Unknown engine type "${type}", defaulting to requiem`);
      return 'requiem';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Execute a decision with the configured engine
 */
export async function executeWithEngine(
  request: import('./contract').ExecRequest,
  config?: FactoryConfig,
): Promise<import('./contract').ExecResult> {
  const engine = await getEngine(config);
  return engine.execute(request);
}

/**
 * Check engine health
 */
export async function checkEngineHealth(config?: FactoryConfig): Promise<EngineHealth> {
  const engine = await getEngine(config);
  return engine.health();
}

/**
 * Get current engine information
 */
export async function getEngineInfo(config?: FactoryConfig): Promise<{
  type: EngineType;
  version: string;
  health: EngineHealth;
}> {
  const engine = await getEngine(config);
  const [version, health] = await Promise.all([
    engine.version(),
    engine.health(),
  ]);
  
  return {
    type: engine.engineType as EngineType,
    version,
    health,
  };
}

// ============================================================================
// CLI Integration
// ============================================================================

/**
 * Parse engine flags from CLI arguments
 */
export function parseEngineFlags(args: string[]): FactoryConfig {
  const config: FactoryConfig = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    switch (arg) {
      case '--engine':
        if (next) {
          config.engine = next;
          i++;
        }
        break;
        
      case '--requiem-bin':
        if (next) {
          config.requiemBin = next;
          i++;
        }
        break;
        
      case '--dual':
      case '--dual-run':
        config.engine = 'dual';
        break;
        
      case '--dual-sample-rate':
        if (next) {
          config.dualSampleRate = parseFloat(next);
          i++;
        }
        break;
        
      case '--no-fallback':
        config.autoFallback = false;
        break;
    }
  }
  
  return config;
}

/**
 * Print engine status for CLI
 */
export async function printEngineStatus(): Promise<void> {
  console.log('=== Reach Engine Status ===\n');
  
  // Check for force rollback
  if (process.env.REACH_ENGINE_FORCE_RUST) {
    console.log(`⚠️  ROLLBACK MODE: ${process.env.REACH_ENGINE_FORCE_RUST}`);
    console.log(`   Rust engine forced via environment variable\n`);
  }
  
  // Show environment configuration
  console.log('Environment:');
  console.log(`  REACH_ENGINE: ${process.env.REACH_ENGINE || '(not set)'}`);
  console.log(`  REACH_ENGINE_FORCE_RUST: ${process.env.REACH_ENGINE_FORCE_RUST || '(not set)'}`);
  console.log(`  REQUIEM_BIN: ${process.env.REQUIEM_BIN || '(not set)'}`);
  console.log();
  
  // Try to get info from each engine
  console.log('Engine Status:\n');
  
  // Requiem
  try {
    const requiem = createRequiemAdapter();
    const health = await requiem.health();
    console.log(`  Requiem (C++):`);
    console.log(`    Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`    Version: ${health.version}`);
    if (health.lastError) {
      console.log(`    Warning: ${health.lastError}`);
    }
  } catch (error) {
    console.log(`  Requiem (C++):`);
    console.log(`    Status: ❌ Error`);
    console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  console.log();
  
  // Rust
  try {
    const rust = createRustAdapter();
    const health = await rust.health();
    console.log(`  Rust (WASM/TS):`);
    console.log(`    Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`    Version: ${health.version}`);
    if (health.lastError) {
      console.log(`    Warning: ${health.lastError}`);
    }
  } catch (error) {
    console.log(`  Rust (WASM/TS):`);
    console.log(`    Status: ❌ Error`);
    console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  console.log();
  console.log('Usage:');
  console.log('  reach --engine requiem <command>  # Use Requiem engine');
  console.log('  reach --engine rust <command>     # Use Rust engine');
  console.log('  reach --engine dual <command>     # Use dual-run mode');
  console.log('  REACH_ENGINE_FORCE_RUST=1 reach <command>  # Force Rust fallback');
}
