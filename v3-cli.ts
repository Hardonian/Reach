/**
 * Zeo v3 CLI Module — Governed Multi-Tenant Decision Infrastructure
 *
 * Commands:
 *   tenant <cmd>      Tenant management (create/list/suspend/policy/usage)
 *   health             System health check report
 *   drift              Drift monitor events
 *   schemas            Schema registry listing
 *   compliance <cmd>   Compliance report / audit-chain / secret-scan
 *   modules <cmd>      Module registry (list/register/validate)
 *   simulate <cmd>     What-if simulation / forecast / sensitivity
 *   outcome <cmd>      Outcome registration / regret / optimization
 */

// =============================================================================
// ARGS PARSING
// =============================================================================

export interface V3Args {
  command: string;
  subcommand?: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseV3Args(argv: string[]): V3Args {
  const command = argv[0] ?? "";
  const subcommand = argv[1];
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (i > 1) {
      positionals.push(arg);
    }
  }

  return { command, subcommand, positionals, flags };
}

// =============================================================================
// COMMAND ROUTER
// =============================================================================

export async function runV3Command(args: V3Args): Promise<number> {
  try {
    switch (args.command) {
      case "tenant":
        return await runTenantCommand(args);
      case "health":
        return await runHealthCommand(args);
      case "drift":
        return await runDriftCommand(args);
      case "schemas":
        return await runSchemasCommand(args);
      case "compliance":
        return await runComplianceCommand(args);
      case "modules":
        return await runModulesCommand(args);
      case "simulate":
        return await runSimulateCommand(args);
      case "outcome":
        return await runOutcomeCommand(args);
      default:
        console.error(`Unknown v3 command: ${args.command}`);
        return 1;
    }
  } catch (err) {
    console.error(`[v3] Error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

// =============================================================================
// PHASE A: TENANT COMMANDS
// =============================================================================

async function runTenantCommand(args: V3Args): Promise<number> {
  const { tenantStore, formatUsage, formatPolicy } = await import("@zeo/tenant");

  switch (args.subcommand) {
    case "create": {
      const name = args.positionals[0] ?? (args.flags["name"] as string) ?? "default";
      const owner = (args.flags["owner"] as string) ?? "cli-user";
      const tenant = tenantStore.createTenant(name, owner);
      console.log(`Tenant created: ${tenant.tenantId}`);
      console.log(`  Name:    ${tenant.name}`);
      console.log(`  Status:  ${tenant.status}`);
      console.log(`  Created: ${tenant.createdAt}`);
      return 0;
    }

    case "list": {
      const tenants = tenantStore.listTenants();
      if (tenants.length === 0) {
        console.log("No tenants registered.");
      } else {
        console.log(`=== Tenants (${tenants.length}) ===`);
        for (const t of tenants) {
          console.log(`  ${t.tenantId}: ${t.name} [${t.status}] (${t.createdAt})`);
        }
      }
      return 0;
    }

    case "suspend": {
      const tenantId = args.positionals[0] ?? (args.flags["id"] as string);
      if (!tenantId) {
        console.error("Usage: zeo tenant suspend <tenant_id>");
        return 1;
      }
      tenantStore.suspendTenant(tenantId);
      console.log(`Tenant ${tenantId} suspended.`);
      return 0;
    }

    case "policy": {
      const tenantId = args.positionals[0] ?? (args.flags["id"] as string);
      if (!tenantId) {
        console.error("Usage: zeo tenant policy <tenant_id>");
        return 1;
      }
      const policy = tenantStore.getPolicy(tenantId);
      console.log(formatPolicy(policy));
      return 0;
    }

    case "usage": {
      const tenantId = args.positionals[0] ?? (args.flags["id"] as string);
      if (!tenantId) {
        console.error("Usage: zeo tenant usage <tenant_id>");
        return 1;
      }
      const usage = tenantStore.getUsage(tenantId);
      console.log(formatUsage(usage));
      return 0;
    }

    case "assign-role": {
      const tenantId = args.positionals[0] ?? (args.flags["tenant"] as string);
      const userId = args.positionals[1] ?? (args.flags["user"] as string);
      const role = (args.positionals[2] ?? args.flags["role"]) as string;
      if (!tenantId || !userId || !role) {
        console.error("Usage: zeo tenant assign-role <tenant_id> <user_id> <role>");
        return 1;
      }
      tenantStore.assignRole(tenantId, userId, role as "owner" | "admin" | "operator" | "viewer");
      console.log(`Role ${role} assigned to ${userId} in tenant ${tenantId}`);
      return 0;
    }

    default:
      console.log(`Usage: zeo tenant <create|list|suspend|policy|usage|assign-role>`);
      return 1;
  }
}

// =============================================================================
// PHASE B: HEALTH + DRIFT COMMANDS
// =============================================================================

async function runHealthCommand(_args: V3Args): Promise<number> {
  const {
    healthRegistry,
    formatHealthReport,
    createPolicyEnforcementChecker,
    createSchemaCompatibilityChecker,
  } = await import("@zeo/observability");

  // Register built-in checkers
  healthRegistry.register("policy_enforcement", createPolicyEnforcementChecker(true));
  healthRegistry.register("schema_compatibility", createSchemaCompatibilityChecker("3.0.0"));

  const report = await healthRegistry.runAll();
  console.log(formatHealthReport(report));
  return report.overall === "fail" ? 1 : 0;
}

async function runDriftCommand(args: V3Args): Promise<number> {
  const { driftMonitor } = await import("@zeo/observability");

  if (args.subcommand === "clear") {
    driftMonitor.clear();
    console.log("Drift events cleared.");
    return 0;
  }

  console.log(driftMonitor.formatEvents());
  console.log(`\nDrift rate (last hour): ${driftMonitor.getDriftRate()}`);
  console.log(`Active drift: ${driftMonitor.hasActiveDrift() ? "YES" : "no"}`);
  return 0;
}

// =============================================================================
// PHASE C: SCHEMA COMMANDS
// =============================================================================

async function runSchemasCommand(args: V3Args): Promise<number> {
  const { schemaRegistry, formatSchemaList } = await import("@zeo/schema-registry");

  if (args.subcommand === "validate") {
    const schemaName = args.positionals[0];
    const version = args.positionals[1] ? parseInt(args.positionals[1], 10) : undefined;
    if (!schemaName) {
      console.error("Usage: zeo schemas validate <schema_name> [version]");
      return 1;
    }
    const schema = schemaRegistry.getSchema(schemaName, version);
    if (!schema) {
      console.error(`Schema not found: ${schemaName}`);
      return 1;
    }
    console.log(`Schema: ${schema.name} v${schema.version}`);
    console.log(`Hash:   ${schema.hash}`);
    console.log(`Fields: ${schema.fields.length}`);
    for (const f of schema.fields) {
      const req = f.required ? "*" : " ";
      console.log(`  ${req} ${f.name}: ${f.type}`);
    }
    return 0;
  }

  const schemas = schemaRegistry.listSchemas();
  console.log(formatSchemaList(schemas));
  return 0;
}

// =============================================================================
// PHASE E: COMPLIANCE COMMANDS
// =============================================================================

async function runComplianceCommand(args: V3Args): Promise<number> {
  const {
    complianceLedger,
    generateComplianceReport,
    formatComplianceReport,
    scanForSecrets,
    formatSecretScanResult,
  } = await import("@zeo/compliance");

  switch (args.subcommand) {
    case "report": {
      const tenantId = args.positionals[0] ?? (args.flags["tenant"] as string);
      if (!tenantId) {
        console.error("Usage: zeo compliance report <tenant_id>");
        return 1;
      }
      const report = generateComplianceReport(tenantId, complianceLedger);
      console.log(formatComplianceReport(report));
      return 0;
    }

    case "audit-chain": {
      const result = complianceLedger.verifyChain();
      if (result.valid) {
        console.log(`✓ Audit chain valid (${complianceLedger.size()} entries)`);
      } else {
        console.error(`✗ Audit chain BROKEN at entry ${result.brokenAt}`);
        console.error(`  ${result.details}`);
        return 1;
      }
      return 0;
    }

    case "secret-scan": {
      const target = args.positionals[0];
      if (!target) {
        console.error("Usage: zeo compliance secret-scan <text>");
        return 1;
      }
      const result = scanForSecrets(target, "cli-input");
      console.log(formatSecretScanResult(result));
      return result.clean ? 0 : 1;
    }

    default:
      console.log("Usage: zeo compliance <report|audit-chain|secret-scan>");
      return 1;
  }
}

// =============================================================================
// PHASE D: MODULE COMMANDS
// =============================================================================

async function runModulesCommand(args: V3Args): Promise<number> {
  const { moduleRegistry, formatModuleList } = await import("@zeo/modules");

  switch (args.subcommand) {
    case "list": {
      const tenantId = args.flags["tenant"] as string | undefined;
      const modules = tenantId ? moduleRegistry.listByTenant(tenantId) : moduleRegistry.list();
      console.log(formatModuleList(modules));
      return 0;
    }

    case "register": {
      const name = args.positionals[0] ?? (args.flags["name"] as string);
      const entrypoint = (args.flags["entrypoint"] as string) ?? "./index.js";
      const version = (args.flags["version"] as string) ?? "1.0.0";
      if (!name) {
        console.error("Usage: zeo modules register <name> --entrypoint <path> --version <ver>");
        return 1;
      }
      const { nanoid } = await import("nanoid");
      moduleRegistry.register({
        moduleId: `mod_${nanoid(12)}`,
        name,
        version,
        entrypoint,
        capabilities: ["read_evidence", "read_config"],
        dependencies: [],
        author: "cli-user",
        description: `Module ${name}`,
        deterministic: true,
        hash: "",
        tenantId: args.flags["tenant"] as string | undefined, // Support tenant isolation
        createdAt: new Date().toISOString(),
      });
      console.log(`Module "${name}" registered.`);
      return 0;
    }

    case "validate": {
      const moduleId = args.positionals[0];
      if (!moduleId) {
        console.error("Usage: zeo modules validate <module_id>");
        return 1;
      }
      const errors = moduleRegistry.validateDependencies(moduleId);
      if (errors.length === 0) {
        console.log(`✓ Module ${moduleId} dependencies valid.`);
      } else {
        console.error(`✗ Module ${moduleId} has dependency errors:`);
        for (const e of errors) console.error(`  - ${e}`);
        return 1;
      }
      return 0;
    }

    case "order": {
      try {
        const order = moduleRegistry.getDependencyOrder();
        console.log("=== Dependency Order ===");
        order.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
      } catch (err) {
        console.error(`Cycle detected: ${err instanceof Error ? err.message : err}`);
        return 1;
      }
      return 0;
    }

    default:
      console.log("Usage: zeo modules <list|register|validate|order>");
      return 1;
  }
}

// =============================================================================
// PHASE F: SIMULATION COMMANDS
// =============================================================================

async function runSimulateCommand(args: V3Args): Promise<number> {
  const {
    whatIfEngine,
    forecastEngine,
    confidenceStore,
    computeSensitivity,
    formatWhatIfResult,
    formatForecast,
    formatConfidenceTracker,
    formatSensitivity,
  } = await import("@zeo/simulation");

  switch (args.subcommand) {
    case "what-if": {
      const name = args.positionals[0] ?? "default-scenario";
      const baseDecisionId = (args.flags["decision"] as string) ?? "decision-0";

      // Create a demo scenario
      const tenantId = args.flags["tenant"] as string | undefined;
      const scenario = whatIfEngine.createScenario(
        name,
        baseDecisionId,
        [
          { assumptionId: "market_stress", originalValue: 0.5, modifiedValue: 0.8 },
          { assumptionId: "timeline_pressure", originalValue: 0.3, modifiedValue: 0.6 },
        ],
        { tenantId }
      );

      // Simulate with deterministic runners
      const result = whatIfEngine.simulate(
        scenario.id,
        (_modified) => ({
          selectedAction: "action-b",
          confidence: 0.65,
          expectedUtility: 0.72,
          risk: 0.35,
          robustness: 0.58,
        }),
        () => ({
          selectedAction: "action-a",
          confidence: 0.78,
          expectedUtility: 0.85,
          risk: 0.2,
          robustness: 0.72,
        }),
        (args.flags["seed"] as string) ?? undefined
      );

      console.log(formatWhatIfResult(result));
      return 0;
    }

    case "forecast": {
      const decisionId = (args.flags["decision"] as string) ?? "decision-0";
      const days = parseInt((args.flags["days"] as string) ?? "30", 10);
      const seed = (args.flags["seed"] as string) ?? `forecast-${decisionId}`;
      // If seeded (deterministic), default to a fixed start date if not provided
      const defaultDate = args.flags["seed"] ? "2024-01-01T00:00:00.000Z" : undefined;
      const startDate = (args.flags["start-date"] as string) ?? defaultDate;

      const projection = forecastEngine.project(
        decisionId,
        { selectedAction: "action-a", confidence: 0.78, expectedUtility: 0.85, risk: 0.2, robustness: 0.72 },
        { market_stress: 0.5, timeline_pressure: 0.3 },
        days,
        seed,
        startDate
      );

      console.log(formatForecast(projection));
      return 0;
    }

    case "confidence": {
      const decisionId = (args.flags["decision"] as string) ?? "decision-0";
      const tracker = confidenceStore.getOrCreate(decisionId, 0.5);
      console.log(formatConfidenceTracker(tracker));
      return 0;
    }

    case "sensitivity": {
      const assumptions = [
        { id: "market_stress", label: "Market Stress", value: 0.5 },
        { id: "counterparty_trust", label: "Counterparty Trust", value: 0.7 },
        { id: "timeline_pressure", label: "Timeline Pressure", value: 0.3 },
      ];

      const baseOutcome = {
        selectedAction: "action-a",
        confidence: 0.78,
        expectedUtility: 0.85,
        risk: 0.2,
        robustness: 0.72,
      };

      const entries = computeSensitivity(
        assumptions,
        (modified) => ({
          selectedAction: "action-a",
          confidence: Math.max(0, Math.min(1, 0.78 - (modified["market_stress"] - 0.5) * 0.3
            + (modified["counterparty_trust"] - 0.7) * 0.2
            - (modified["timeline_pressure"] - 0.3) * 0.15)),
          expectedUtility: 0.85,
          risk: 0.2,
          robustness: 0.72,
        }),
        baseOutcome
      );

      console.log(formatSensitivity(entries));
      return 0;
    }

    default:
      console.log("Usage: zeo simulate <what-if|forecast|confidence|sensitivity>");
      return 1;
  }
}

// =============================================================================
// PHASE G: OUTCOME COMMANDS
// =============================================================================

async function runOutcomeCommand(args: V3Args): Promise<number> {
  const {
    outcomeStore,
    assumptionTuner,
    computeRegret,
    generateOptimizationSummary,
    formatRegret,
    formatOptimizationSummary,
    formatAdjustments,
  } = await import("@zeo/optimization");

  switch (args.subcommand) {
    case "register": {
      const decisionId = (args.flags["decision"] as string) ?? "decision-0";
      const action = (args.flags["action"] as string) ?? "action-a";
      const actual = (args.flags["actual"] as string) ?? "success";
      const utility = parseFloat((args.flags["utility"] as string) ?? "0.8");
      const predicted = parseFloat((args.flags["predicted"] as string) ?? "0.85");
      const user = (args.flags["user"] as string) ?? "cli-user";

      const outcome = outcomeStore.register(
        decisionId,
        action,
        actual,
        utility,
        predicted,
        user
      );

      console.log(`Outcome registered: ${outcome.id}`);
      console.log(`  Decision: ${outcome.decisionId}`);
      console.log(`  Action:   ${outcome.selectedAction}`);
      console.log(`  Outcome:  ${outcome.actualOutcome}`);
      console.log(`  Utility:  observed=${outcome.observedUtility}, predicted=${outcome.predictedUtility}`);
      return 0;
    }

    case "regret": {
      const decisionId = (args.flags["decision"] as string) ?? "decision-0";
      const outcomes = outcomeStore.getByDecision(decisionId);
      if (outcomes.length === 0) {
        console.log(`No outcomes for decision: ${decisionId}`);
        return 0;
      }

      for (const outcome of outcomes) {
        const analysis = computeRegret(outcome, [
          { action: "action-b", utility: outcome.observedUtility * 0.9 },
          { action: "action-c", utility: outcome.observedUtility * 1.1 },
        ]);
        console.log(formatRegret(analysis));
        console.log();
      }
      return 0;
    }

    case "adjust": {
      const pending = assumptionTuner.getPending();
      if (args.positionals[0] === "list") {
        console.log(formatAdjustments(assumptionTuner.getAll()));
        return 0;
      }

      const adjustmentId = args.positionals[0];
      const action = args.positionals[1]; // approve | reject
      if (!adjustmentId || !action) {
        console.log("Usage: zeo outcome adjust <adjustment_id> <approve|reject>");
        console.log("       zeo outcome adjust list");
        return 1;
      }

      const user = (args.flags["user"] as string) ?? "cli-user";
      if (action === "approve") {
        const adj = assumptionTuner.approve(adjustmentId, user);
        if (adj) {
          console.log(`✓ Adjustment ${adjustmentId} approved by ${user}`);
        } else {
          console.error(`Could not approve ${adjustmentId}`);
          return 1;
        }
      } else if (action === "reject") {
        const adj = assumptionTuner.reject(adjustmentId, user);
        if (adj) {
          console.log(`✗ Adjustment ${adjustmentId} rejected by ${user}`);
        } else {
          console.error(`Could not reject ${adjustmentId}`);
          return 1;
        }
      }
      return 0;
    }

    case "summary": {
      const outcomes = outcomeStore.getAll();
      const regrets = outcomes.map((o) =>
        computeRegret(o, [
          { action: "alt-a", utility: o.observedUtility * 0.95 },
          { action: "alt-b", utility: o.observedUtility * 1.05 },
        ])
      );
      const summary = generateOptimizationSummary(
        outcomes,
        regrets,
        assumptionTuner.getAll()
      );
      console.log(formatOptimizationSummary(summary));
      return 0;
    }

    default:
      console.log("Usage: zeo outcome <register|regret|adjust|summary>");
      return 1;
  }
}
