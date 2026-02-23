// @ts-nocheck
// DEK-specific checks
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { DoctorCheck } from "./doctor-cli.js";

export function runDekJournalCheck(): DoctorCheck {
  const journalDir = resolve(process.cwd(), ".zeo", "journal");

  if (!existsSync(journalDir)) {
    return {
      id: "dek-journal",
      name: "DEK Journal Health",
      status: "pass",
      message: "Journal directory not yet created (will be created on first run)",
    };
  }

  try {
    const files = readdirSync(journalDir).filter((f) => f.endsWith(".jsonl"));

    if (files.length === 0) {
      return {
        id: "dek-journal",
        name: "DEK Journal Health",
        status: "pass",
        message: "No journal entries yet",
      };
    }

    // Check latest journal file for corruption
    const latestFile = files.sort().reverse()[0];
    const content = readFileSync(join(journalDir, latestFile), "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    let corruptLines = 0;
    for (const line of lines.slice(-10)) {
      try {
        JSON.parse(line);
      } catch {
        corruptLines++;
      }
    }

    if (corruptLines > 0) {
      return {
        id: "dek-journal",
        name: "DEK Journal Health",
        status: "warning",
        message: `${files.length} journal file(s), ${corruptLines} corrupt line(s) in latest`,
        remediation: "Journal may be corrupted. Backup and recreate if needed.",
      };
    }

    return {
      id: "dek-journal",
      name: "DEK Journal Health",
      status: "pass",
      message: `${files.length} journal file(s), ${lines.length} total entries`,
      details: { files: files.length, entries: lines.length },
    };
  } catch (err) {
    return {
      id: "dek-journal",
      name: "DEK Journal Health",
      status: "warning",
      message: `Cannot read journal: ${(err as Error).message}`,
    };
  }
}

export function runModelAdapterCheck(): DoctorCheck {
  // Check for registered model adapters in kernel
  try {
    // This would typically check the actual adapter registry
    // For now, we check if adapter configuration exists
    const adapterConfigPath = resolve(process.cwd(), ".zeo", "adapters.json");

    if (!existsSync(adapterConfigPath)) {
      return {
        id: "model-adapters",
        name: "Model Adapter Integrity",
        status: "pass",
        message: "Using default model adapters",
      };
    }

    const config = JSON.parse(readFileSync(adapterConfigPath, "utf8"));
    const adapters = config.adapters || [];

    if (adapters.length === 0) {
      return {
        id: "model-adapters",
        name: "Model Adapter Integrity",
        status: "warning",
        message: "No model adapters configured",
        remediation: "Add adapters to .zeo/adapters.json or use defaults",
      };
    }

    // Check each adapter has required fields
    const validAdapters = adapters.filter(
      (a: any) => a.id && a.provider && a.model && typeof a.execute === "function",
    );

    return {
      id: "model-adapters",
      name: "Model Adapter Integrity",
      status: validAdapters.length === adapters.length ? "pass" : "warning",
      message: `${validAdapters.length}/${adapters.length} adapters valid`,
      details: { adapters: adapters.map((a: any) => a.id) },
    };
  } catch (err) {
    return {
      id: "model-adapters",
      name: "Model Adapter Integrity",
      status: "warning",
      message: `Adapter check failed: ${(err as Error).message}`,
    };
  }
}

export function runPolicySchemaCheck(): DoctorCheck {
  const policyPath = resolve(process.cwd(), ".zeo", "policy.json");

  // Default policy version
  const currentSchemaVersion = "1.0.0";

  if (!existsSync(policyPath)) {
    return {
      id: "policy-schema",
      name: "Policy Schema Version",
      status: "pass",
      message: `Using default policy schema v${currentSchemaVersion}`,
      details: {
        current: currentSchemaVersion,
        latest: currentSchemaVersion,
        compatible: true,
      },
    };
  }

  try {
    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    const policyVersion = policy.schemaVersion || policy.version || "unknown";

    // Simple semver comparison
    const isCompatible = policyVersion.startsWith("1.");

    if (!isCompatible) {
      return {
        id: "policy-schema",
        name: "Policy Schema Version",
        status: "warning",
        message: `Policy schema v${policyVersion} may be incompatible (expected v1.x)`,
        remediation: "Update policy schema to v1.0.0 or check migration guide",
        details: {
          current: policyVersion,
          latest: currentSchemaVersion,
          compatible: false,
        },
      };
    }

    return {
      id: "policy-schema",
      name: "Policy Schema Version",
      status: "pass",
      message: `Policy schema v${policyVersion} compatible`,
      details: {
        current: policyVersion,
        latest: currentSchemaVersion,
        compatible: true,
      },
    };
  } catch (err) {
    return {
      id: "policy-schema",
      name: "Policy Schema Version",
      status: "fail",
      message: `Invalid policy.json: ${(err as Error).message}`,
      remediation: "Fix or remove .zeo/policy.json",
    };
  }
}

export async function runEnterpriseConnectivityCheck(): Promise<DoctorCheck> {
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    return {
      id: "enterprise",
      name: "Enterprise Connectivity (Supabase)",
      status: "pass",
      message: "Enterprise mode not configured (local-only mode)",
      details: { status: "unconfigured" },
    };
  }

  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseKey) {
    return {
      id: "enterprise",
      name: "Enterprise Connectivity (Supabase)",
      status: "warning",
      message: "SUPABASE_URL set but SUPABASE_SERVICE_KEY missing",
      remediation: "Set SUPABASE_SERVICE_KEY environment variable",
      details: { status: "misconfigured" },
    };
  }

  // Test connectivity
  try {
    const startTime = Date.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    const latencyMs = Date.now() - startTime;

    if (response.ok || response.status === 404) {
      // 404 is OK - means we connected but the table doesn't exist yet
      return {
        id: "enterprise",
        name: "Enterprise Connectivity (Supabase)",
        status: "pass",
        message: `Connected to Supabase (${latencyMs}ms)`,
        details: { status: "connected", latencyMs },
      };
    } else {
      return {
        id: "enterprise",
        name: "Enterprise Connectivity (Supabase)",
        status: "warning",
        message: `Supabase returned ${response.status}`,
        remediation: "Check Supabase URL and service key",
        details: { status: "error", code: response.status },
      };
    }
  } catch (err) {
    return {
      id: "enterprise",
      name: "Enterprise Connectivity (Supabase)",
      status: "warning",
      message: `Cannot connect: ${(err as Error).message}`,
      remediation: "Check network and Supabase configuration",
      details: { status: "disconnected" },
    };
  }
}
