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

import { z } from "zod";

// ── Plugin Types ────────────────────────────────────────────────────────────────

/**
 * Plugin types supported.
 */
export type PluginType = "skill_pack" | "tool" | "provider" | "integration" | "policy";

/**
 * Plugin status.
 */
export type PluginStatus = "inactive" | "active" | "error" | "deprecated";

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
  loaded_at?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  homepage?: string;
  repository?: string;
  dependencies?: Record<string, string>;
  peer_dependencies?: Record<string, string>;
  entry_point?: string;
  permissions?: string[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
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
      throw new PluginLoadError(`Invalid manifest: ${(validation.errors ?? []).join(", ")}`);
    }

    // Check version compatibility
    const compatibilityCheck = checkVersionCompatibility(
      manifest,
      config?.runtimeVersion,
      config?.minVersion,
      config?.maxVersion,
    );

    if (!compatibilityCheck.compatible) {
      throw new PluginLoadError(`Version incompatibility: ${compatibilityCheck.reason}`);
    }

    // Create plugin instance
    const plugin: Plugin = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      plugin_type: inferPluginType(manifest),
      manifest,
      status: "inactive",
      compatibility: {
        min_api_version: compatibilityCheck.minVersion,
        max_api_version: compatibilityCheck.maxVersion,
        compatible_runtimes: config?.supportedRuntimes || [],
      },
      capabilities: extractCapabilities(manifest),
      metadata: {
        install_source: config?.installSource || "local",
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
    return this.getAll().filter((p) => p.plugin_type === type);
  }

  /**
   * Gets plugins by capability.
   */
  getByCapability(capabilityName: string): Plugin[] {
    const pluginIds = this.capabilities.get(capabilityName);
    if (!pluginIds) return [];

    return Array.from(pluginIds)
      .map((id) => this.plugins.get(id))
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

    plugin.status = "active";
    plugin.loaded_at = new Date().toISOString();
  }

  /**
   * Deactivates a plugin.
   */
  deactivate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    plugin.status = "inactive";
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
  maxVersion?: string,
): {
  compatible: boolean;
  reason?: string;
  minVersion?: string;
  maxVersion?: string;
} {
  const pluginVersion = manifest.version;

  // Check min version
  const min = minVersion || manifest.peer_dependencies?.["@reach/api"];
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
  const aParts = a.replace(/^v/, "").split(".").map(Number);
  const bParts = b.replace(/^v/, "").split(".").map(Number);

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
export function validatePluginManifest(manifest: unknown): {
  valid: boolean;
  errors?: string[];
} {
  const result = PluginManifestSchema.safeParse(manifest);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((e) => `${String(e.path.join("."))}: ${e.message}`),
    };
  }

  return { valid: true };
}

/**
 * Plugin validation contract.
 */
export interface PluginValidationContract {
  validate: (plugin: Plugin) => ValidationResult;
  validateManifest: (manifest: PluginManifest) => ValidationResult;
  validateCapabilities: (capabilities: PluginCapability[]) => ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

/**
 * Creates a validation contract for plugins.
 */
export function createValidationContract(): PluginValidationContract {
  return {
    validate(plugin: Plugin): ValidationResult {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Check required fields
      if (!plugin.id) errors.push({ code: "MISSING_ID", message: "Plugin ID is required" });
      if (!plugin.name)
        errors.push({
          code: "MISSING_NAME",
          message: "Plugin name is required",
        });
      if (!plugin.version)
        errors.push({
          code: "MISSING_VERSION",
          message: "Plugin version is required",
        });

      // Check manifest
      const manifestResult = this.validateManifest(plugin.manifest);
      errors.push(...(manifestResult.errors ?? []));
      warnings.push(...(manifestResult.warnings ?? []));

      // Check capabilities
      if (plugin.capabilities.length === 0) {
        warnings.push({
          code: "NO_CAPABILITIES",
          message: "Plugin has no capabilities declared",
        });
      }

      const capsResult = this.validateCapabilities(plugin.capabilities);
      errors.push(...(capsResult.errors ?? []));
      warnings.push(...(capsResult.warnings ?? []));

      return { valid: errors.length === 0, errors, warnings };
    },

    validateManifest(manifest: PluginManifest): ValidationResult {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Check version format
      if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
        errors.push({
          code: "INVALID_VERSION",
          message: "Version must be a valid semantic version (x.y.z)",
          field: "version",
        });
      }

      // Check required fields
      if (!manifest.id) errors.push({ code: "MISSING_ID", message: "Manifest ID is required" });
      if (!manifest.name)
        errors.push({
          code: "MISSING_NAME",
          message: "Manifest name is required",
        });
      if (!manifest.description)
        errors.push({
          code: "MISSING_DESC",
          message: "Description is required",
        });

      // Check dependencies don't have conflicts
      if (manifest.dependencies && manifest.peer_dependencies) {
        for (const [dep, version] of Object.entries(manifest.peer_dependencies)) {
          if (manifest.dependencies[dep]) {
            const depVersion = manifest.dependencies[dep];
            if (!versionsCompatible(depVersion, version)) {
              warnings.push({
                code: "DEP_CONFLICT",
                message: `Dependency ${dep} version mismatch: ${depVersion} vs peer ${version}`,
              });
            }
          }
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    },

    validateCapabilities(capabilities: PluginCapability[]): ValidationResult {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      for (const cap of capabilities) {
        if (!cap.name) {
          errors.push({
            code: "CAP_NO_NAME",
            message: "Capability must have a name",
          });
        }
        if (!cap.type) {
          errors.push({
            code: "CAP_NO_TYPE",
            message: "Capability must have a type",
          });
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  };
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function inferPluginType(manifest: PluginManifest): PluginType {
  const name = manifest.name.toLowerCase();
  const tags = manifest.tags || [];

  if (tags.includes("skill_pack")) return "skill_pack";
  if (tags.includes("tool")) return "tool";
  if (tags.includes("provider")) return "provider";
  if (tags.includes("integration")) return "integration";
  if (tags.includes("policy")) return "policy";

  if (name.includes("skill")) return "skill_pack";
  if (name.includes("tool")) return "tool";
  if (name.includes("provider")) return "provider";
  if (name.includes("integration")) return "integration";
  if (name.includes("policy")) return "policy";

  return "tool"; // Default to tool
}

function extractCapabilities(manifest: PluginManifest): PluginCapability[] {
  const capabilities: PluginCapability[] = [];

  // Extract from tags or create default
  const types = ["skill_pack", "tool", "provider", "integration", "policy"];
  for (const type of types) {
    if (manifest.tags?.includes(type)) {
      capabilities.push({
        name: type,
        type,
        description: `Provides ${type} functionality`,
      });
    }
  }

  // If no capabilities, add a default one
  if (capabilities.length === 0) {
    capabilities.push({
      name: "tool",
      type: "tool",
      description: "Default tool capability",
    });
  }

  return capabilities;
}

function versionsCompatible(a: string, b: string): boolean {
  // Simple check - if versions are the same or one is wildcard
  if (a === b) return true;
  if (a === "*" || b === "^" || b === "latest") return true;

  // Try to parse as semver ranges
  try {
    const aBase = a.replace(/[\^~>=<]/g, "").split(".")[0];
    const bBase = b.replace(/[\^~>=<]/g, "").split(".")[0];
    return aBase === bBase;
  } catch {
    return false;
  }
}

// ── Custom Error ────────────────────────────────────────────────────────────

export class PluginLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginLoadError";
  }
}

// ── Zod Schemas ────────────────────────────────────────────────────────────

export const PluginManifestSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  version: z.string(),
  description: z.string().min(1),
  author: z.string(),
  license: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  peer_dependencies: z.record(z.string(), z.string()).optional(),
  entry_point: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const PluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  plugin_type: z.enum(["skill_pack", "tool", "provider", "integration", "policy"]),
  manifest: PluginManifestSchema,
  status: z.enum(["inactive", "active", "error", "deprecated"]),
  compatibility: z.object({
    min_api_version: z.string().optional(),
    max_api_version: z.string().optional(),
    compatible_runtimes: z.array(z.string()).optional(),
    platform_requirements: z.array(z.string()).optional(),
  }),
  capabilities: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
      config_schema: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  metadata: z.object({
    installed_by: z.string().optional(),
    install_source: z.string().optional(),
    signature: z.string().optional(),
    checksum: z.string().optional(),
  }),
  loaded_at: z.string().datetime().optional(),
});

// ── Singleton Instance ────────────────────────────────────────────────────────

export const pluginLoader = new PluginLoader();
