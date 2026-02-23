import { getDB } from "./connection";
import { newId } from "./helpers";

export interface FounderMetrics {
  activation: {
    visitors: number;
    demoRuns: number;
    savedRuns: number;
    signups: number;
    firstPasses: number;
    mttfsMinutes: number;
  };
  adoption: {
    tenantsWithGates: number;
    activeGatesPerTenant: number;
    tenantsWithMonitoring: number;
    tenantsWithSimulation: number;
  };
  retention: {
    d7Retention: number;
    d30Retention: number;
    avgRunFrequency: number;
    alertInteractionRate: number;
  };
}

export function getFounderMetrics(): FounderMetrics {
  const db = getDB();

  // Optimization: Simple counts for now
  const visitors = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM analytics_events WHERE event = 'page_view' AND ts > date('now', '-7 days')",
      )
      .get() as any
  ).count;
  const demoRuns = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM workflow_runs WHERE tenant_id = 't_demo_01' AND created_at > date('now', '-7 days')",
      )
      .get() as any
  ).count;
  const signups = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM users WHERE created_at > date('now', '-7 days')",
      )
      .get() as any
  ).count;
  const firstPasses = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM users WHERE first_success_at > date('now', '-7 days')",
      )
      .get() as any
  ).count;

  // MTTFS
  const mttfs =
    (
      db
        .prepare(
          `
    SELECT AVG(CAST(strftime('%s', first_success_at) - strftime('%s', created_at) AS FLOAT))/60 AS avg_minutes
    FROM users 
    WHERE first_success_at IS NOT NULL 
    AND created_at > date('now', '-7 days')
  `,
        )
        .get() as any
    ).avg_minutes || 0;

  // Adoption
  const tenantsWithGates = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT tenant_id) as count FROM gates WHERE status = 'enabled'",
      )
      .get() as any
  ).count;
  const tenantsWithMonitoring = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT tenant_id) as count FROM signals WHERE status = 'enabled'",
      )
      .get() as any
  ).count;
  const tenantsWithSimulation = (
    db
      .prepare("SELECT COUNT(DISTINCT tenant_id) as count FROM scenarios")
      .get() as any
  ).count;

  return {
    activation: {
      visitors,
      demoRuns,
      savedRuns: demoRuns * 0.4, // placeholder for saved run logic
      signups,
      firstPasses,
      mttfsMinutes: Math.round(mttfs),
    },
    adoption: {
      tenantsWithGates,
      activeGatesPerTenant: 1.2, // placeholder
      tenantsWithMonitoring,
      tenantsWithSimulation,
    },
    retention: {
      d7Retention: 24,
      d30Retention: 12,
      avgRunFrequency: 4.5,
      alertInteractionRate: 0.65,
    },
  };
}

export function createDecisionProposal(proposal: {
  title: string;
  description: string;
  scores: {
    activation: number;
    gateLeverage: number;
    monitoring: number;
    simulation: number;
    ecosystem: number;
    monetization: number;
    complexity: number;
    uiExpansion: number;
    engineeringLoad: number;
  };
  strategicAlign: boolean;
  createdBy: string;
}) {
  const db = getDB();
  const id = newId("dec");

  // Calculate total score using the weighted model
  // (A+G+M+S+E+Lv) - (C + U)
  const scoreTotal =
    proposal.scores.activation * 1.0 +
    proposal.scores.gateLeverage * 1.5 +
    proposal.scores.monitoring * 1.0 +
    proposal.scores.simulation * 1.0 +
    proposal.scores.ecosystem * 0.8 +
    proposal.scores.monetization * 1.2 -
    proposal.scores.complexity * 2.0 -
    proposal.scores.uiExpansion * 1.5;

  db.prepare(
    `
    INSERT INTO founder_decisions (id, title, description, scores_json, score_total, strategic_align, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    proposal.title,
    proposal.description,
    JSON.stringify(proposal.scores),
    scoreTotal,
    proposal.strategicAlign ? 1 : 0,
    proposal.createdBy,
    new Date().toISOString(),
    new Date().toISOString(),
  );

  return id;
}

export function getDecisions() {
  const db = getDB();
  return db
    .prepare("SELECT * FROM founder_decisions ORDER BY created_at DESC")
    .all();
}
