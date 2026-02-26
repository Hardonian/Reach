/**
 * Engine Configuration
 * 
 * Loads and manages engine configuration from files and environment.
 * 
 * @module engine/config
 */

import { EngineConfig, EngineType, DEFAULT_ENGINE_CONFIG } from './contract';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration file paths to search
 */
const CONFIG_PATHS = [
  '.reach/config.json',
  'reach.config.json',
  '.reachrc.json',
  'config/reach.json',
];

/**
 * Load engine configuration
 */
export function loadEngineConfig(): EngineConfig {
  const fileConfig = loadConfigFromFile();
  const envConfig = loadConfigFromEnv();
  
  return mergeConfigs(DEFAULT_ENGINE_CONFIG, fileConfig, envConfig);
}

/**
 * Load configuration from file
 */
function loadConfigFromFile(): Partial<EngineConfig> {
  for (const configPath of CONFIG_PATHS) {
    const fullPath = path.resolve(configPath);
    
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(content);
        
        // Extract engine config if nested
        const engineConfig = parsed.engine || parsed;
        
        console.log(`[EngineConfig] Loaded from ${configPath}`);
        return validateConfig(engineConfig);
      } catch (error) {
        console.warn(`[EngineConfig] Failed to load ${configPath}:`, error);
      }
    }
  }
  
  return {};
}

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): Partial<EngineConfig> {
  const config: Partial<EngineConfig> = {};
  
  // Engine type
  if (process.env.REACH_ENGINE) {
    config.defaultEngine = normalizeEngineType(process.env.REACH_ENGINE);
  }
  
  // Auto fallback
  if (process.env.REACH_ENGINE_AUTO_FALLBACK) {
    config.autoFallback = process.env.REACH_ENGINE_AUTO_FALLBACK === 'true';
  }
  
  // Dual sample rate
  if (process.env.REACH_DUAL_SAMPLE_RATE) {
    config.dualSampleRate = parseFloat(process.env.REACH_DUAL_SAMPLE_RATE);
  }
  
  // Dual fail on mismatch
  if (process.env.REACH_DUAL_FAIL_ON_MISMATCH) {
    config.dualFailOnMismatch = process.env.REACH_DUAL_FAIL_ON_MISMATCH === 'true';
  }
  
  // Requiem binary path
  if (process.env.REQUIEM_BIN) {
    config.requiemBin = process.env.REQUIEM_BIN;
  }
  
  // Daemon configuration
  const daemonConfig: EngineConfig['daemon'] = {
    enabled: false,
    autoStart: false,
  };
  
  if (process.env.REACH_DAEMON_ENABLED) {
    daemonConfig.enabled = process.env.REACH_DAEMON_ENABLED === 'true';
  }
  
  if (process.env.REACH_DAEMON_AUTO_START) {
    daemonConfig.autoStart = process.env.REACH_DAEMON_AUTO_START === 'true';
  }
  
  if (process.env.REACH_DAEMON_SOCKET) {
    daemonConfig.socketPath = process.env.REACH_DAEMON_SOCKET;
  }
  
  if (process.env.REACH_DAEMON_PORT) {
    daemonConfig.port = parseInt(process.env.REACH_DAEMON_PORT, 10);
  }
  
  if (process.env.REACH_DAEMON_HOST) {
    daemonConfig.host = process.env.REACH_DAEMON_HOST;
  }
  
  if (daemonConfig.enabled) {
    config.daemon = daemonConfig;
  }
  
  // Timeout configuration
  const timeouts: Partial<EngineConfig['timeouts']> = {};
  
  if (process.env.REACH_TIMEOUT_DEFAULT) {
    timeouts.defaultMs = parseInt(process.env.REACH_TIMEOUT_DEFAULT, 10);
  }
  
  if (process.env.REACH_TIMEOUT_HEALTH) {
    timeouts.healthCheckMs = parseInt(process.env.REACH_TIMEOUT_HEALTH, 10);
  }
  
  if (process.env.REACH_TIMEOUT_DAEMON_STARTUP) {
    timeouts.daemonStartupMs = parseInt(process.env.REACH_TIMEOUT_DAEMON_STARTUP, 10);
  }
  
  if (Object.keys(timeouts).length > 0) {
    config.timeouts = { ...DEFAULT_ENGINE_CONFIG.timeouts, ...timeouts };
  }
  
  // Rollback configuration
  const rollback: Partial<EngineConfig['rollback']> = {};
  
  if (process.env.REACH_ROLLBACK_FORCE_ENV) {
    rollback.forceEnvVar = process.env.REACH_ROLLBACK_FORCE_ENV;
  }
  
  if (process.env.REACH_ROLLBACK_WARN) {
    rollback.warnOnRollback = process.env.REACH_ROLLBACK_WARN === 'true';
  }
  
  if (Object.keys(rollback).length > 0) {
    config.rollback = { ...DEFAULT_ENGINE_CONFIG.rollback, ...rollback };
  }
  
  return config;
}

/**
 * Merge multiple configuration objects
 */
function mergeConfigs(
  base: EngineConfig,
  ...overrides: Partial<EngineConfig>[]
): EngineConfig {
  let result = { ...base };
  
  for (const override of overrides) {
    if (!override) continue;
    
    result = {
      ...result,
      ...override,
      // Deep merge nested objects
      timeouts: {
        ...result.timeouts,
        ...override.timeouts,
      },
      rollback: {
        ...result.rollback,
        ...override.rollback,
      },
      daemon: override.daemon !== undefined
        ? { ...result.daemon, ...override.daemon }
        : result.daemon,
    };
  }
  
  return result;
}

/**
 * Validate configuration values
 */
function validateConfig(config: Partial<EngineConfig>): Partial<EngineConfig> {
  const validated: Partial<EngineConfig> = {};
  
  // Validate engine type
  if (config.defaultEngine) {
    validated.defaultEngine = normalizeEngineType(config.defaultEngine);
  }
  
  // Validate dual sample rate
  if (config.dualSampleRate !== undefined) {
    const rate = config.dualSampleRate;
    validated.dualSampleRate = Math.max(0, Math.min(1, rate));
  }
  
  // Validate timeouts
  if (config.timeouts) {
    validated.timeouts = {
      defaultMs: Math.max(1000, config.timeouts.defaultMs ?? DEFAULT_ENGINE_CONFIG.timeouts.defaultMs),
      healthCheckMs: Math.max(500, config.timeouts.healthCheckMs ?? DEFAULT_ENGINE_CONFIG.timeouts.healthCheckMs),
      daemonStartupMs: Math.max(1000, config.timeouts.daemonStartupMs ?? DEFAULT_ENGINE_CONFIG.timeouts.daemonStartupMs),
    };
  }
  
  // Copy other values
  if (config.autoFallback !== undefined) validated.autoFallback = config.autoFallback;
  if (config.dualFailOnMismatch !== undefined) validated.dualFailOnMismatch = config.dualFailOnMismatch;
  if (config.requiemBin !== undefined) validated.requiemBin = config.requiemBin;
  if (config.daemon !== undefined) validated.daemon = config.daemon;
  if (config.rollback !== undefined) validated.rollback = config.rollback;
  
  return validated;
}

/**
 * Normalize engine type string
 */
function normalizeEngineType(type: string): EngineType {
  const normalized = type.toLowerCase().trim();
  
  if (normalized === 'requiem' || normalized === 'cpp' || normalized === 'c++') {
    return 'requiem';
  }
  
  if (normalized === 'rust' || normalized === 'wasm' || normalized === 'ts') {
    return 'rust';
  }
  
  if (normalized === 'dual' || normalized === 'compare') {
    return 'dual';
  }
  
  console.warn(`[EngineConfig] Unknown engine type "${type}", using requiem`);
  return 'requiem';
}

/**
 * Save configuration to file
 */
export function saveEngineConfig(config: Partial<EngineConfig>, filepath?: string): void {
  const targetPath = filepath || '.reach/config.json';
  const fullPath = path.resolve(targetPath);
  
  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Load existing config if present
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(fullPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      // Ignore parse errors
    }
  }
  
  // Merge with engine config
  const merged = {
    ...existing,
    engine: {
      ...(existing.engine as Record<string, unknown> || {}),
      ...config,
    },
  };
  
  fs.writeFileSync(fullPath, JSON.stringify(merged, null, 2));
  console.log(`[EngineConfig] Saved to ${targetPath}`);
}

/**
 * Get configuration with CLI flag overrides
 */
export function getConfigWithOverrides(overrides: Partial<EngineConfig>): EngineConfig {
  const baseConfig = loadEngineConfig();
  
  return mergeConfigs(baseConfig, overrides);
}
