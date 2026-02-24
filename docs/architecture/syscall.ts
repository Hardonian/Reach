/**
 * SysCall Interface
 *
 * Defines the boundary between the deterministic Core (Layer 1) and
 * the side-effecting world (Layer 2).
 *
 * As per docs/architecture/BOUNDARIES.md, all I/O operations must be
 * routed through this interface to ensure they can be mocked,
 * intercepted, or sandboxed.
 */

export interface SysCall {
  fs: FileSystem;
  // Network, Time, and Randomness are handled by other determinism primitives
  // or will be added here if they require explicit system-level mediation.
}

export interface FileSystem {
  /**
   * Reads a file as a UTF-8 string.
   * Throws if file does not exist or is not readable.
   */
  readTextFile(path: string): Promise<string>;

  /**
   * Writes data to a file, creating parent directories if needed.
   * This is a side effect and must be carefully controlled.
   */
  writeTextFile(path: string, data: string): Promise<void>;

  /**
   * Checks if a file or directory exists.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Lists files in a directory.
   * Output MUST be sorted deterministically by the implementation
   * before returning to Core.
   */
  listDir(path: string): Promise<string[]>;

  /**
   * Creates a directory recursively.
   */
  makeDir(path: string): Promise<void>;
}

/**
 * NoOp implementation for safe defaults or testing.
 */
export const NoOpSysCall: SysCall = {
  fs: {
    readTextFile: async () => "",
    writeTextFile: async () => {},
    exists: async () => false,
    listDir: async () => [],
    makeDir: async () => {},
  },
};
