/**
 * ReadyLayer Plugin System Scaffold
 * 
 * Provides foundational plugin infrastructure:
 * - Skill pack loader
 * - Tool plugin registration interface
 * - Version compatibility checker
 * - Plugin validation contract
 * - Capability registry
 * 
 * @module plugin-system
 */

import { z } from 'zod';

// ── Plugin Types ────────────────────────────────────────────────────────────────

/**
 * Plugin types supported.
 */
export type PluginType = 
  | 'skill_pack'
  | 'tool'
  | 'provider'
  | 'integration'
  | 'policy';

/**
 * Plugin status.
 */
export type PluginStatus = 
  | 'inactive'
  | 'active'
  | 'error'
  | 'deprecated';

/**
 * Plugin definition.
 */
export interface Plugin {
  id: string;
  name: string;
  version: string;
  plugin_type: PluginType;
  manifest: PluginManifest;
  status: PluginStatus;
  compatibility: PluginCompatibility;
  capabilities: PluginCapability[];
  metadata: PluginMetadata;
  loaded_at?:export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  homepage string;
}

?: string;
  repository?: string;
  dependencies?: Record<string, string>;
  peer_dependencies?: Record<string, string>;
  entry_point?: string;
  permissions?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface PluginCompatibility {
  min_api_version?: string;
  max_api_version?: string;
  compatible_runtimes?: string[];
  platform_requirements?: string[];
}

export interface PluginCapability {
  name: string;
  type: string;
  description?: string;
  config_schema?: Record<string, unknown>;
}

export interface PluginMetadata {
  installed_by?: string;
  install_source?: string;
  signature?: string;
  checksum?: string;
}

// ── Plugin Loader ────────────────────────────────────────────────────────────

/**
 * Plugin loader for skill packs.
 */
export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private capabilities: Map<string, Set<string>> = new Map();
  
  /**
   * Loads a plugin from a manifest.
   */
  async load(manifest: PluginManifest, config?: PluginConfig): Promise<Plugin> {
    // Validate manifest
    const validation = validatePluginManifest(manifest);
    if (!validation.valid) {
      throw new PluginLoadError(`Invalid manifest: ${validation.errors.join(', ')}`);
    }
    
    // Check version compatibility
    const compatibilityCheck = checkVersionCompatibility(
      manifest,
      config?.runtimeVersion,
      config?.minVersion,
      config?.maxVersion
    );
    
    if (!compatibleCheck.compatible) {
      throw new PluginLoadError(`Version incompatibility: ${compatibleCheck.reason}`);
    }
    
    // Create plugin instance
    const plugin: Plugin = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      plugin_type: inferPluginType(manifest),
      manifest,
      status: 'inactive',
      compatibility: {
        min_api_version: compatibilityCheck.minVersion,
        max_api_version: compatibilityCheck.maxVersion,
        compatible_runtimes: config?.supportedRuntimes || [],
      },
      capabilities: extractCapabilities(manifest),
      metadata: {
        install_source: config?.installSource || 'local',
        signature: config?.signature,
        checksum: config?.checksum,
      },
    };
    
    // Register plugin
    this.plugins.set(plugin.id, plugin);
    
    // Register capabilities
    for (const capability of plugin.capabilities) {
      const existing = this.capabilities.get(capability.name) || new Set();
      existing.add(plugin.id);
      this.capabilities.set(capability.name, existing);
    }
    
    return plugin;
  }
  
  /**
   * Unloads a plugin.
   */
  unload(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    
    // Remove capabilities
    for (const capability of plugin.capabilities) {
      const existing = this.capabilities.get(capability.name);
      if (existing) {
        existing.delete(pluginId);
        if (existing.size === 0) {
          this.capabilities.delete(capability.name);
        }
      }
    }
    
    this.plugins.delete(pluginId);
    return true;
  }
  
  /**
   * Gets a plugin by ID.
   */
  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }
  
  /**
   * Gets all plugins.
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Gets plugins by type.
   */
  getByType(type: PluginType): Plugin[] {
    return this.getAll().filter(p => p.plugin_type === type);
  }
  
  /**
   * Gets plugins by capability.
   */
  getByCapability(capabilityName: string): Plugin[] {
    const pluginIds = this.capabilities.get(capabilityName);
    if (!pluginIds) return [];
    
    return Array.from(pluginIds)
      .map(id => this.plugins.get(id))
      .filter((p): p is Plugin => p !== undefined);
  }
  
  /**
   * Checks if a plugin is loaded.
   */
  isLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }
  
  /**
   * Activates a plugin.
   */
  activate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginLoadError(`Plugin ${pluginId} not found`);
    }
    
    plugin.status = 'active';
    plugin.loaded_at = new Date().toISOString();
  }
  
  /**
   * Deactivates a plugin.
   */
  deactivate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    plugin.status = 'inactive';
  }
  
  /**
   * Gets capability registry.
   */
  getCapabilityRegistry(): Record<string, string[]> {
    const registry: Record<string, string[]> = {};
    for (const [capability, pluginIds] of this.capabilities) {
      registry[capability] = Array.from(pluginIds);
    }
    return registry;
  }
}

export interface PluginConfig {
  runtimeVersion?: string;
  minVersion?: string;
  maxVersion?: string;
  supportedRuntimes?: string[];
  installSource?: string;
  signature?: string;
  checksum?: string;
}

// ── Version Compatibility ────────────────────────────────────────────────────

/**
 * Checks if a plugin is compatible with the runtime.
 */
export function checkVersionCompatibility(
  manifest: PluginManifest,
  runtimeVersion?: string,
  minVersion?: string,
  maxVersion?: string
): { compatible: boolean; reason?: string; minVersion?: string; maxVersion?: string } {
  const pluginVersion = manifest.version;
  
  // Check min version
  const min = minVersion || manifest.peer_dependencies?.['@reach/api'];
  const max = maxVersion;
  
  if (min && compareVersions(pluginVersion, min) < 0) {
    return {
      compatible: false,
      reason: `Plugin requires API version ${min}, current is ${pluginVersion}`,
      minVersion: min,
      maxVersion: max,
    };
  }
  
  if (max && compareVersions(pluginVersion, max) > 0) {
    return {
      compatible: false,
      reason: `Plugin is not compatible with API version ${max}`,
      minVersion: min,
      maxVersion: max,
    };
  }
  
  return {
    compatible: true,
    minVersion: min,
    maxVersion: max,
  };
}

/**
 * Compares two semantic versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/^v/, '').split('.').map(Number);
  const bParts = b.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }
  
  return 0;
}

// ── Plugin Validation ────────────────────────────────────────────────────────

/**
 * Validates a plugin manifest.
 */
export function validatePluginManifest(
  manifest: unknown
): { valid: boolean; errors?: string[] } {
  const result = PluginManifestSchema.safeParse(manifest);
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
  
  return { valid: true };
}

/**
 * Plugin validation contract.
 */
