/**
 * SCCL (Strict Capability Control Layer)
 * Manages what system capabilities (FS, Network, Secrets) are available to plugins and runners.
 */
export type Capability = "fs.read" | "fs.write" | "net.outbound" | "env.read" | "os.exec";

export interface CapabilityManifest {
  granted: Capability[];
  denied: Capability[];
}

export class SCCL {
  /**
   * Formalized capability handshake between a runner and an agent/plugin.
   */
  static verifyCapabilities(
    required: Capability[],
    manifest: CapabilityManifest,
  ): { ok: boolean; missing: Capability[] } {
    const missing = required.filter(
      (cap) => !manifest.granted.includes(cap) || manifest.denied.includes(cap),
    );
    return {
      ok: missing.length === 0,
      missing,
    };
  }

  /**
   * Guards a function call by checking capabilities first.
   */
  static guard<T>(
    required: Capability[],
    manifest: CapabilityManifest,
    fn: () => T,
  ): T {
    const { ok, missing } = this.verifyCapabilities(required, manifest);
    if (!ok) {
      throw new Error(`SCCL Violation: Missing capabilities: ${missing.join(", ")}`);
    }
    return fn();
  }
}
