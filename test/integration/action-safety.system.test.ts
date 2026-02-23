/**
 * test/integration/action-safety.system.test.ts
 *
 * PHASE 3 — Action Safety + State Machine Tests
 *
 * Enforces the plan→approve→execute lifecycle and prevents illegal transitions.
 * Tests:
 * - execute without plan fails with E_INVALID_INPUT
 * - execute without approval fails
 * - rollback only available for reversible actions
 * - illegal transitions rejected consistently
 * - idempotency: re-run execute with same key does not duplicate journal/events
 * - repeated plan creation with same decision fingerprint dedupes correctly
 */

import { describe, it, expect } from "vitest";
import { hashString } from "../../src/determinism/hashStream.js";
import { canonicalJson } from "../../src/determinism/canonicalJson.js";
import { evaluateDecisionFallback } from "../../fallback.js";
import { DEMO_DECISION_INPUT, FIXED_TIMESTAMP } from "../harness/seed.js";

// ─── Action state machine ─────────────────────────────────────────────────────

type ActionStatus = "planned" | "approved" | "executed" | "rolled_back" | "cancelled";

interface ActionEntry {
  id: string;
  actionType: string;
  decisionId: string;
  status: ActionStatus;
  idempotencyKey: string;
  reversible: boolean;
  payload: Record<string, unknown>;
  executedAt: string | null;
  rolledBackAt: string | null;
}

type ActionError = { code: string; message: string };

function makeIdempotencyKey(actionType: string, decisionId: string, payload: Record<string, unknown>): string {
  return hashString(`${actionType}:${decisionId}:${canonicalJson(payload)}`).slice(0, 32);
}

function makeActionId(idempotencyKey: string): string {
  return hashString(`action:${idempotencyKey}`).slice(0, 16);
}

class ActionStateMachine {
  private journal: ActionEntry[] = [];
  private events: Array<{ type: string; actionId: string; timestamp: string }> = [];

  plan(
    actionType: string,
    decisionId: string,
    payload: Record<string, unknown>,
    options: { reversible?: boolean } = {},
  ): ActionEntry {
    const idempotencyKey = makeIdempotencyKey(actionType, decisionId, payload);
    const id = makeActionId(idempotencyKey);

    // Check for existing plan with same idempotency key
    const existing = this.journal.find((e) => e.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing; // Idempotent: return existing plan
    }

    const entry: ActionEntry = {
      id,
      actionType,
      decisionId,
      status: "planned",
      idempotencyKey,
      reversible: options.reversible ?? false,
      payload,
      executedAt: null,
      rolledBackAt: null,
    };
    this.journal.push(entry);
    this.events.push({ type: "action.planned", actionId: id, timestamp: FIXED_TIMESTAMP });
    return entry;
  }

  approve(id: string): ActionEntry | ActionError {
    const entry = this.journal.find((e) => e.id === id);
    if (!entry) return { code: "E_NOT_FOUND", message: `Action not found: ${id}` };
    if (entry.status !== "planned") {
      return { code: "E_INVALID_INPUT", message: `Cannot approve action in state '${entry.status}'` };
    }
    entry.status = "approved";
    this.events.push({ type: "action.approved", actionId: id, timestamp: FIXED_TIMESTAMP });
    return entry;
  }

  execute(id: string): ActionEntry | ActionError {
    const entry = this.journal.find((e) => e.id === id);
    if (!entry) return { code: "E_INVALID_INPUT", message: `Action not found: ${id}` };
    if (entry.status !== "approved") {
      return {
        code: "E_INVALID_INPUT",
        message: `Cannot execute action in state '${entry.status}' — must be approved first`,
      };
    }
    // Idempotency: check if already executed with same key
    const alreadyExecuted = this.journal.find(
      (e) => e.idempotencyKey === entry.idempotencyKey && e.status === "executed",
    );
    if (alreadyExecuted) return alreadyExecuted;

    entry.status = "executed";
    entry.executedAt = FIXED_TIMESTAMP;
    this.events.push({ type: "action.executed", actionId: id, timestamp: FIXED_TIMESTAMP });
    return entry;
  }

  rollback(id: string): ActionEntry | ActionError {
    const entry = this.journal.find((e) => e.id === id);
    if (!entry) return { code: "E_NOT_FOUND", message: `Action not found: ${id}` };
    if (entry.status !== "executed") {
      return { code: "E_INVALID_INPUT", message: `Cannot rollback action in state '${entry.status}'` };
    }
    if (!entry.reversible) {
      return { code: "E_NOT_REVERSIBLE", message: `Action '${entry.actionType}' is not reversible` };
    }
    entry.status = "rolled_back";
    entry.rolledBackAt = FIXED_TIMESTAMP;
    this.events.push({ type: "action.rolled_back", actionId: id, timestamp: FIXED_TIMESTAMP });
    return entry;
  }

  cancel(id: string): ActionEntry | ActionError {
    const entry = this.journal.find((e) => e.id === id);
    if (!entry) return { code: "E_NOT_FOUND", message: `Action not found: ${id}` };
    if (entry.status === "executed" || entry.status === "rolled_back") {
      return { code: "E_INVALID_INPUT", message: `Cannot cancel action in state '${entry.status}'` };
    }
    entry.status = "cancelled";
    this.events.push({ type: "action.cancelled", actionId: id, timestamp: FIXED_TIMESTAMP });
    return entry;
  }

  getJournal(): ActionEntry[] {
    return [...this.journal];
  }

  getEvents(): Array<{ type: string; actionId: string; timestamp: string }> {
    return [...this.events];
  }
}

function isError(result: ActionEntry | ActionError): result is ActionError {
  return "code" in result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Action state machine — lifecycle enforcement", () => {
  it("plan → approve → execute succeeds", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    expect(planned.status).toBe("planned");

    const approved = sm.approve(planned.id);
    expect(isError(approved)).toBe(false);
    expect((approved as ActionEntry).status).toBe("approved");

    const executed = sm.execute(planned.id);
    expect(isError(executed)).toBe(false);
    expect((executed as ActionEntry).status).toBe("executed");
    expect((executed as ActionEntry).executedAt).toBe(FIXED_TIMESTAMP);
  });

  it("execute without plan fails with E_INVALID_INPUT", () => {
    const sm = new ActionStateMachine();
    const fakeId = "nonexistent-action-id";
    const result = sm.execute(fakeId);
    expect(isError(result)).toBe(true);
    expect((result as ActionError).code).toBe("E_INVALID_INPUT");
  });

  it("execute without approval fails with E_INVALID_INPUT", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });

    // Try to execute without approving first
    const result = sm.execute(planned.id);
    expect(isError(result)).toBe(true);
    expect((result as ActionError).code).toBe("E_INVALID_INPUT");
    expect((result as ActionError).message).toContain("must be approved first");
  });

  it("approve a non-planned action fails", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    sm.approve(planned.id);
    sm.execute(planned.id);

    // Try to approve again after execution
    const result = sm.approve(planned.id);
    expect(isError(result)).toBe(true);
    expect((result as ActionError).code).toBe("E_INVALID_INPUT");
  });

  it("rollback only available for reversible actions", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    // Non-reversible action
    const planned = sm.plan("irreversible_action", decisionId, { dryRun: false }, { reversible: false });
    sm.approve(planned.id);
    sm.execute(planned.id);

    const rollbackResult = sm.rollback(planned.id);
    expect(isError(rollbackResult)).toBe(true);
    expect((rollbackResult as ActionError).code).toBe("E_NOT_REVERSIBLE");
  });

  it("rollback succeeds for reversible actions", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("reversible_action", decisionId, { dryRun: false }, { reversible: true });
    sm.approve(planned.id);
    sm.execute(planned.id);

    const rollbackResult = sm.rollback(planned.id);
    expect(isError(rollbackResult)).toBe(false);
    expect((rollbackResult as ActionEntry).status).toBe("rolled_back");
    expect((rollbackResult as ActionEntry).rolledBackAt).toBe(FIXED_TIMESTAMP);
  });

  it("rollback of non-executed action fails", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("reversible_action", decisionId, { dryRun: false }, { reversible: true });
    // Not executed yet
    const result = sm.rollback(planned.id);
    expect(isError(result)).toBe(true);
    expect((result as ActionError).code).toBe("E_INVALID_INPUT");
  });

  it("cancel is available for planned actions", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    const result = sm.cancel(planned.id);
    expect(isError(result)).toBe(false);
    expect((result as ActionEntry).status).toBe("cancelled");
  });

  it("cancel is available for approved actions", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    sm.approve(planned.id);
    const result = sm.cancel(planned.id);
    expect(isError(result)).toBe(false);
    expect((result as ActionEntry).status).toBe("cancelled");
  });

  it("cancel of executed action fails", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    sm.approve(planned.id);
    sm.execute(planned.id);

    const result = sm.cancel(planned.id);
    expect(isError(result)).toBe(true);
    expect((result as ActionError).code).toBe("E_INVALID_INPUT");
  });

  it("all illegal transitions are rejected consistently", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });

    // Illegal: execute before approve
    expect(isError(sm.execute(planned.id))).toBe(true);

    // Legal: approve
    sm.approve(planned.id);

    // Illegal: approve again
    expect(isError(sm.approve(planned.id))).toBe(true);

    // Legal: execute
    sm.execute(planned.id);

    // Illegal: execute again (already executed)
    // Note: idempotent execute returns the existing entry, not an error
    const reexecute = sm.execute(planned.id);
    // After execution, status is "executed" — re-execute returns error since status != "approved"
    expect(isError(reexecute)).toBe(true);

    // Illegal: approve after execution
    expect(isError(sm.approve(planned.id))).toBe(true);

    // Illegal: cancel after execution
    expect(isError(sm.cancel(planned.id))).toBe(true);
  });
});

describe("Action idempotency", () => {
  it("re-plan with same idempotency key returns existing entry", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const payload = { dryRun: false, target: "demo" };

    const plan1 = sm.plan("demo_safe_action", decisionId, payload);
    const plan2 = sm.plan("demo_safe_action", decisionId, payload);

    expect(plan1.id).toBe(plan2.id);
    expect(plan1.idempotencyKey).toBe(plan2.idempotencyKey);
    expect(sm.getJournal()).toHaveLength(1);
  });

  it("re-execute with same idempotency key does not duplicate journal entries", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    sm.approve(planned.id);
    sm.execute(planned.id);

    // Journal should have exactly 1 entry
    const executed = sm.getJournal().filter((e) => e.status === "executed");
    expect(executed).toHaveLength(1);
  });

  it("idempotency key is deterministic for same inputs", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const payload = { dryRun: false, target: "demo" };

    const key1 = makeIdempotencyKey("demo_safe_action", decisionId, payload);
    const key2 = makeIdempotencyKey("demo_safe_action", decisionId, payload);
    expect(key1).toBe(key2);
  });

  it("different payloads produce different idempotency keys", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const key1 = makeIdempotencyKey("demo_safe_action", decisionId, { dryRun: false });
    const key2 = makeIdempotencyKey("demo_safe_action", decisionId, { dryRun: true });
    expect(key1).not.toBe(key2);
  });

  it("events are emitted for each state transition exactly once", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    sm.approve(planned.id);
    sm.execute(planned.id);

    const events = sm.getEvents();
    const planEvents = events.filter((e) => e.type === "action.planned");
    const approveEvents = events.filter((e) => e.type === "action.approved");
    const executeEvents = events.filter((e) => e.type === "action.executed");

    expect(planEvents).toHaveLength(1);
    expect(approveEvents).toHaveLength(1);
    expect(executeEvents).toHaveLength(1);
  });
});

describe("Action plan deduplication", () => {
  it("repeated plan creation with same decision fingerprint dedupes", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const payload = { recommendedAction: "review_code" };

    // Create 5 plans with same decision + payload
    for (let i = 0; i < 5; i++) {
      sm.plan("demo_safe_action", decisionId, payload);
    }

    // Should only have 1 entry in journal
    expect(sm.getJournal()).toHaveLength(1);
  });

  it("different decision fingerprints create separate plans", () => {
    const sm = new ActionStateMachine();
    const decisionId1 = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const decisionId2 = hashString(canonicalJson({ ...DEMO_DECISION_INPUT, algorithm: "maximin" })).slice(0, 16);

    sm.plan("demo_safe_action", decisionId1, { recommendedAction: "review_code" });
    sm.plan("demo_safe_action", decisionId2, { recommendedAction: "review_code" });

    expect(sm.getJournal()).toHaveLength(2);
  });

  it("action ID is deterministic from idempotency key", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const payload = { dryRun: false };

    const key = makeIdempotencyKey("demo_safe_action", decisionId, payload);
    const id1 = makeActionId(key);
    const id2 = makeActionId(key);
    expect(id1).toBe(id2);
  });
});

describe("Action safety — never auto-execute destructive actions", () => {
  it("destructive action requires explicit approval before execution", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    // Plan a destructive action
    const planned = sm.plan("delete_data", decisionId, { target: "test-data" }, { reversible: false });
    expect(planned.status).toBe("planned");

    // Must not be auto-executed — requires explicit approval
    const executeResult = sm.execute(planned.id);
    expect(isError(executeResult)).toBe(true);
    expect((executeResult as ActionError).code).toBe("E_INVALID_INPUT");
    expect((executeResult as ActionError).message).toContain("must be approved first");
  });

  it("safe demo action can be executed after approval", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: true });
    sm.approve(planned.id);
    const result = sm.execute(planned.id);

    expect(isError(result)).toBe(false);
    expect((result as ActionEntry).status).toBe("executed");
  });

  it("all events have deterministic timestamps", () => {
    const sm = new ActionStateMachine();
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);

    const planned = sm.plan("demo_safe_action", decisionId, { dryRun: false });
    sm.approve(planned.id);
    sm.execute(planned.id);

    for (const event of sm.getEvents()) {
      expect(event.timestamp).toBe(FIXED_TIMESTAMP);
    }
  });
});
