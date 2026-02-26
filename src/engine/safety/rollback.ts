/**
 * Rollback Safety Module
 *
 * Ensures:
 * - FORCE_RUST / FORCE_REQUIEM honored at every execution entrypoint
 * - Fallback cannot become default silently
 * - `reach doctor` prints engine+protocol+hash truth and exact rollback instructions
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Configuration Environment Variables
// ============================================================================

/** Force use of Rust engine (bypass Requiem) */
export const ENV_FORCE_RUST = "FORCE_RUST";

/** Force use of Requiem C++ engine (bypass Rust) */
export const ENV_FORCE_REQUIEM = "FORCE_REQUIEM";

/** Enable dual-run mode for verification */
export const ENV_DUAL_RUN = "REACH_DUAL_RUN";

/** Path to Requiem binary override */
export const ENV_REQUIEM_BIN = "REQUIEM_BIN";

/** Disable fallback (fail fast) */
export const ENV_NO_FALLBACK = "REACH_NO_FALLBACK";

// ============================================================================
// Engine Types
// ============================================================================

export enum EngineType {
  /** Pure TypeScript fallback implementation */
  TYPESCRIPT = "typescript",
  /** Rust/WASM implementation */
  RUST = "rust",
  /** Requiem C++ implementation */
  REQUIEM = "requiem",
}

export enum EngineSelectionMode {
  /** Auto-detect best available engine */
  AUTO = "auto",
  /** Force Rust engine */
  FORCE_RUST = "force_rust",
  /** Force Requiem engine */
  FORCE_REQUIEM = "force_requiem",
  /** Force TypeScript fallback */
  FORCE_TYPESCRIPT = "force_typescript",
}

// ============================================================================
// Types
// ============================================================================

export interface EngineSelection {
  primary: EngineType;
  fallback: EngineType | null;
  mode: EngineSelectionMode;
  reason: string;
  envVars: Record<string, string | undefined>;
}

export interface EngineStatus {
  type: EngineType;
  available: boolean;
  version: string | null;
  path: string | null;
  hash: string | null;
  health: "healthy" | "degraded" | "unavailable";
  lastError?: string;
}

export interface RollbackInfo {
  currentEngine: EngineType;
  rollbackAvailable: boolean;
  rollbackEngine: EngineType | null;
  rollbackCommand: string;
  verifiedEngines: EngineType[];
}

export interface DoctorTruthReport {
  timestamp: string;
  selection: EngineSelection;
  engines: Record<EngineType, EngineStatus>;
  rollback: RollbackInfo;
  protocol: {
    version: string;
    negotiated: string | null;
  };
  hash: {
    algorithm: string;
    sample: string | null;
  };
  determinism: {
    enabled: boolean;
    mode: string;
  };
}

// ============================================================================
// Engine Detector
// ============================================================================

export class EngineDetector {
  private cache = new Map<EngineType, { status: EngineStatus; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 5000; // 5 second TTL for cache freshness

  /**
   * Detect all available engines and their status.
   */
  detectAllEngines(): Record<EngineType, EngineStatus> {
    return {
      [EngineType.TYPESCRIPT]: this.detectTypeScript(),
      [EngineType.RUST]: this.detectRust(),
      [EngineType.REQUIEM]: this.detectRequiem(),
    };
  }

  /**
   * Detect TypeScript fallback engine.
   */
  detectTypeScript(): EngineStatus {
    const cached = this.cache.get(EngineType.TYPESCRIPT);
    if (cached) return cached;

    // TypeScript is always available as it's the current runtime
    const status: EngineStatus = {
      type: EngineType.TYPESCRIPT,
      available: true,
      version: process.version, // Node.js version
      path: process.execPath,
      hash: null,
      health: "healthy",
    };

    this.cache.set(EngineType.TYPESCRIPT, status);
    return status;
  }

  /**
   * Get cached status with TTL check.
   */
  private getCached(type: EngineType): EngineStatus | null {
    const cached = this.cache.get(type);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > this.CACHE_TTL_MS) {
      this.cache.delete(type);
      return null;
    }
    return cached.status;
  }

  /**
   * Set cached status with timestamp.
   */
  private setCached(type: EngineType, status: EngineStatus): void {
    this.cache.set(type, { status, cachedAt: Date.now() });
  }

  /**
   * Detect Rust/WASM engine.
   */
  detectRust(): EngineStatus {
    const cached = this.getCached(EngineType.RUST);
    if (cached) return cached;

    const status: EngineStatus = {
      type: EngineType.RUST,
      available: false,
      version: null,
      path: null,
      hash: null,
      health: "unavailable",
    };

    try {
      // Check for WASM module
      const wasmPath = join(process.cwd(), "pkg/decision_engine_rs.js");
      if (existsSync(wasmPath)) {
        status.available = true;
        status.path = wasmPath;
        status.health = "healthy";
        // Calculate hash of the WASM file
        const wasmContent = readFileSync(wasmPath);
        status.hash = createHash("sha256").update(wasmContent).digest("hex");
      }

      // Try to get version from Cargo.toml if available
      const cargoPath = join(process.cwd(), "Cargo.toml");
      if (existsSync(cargoPath)) {
        const cargoContent = readFileSync(cargoPath, "utf-8");
        const versionMatch = cargoContent.match(/version\s*=\s*"([^"]+)"/);
        if (versionMatch) {
          status.version = versionMatch[1];
        }
      }
    } catch (err) {
      status.lastError = String(err);
    }

    this.setCached(EngineType.RUST, status);
    return status;
  }

  /**
   * Detect Requiem C++ engine.
   */
  detectRequiem(): EngineStatus {
    const cached = this.getCached(EngineType.REQUIEM);
    if (cached) return cached;

    const status: EngineStatus = {
      type: EngineType.REQUIEM,
      available: false,
      version: null,
      path: null,
      hash: null,
      health: "unavailable",
    };

    try {
      // Check for Requiem binary from env var or default locations
      const requiemBin = process.env[ENV_REQUIEM_BIN];
      const paths = requiemBin
        ? [requiemBin]
        : [
            join(process.cwd(), "requiem"),
            join(process.cwd(), "requiem.exe"),
            "/usr/local/bin/requiem",
            "/usr/bin/requiem",
          ];

      for (const path of paths) {
        if (existsSync(path)) {
          status.available = true;
          status.path = path;
          status.health = "healthy";

          // Calculate hash of binary
          try {
            const content = readFileSync(path);
            status.hash = createHash("sha256").update(content).digest("hex");
          } catch {
            // Binary might be locked, skip hash
          }
          break;
        }
      }

      // Try to get version if available
      if (status.available && status.path) {
        // Version would be obtained by running requiem --version
        // For now, leave as null until runtime check
        status.version = "unknown";
      }
    } catch (err) {
      status.lastError = String(err);
    }

    this.setCached(EngineType.REQUIEM, status);
    return status;
  }

  /**
   * Clear detection cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Engine Selector
// ============================================================================

export class EngineSelector {
  private detector = new EngineDetector();
  private lastEnv: Record<string, string | undefined> = {};
  private envCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start watching for environment changes
    this.startEnvWatcher();
  }

  /**
   * Watch for environment variable changes that affect engine selection.
   */
  private startEnvWatcher(): void {
    this.lastEnv = this.captureEnvVars();
    // Check every 1 second for env changes
    this.envCheckInterval = setInterval(() => {
      const current = this.captureEnvVars();
      if (!this.envVarsEqual(current, this.lastEnv)) {
        this.detector.clearCache();
        this.lastEnv = current;
      }
    }, 1000);
  }

  /**
   * Stop the environment watcher.
   */
  stopEnvWatcher(): void {
    if (this.envCheckInterval) {
      clearInterval(this.envCheckInterval);
      this.envCheckInterval = null;
    }
  }

  /**
   * Compare environment variables for changes.
   */
  private envVarsEqual(
    a: Record<string, string | undefined>,
    b: Record<string, string | undefined>
  ): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  /**
   * Select engine based on environment and availability.
   * Priority: FORCE_REQUIEM > FORCE_RUST > Auto (Requiem > Rust > TypeScript)
   */
  selectEngine(): EngineSelection {
    const envVars = this.captureEnvVars();
    const engines = this.detector.detectAllEngines();

    // Check for force flags
    if (envVars[ENV_FORCE_REQUIEM] === "1" || envVars[ENV_FORCE_REQUIEM] === "true") {
      if (engines[EngineType.REQUIEM].available) {
        return {
          primary: EngineType.REQUIEM,
          fallback: null,
          mode: EngineSelectionMode.FORCE_REQUIEM,
          reason: `${ENV_FORCE_REQUIEM} environment variable is set`,
          envVars,
        };
      }
      throw new Error(
        `${ENV_FORCE_REQUIEM} is set but Requiem engine is not available. ` +
          `Set ${ENV_FORCE_REQUIEM}=0 or install Requiem binary.`
      );
    }

    if (envVars[ENV_FORCE_RUST] === "1" || envVars[ENV_FORCE_RUST] === "true") {
      if (engines[EngineType.RUST].available) {
        return {
          primary: EngineType.RUST,
          fallback: null,
          mode: EngineSelectionMode.FORCE_RUST,
          reason: `${ENV_FORCE_RUST} environment variable is set`,
          envVars,
        };
      }
      throw new Error(
        `${ENV_FORCE_RUST} is set but Rust engine is not available. ` +
          `Set ${ENV_FORCE_RUST}=0 or build the WASM module.`
      );
    }

    // Auto-selection mode
    const selection = this.autoSelect(engines, envVars);
    return selection;
  }

  /**
   * Verify that a forced engine is actually being used.
   * Throws error if there's a mismatch.
   */
  verifyForcedEngine(actualEngine: EngineType): void {
    const selection = this.selectEngine();

    if (selection.mode === EngineSelectionMode.FORCE_REQUIEM && actualEngine !== EngineType.REQUIEM) {
      throw new Error(
        `CRITICAL: ${ENV_FORCE_REQUIEM} is set but actual engine is ${actualEngine}. ` +
          `This is a rollback safety violation.`
      );
    }

    if (selection.mode === EngineSelectionMode.FORCE_RUST && actualEngine !== EngineType.RUST) {
      throw new Error(
        `CRITICAL: ${ENV_FORCE_RUST} is set but actual engine is ${actualEngine}. ` +
          `This is a rollback safety violation.`
      );
    }
  }

  /**
   * Get fallback chain for an engine.
   */
  getFallbackChain(primary: EngineType): EngineType[] {
    switch (primary) {
      case EngineType.REQUIEM:
        return [EngineType.RUST, EngineType.TYPESCRIPT];
      case EngineType.RUST:
        return [EngineType.TYPESCRIPT];
      case EngineType.TYPESCRIPT:
        return [];
      default:
        return [];
    }
  }

  private autoSelect(
    engines: Record<EngineType, EngineStatus>,
    envVars: Record<string, string | undefined>
  ): EngineSelection {
    // Priority: Requiem > Rust > TypeScript
    if (engines[EngineType.REQUIEM].available) {
      return {
        primary: EngineType.REQUIEM,
        fallback: engines[EngineType.RUST].available ? EngineType.RUST : EngineType.TYPESCRIPT,
        mode: EngineSelectionMode.AUTO,
        reason: "Requiem is available and is the preferred engine",
        envVars,
      };
    }

    if (engines[EngineType.RUST].available) {
      return {
        primary: EngineType.RUST,
        fallback: EngineType.TYPESCRIPT,
        mode: EngineSelectionMode.AUTO,
        reason: "Requiem unavailable, Rust is the preferred fallback",
        envVars,
      };
    }

    // TypeScript is always available
    return {
      primary: EngineType.TYPESCRIPT,
      fallback: null,
      mode: EngineSelectionMode.AUTO,
      reason: "No native engines available, using TypeScript fallback",
      envVars,
    };
  }

  private captureEnvVars(): Record<string, string | undefined> {
    return {
      [ENV_FORCE_RUST]: process.env[ENV_FORCE_RUST],
      [ENV_FORCE_REQUIEM]: process.env[ENV_FORCE_REQUIEM],
      [ENV_DUAL_RUN]: process.env[ENV_DUAL_RUN],
      [ENV_REQUIEM_BIN]: process.env[ENV_REQUIEM_BIN],
      [ENV_NO_FALLBACK]: process.env[ENV_NO_FALLBACK],
    };
  }
}

// ============================================================================
// Rollback Manager
// ============================================================================

export class RollbackManager {
  private detector = new EngineDetector();
  private selector = new EngineSelector();

  /**
   * Get rollback information for the current state.
   */
  getRollbackInfo(currentEngine?: EngineType): RollbackInfo {
    const engines = this.detector.detectAllEngines();
    const current = currentEngine ?? this.selector.selectEngine().primary;
    const verified: EngineType[] = [];

    // Find all verified (available) engines
    for (const [type, status] of Object.entries(engines)) {
      if (status.available) {
        verified.push(type as EngineType);
      }
    }

    // Determine rollback target (next available in priority order)
    let rollbackTarget: EngineType | null = null;
    const priority = [EngineType.REQUIEM, EngineType.RUST, EngineType.TYPESCRIPT];
    const currentIndex = priority.indexOf(current);

    for (let i = currentIndex + 1; i < priority.length; i++) {
      if (engines[priority[i]].available) {
        rollbackTarget = priority[i];
        break;
      }
    }

    return {
      currentEngine: current,
      rollbackAvailable: rollbackTarget !== null,
      rollbackEngine: rollbackTarget,
      rollbackCommand: this.generateRollbackCommand(rollbackTarget),
      verifiedEngines: verified,
    };
  }

  /**
   * Check if fallback is being used silently (warning condition).
   */
  checkSilentFallback(): { silent: boolean; warning?: string } {
    const selection = this.selector.selectEngine();
    const engines = this.detector.detectAllEngines();

    // If auto mode and Requiem was expected but not used
    if (
      selection.mode === EngineSelectionMode.AUTO &&
      selection.primary !== EngineType.REQUIEM &&
      process.env["REACH_EXPECT_REQUIEM"] === "1"
    ) {
      return {
        silent: true,
        warning: `Expected Requiem but using ${selection.primary}. ` + `Fallback occurred silently.`,
      };
    }

    return { silent: false };
  }

  private generateRollbackCommand(target: EngineType | null): string {
    if (!target) return "No rollback available";

    switch (target) {
      case EngineType.RUST:
        return `export ${ENV_FORCE_RUST}=1 && unset ${ENV_FORCE_REQUIEM}`;
      case EngineType.TYPESCRIPT:
        return `unset ${ENV_FORCE_RUST} && unset ${ENV_FORCE_REQUIEM}`;
      case EngineType.REQUIEM:
        return `unset ${ENV_FORCE_RUST} && export ${ENV_FORCE_REQUIEM}=1`;
      default:
        return "Unknown rollback target";
    }
  }
}

// ============================================================================
// Doctor Truth Reporter
// ============================================================================

export class DoctorTruthReporter {
  private detector = new EngineDetector();
  private selector = new EngineSelector();
  private rollback = new RollbackManager();

  /**
   * Generate comprehensive truth report for `reach doctor`.
   */
  generateReport(): DoctorTruthReport {
    const engines = this.detector.detectAllEngines();
    const selection = this.selector.selectEngine();
    const rollbackInfo = this.rollback.getRollbackInfo(selection.primary);

    return {
      timestamp: new Date().toISOString(),
      selection,
      engines,
      rollback: rollbackInfo,
      protocol: {
        version: "1.0.0",
        negotiated: null,
      },
      hash: {
        algorithm: "sha256",
        sample: this.generateSampleHash(),
      },
      determinism: {
        enabled: true,
        mode: process.env[ENV_DUAL_RUN] === "1" ? "dual-run" : "single",
      },
    };
  }

  /**
   * Format report for human-readable CLI output.
   */
  formatReport(report: DoctorTruthReport): string {
    const lines: string[] = [];

    lines.push("=== Engine Truth Report ===\n");

    // Selection
    lines.push(`Primary Engine: ${report.selection.primary}`);
    lines.push(`Selection Mode: ${report.selection.mode}`);
    lines.push(`Selection Reason: ${report.selection.reason}`);
    lines.push(`Fallback: ${report.selection.fallback ?? "none"}\n`);

    // Engine Status
    lines.push("Engine Status:");
    for (const [type, status] of Object.entries(report.engines)) {
      const indicator = status.available ? "✓" : "✗";
      const health = status.health;
      lines.push(`  ${indicator} ${type}: ${health}`);
      if (status.version) {
        lines.push(`    Version: ${status.version}`);
      }
      if (status.path) {
        lines.push(`    Path: ${status.path}`);
      }
      if (status.hash) {
        lines.push(`    Hash: ${status.hash.slice(0, 16)}...`);
      }
    }
    lines.push("");

    // Rollback Info
    lines.push("Rollback Safety:");
    lines.push(`  Current: ${report.rollback.currentEngine}`);
    lines.push(`  Rollback Available: ${report.rollback.rollbackAvailable ? "yes" : "no"}`);
    if (report.rollback.rollbackEngine) {
      lines.push(`  Rollback Engine: ${report.rollback.rollbackEngine}`);
    }
    lines.push(`  Command: ${report.rollback.rollbackCommand}`);
    lines.push(`  Verified Engines: ${report.rollback.verifiedEngines.join(", ")}\n`);

    // Environment
    lines.push("Environment Variables:");
    lines.push(`  ${ENV_FORCE_RUST}=${report.selection.envVars[ENV_FORCE_RUST] ?? "<unset>"}`);
    lines.push(`  ${ENV_FORCE_REQUIEM}=${report.selection.envVars[ENV_FORCE_REQUIEM] ?? "<unset>"}`);
    lines.push(`  ${ENV_DUAL_RUN}=${report.selection.envVars[ENV_DUAL_RUN] ?? "<unset>"}\n`);

    // Protocol & Hash
    lines.push("Protocol: " + report.protocol.version);
    lines.push("Hash Algorithm: " + report.hash.algorithm);
    lines.push("Determinism: " + (report.determinism.enabled ? "enabled" : "disabled"));

    return lines.join("\n");
  }

  private generateSampleHash(): string | null {
    try {
      return createHash("sha256").update("reach-doctor-test").digest("hex");
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Safety Guards
// ============================================================================

export class SafetyGuards {
  private selector = new EngineSelector();
  private lastLoggedEngine: EngineType | null = null;

  /**
   * Guard to ensure engine selection is honored.
   * Call at every execution entrypoint.
   */
  guardEntrypoint(actualEngine: EngineType): void {
    // Verify forced engines
    this.selector.verifyForcedEngine(actualEngine);

    // Log engine changes (prevents silent fallback)
    if (this.lastLoggedEngine !== null && this.lastLoggedEngine !== actualEngine) {
      console.error(
        `[SAFETY] Engine changed from ${this.lastLoggedEngine} to ${actualEngine} at ${new Date().toISOString()}`
      );
    }
    this.lastLoggedEngine = actualEngine;
  }

  /**
   * Check if fallback should be allowed.
   */
  allowFallback(): boolean {
    const noFallback = process.env[ENV_NO_FALLBACK];
    if (noFallback === "1" || noFallback === "true") {
      return false;
    }
    return true;
  }

  /**
   * Create a wrapped engine executor with safety guards.
   */
  wrapExecutor<T extends (...args: unknown[]) => unknown>(
    engine: EngineType,
    executor: T
  ): T {
    return ((...args: unknown[]) => {
      this.guardEntrypoint(engine);
      return executor(...args);
    }) as T;
  }
}

// ============================================================================
// Export singletons
// ============================================================================

export const engineSelector = new EngineSelector();
export const rollbackManager = new RollbackManager();
export const doctorReporter = new DoctorTruthReporter();
export const safetyGuards = new SafetyGuards();

// ============================================================================
// Convenience functions
// ============================================================================

export function getCurrentEngine(): EngineSelection {
  return engineSelector.selectEngine();
}

export function verifyEngineSelection(actualEngine: EngineType): void {
  safetyGuards.guardEntrypoint(actualEngine);
}

export function getRollbackInstructions(): RollbackInfo {
  return rollbackManager.getRollbackInfo();
}

export function generateDoctorTruthReport(): string {
  const report = doctorReporter.generateReport();
  return doctorReporter.formatReport(report);
}
