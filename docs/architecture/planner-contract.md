# Planner Boundary Contract

Last Updated: 2026-02-23

## Purpose

This document defines the boundary between the deterministic decision engine
and non-deterministic LLM/AI planner components. The planner is an untrusted
input source — its output is always verified, never blindly executed.

---

## 1. Architecture Position

```text
┌──────────────────────────────┐
│     User / Agent             │
│     (non-deterministic)      │
└──────────┬───────────────────┘
           │ prompt / request
           ▼
┌──────────────────────────────┐
│     LLM Provider             │
│     (non-deterministic)      │
│     src/lib/llm-provider.ts  │
└──────────┬───────────────────┘
           │ structured JSON output
           ▼
┌──────────────────────────────┐
│     Planner Boundary         │  ← THIS CONTRACT
│     (validation + hashing)   │
└──────────┬───────────────────┘
           │ validated, hashed proposal
           ▼
┌──────────────────────────────┐
│     Decision Engine          │
│     (deterministic)          │
│     zeolite-core / fallback  │
└──────────────────────────────┘
```

The planner boundary is the membrane between nondeterministic AI output and
the deterministic decision engine. Everything below this boundary is
deterministic. Everything above it is not.

---

## 2. Safe LLM Binding Interface

### Provider Contract

The `LlmProvider` interface (`src/lib/llm-provider.ts`) defines the boundary:

```typescript
interface LlmProvider {
  chat(
    messages: LlmMessage[],
    jsonSchema?: Record<string, unknown>,
    seed?: number,
    temperature?: number,
  ): Promise<{ json: unknown; usage: LlmUsage }>;
}
```

### Determinism Controls

The provider enforces these constraints at the boundary:

| Parameter     | Constraint              | Enforcement                    |
| :------------ | :---------------------- | :----------------------------- |
| `seed`        | Non-negative integer    | `validateDeterminism()` throws |
| `temperature` | Must be exactly `0`     | `validateDeterminism()` throws |

**Reality**: LLM providers do NOT guarantee deterministic output even with
`temperature=0` and fixed `seed`. The OpenAI API documentation explicitly
states that `seed` provides "best effort" determinism, not a guarantee.

**Implication**: LLM output is ALWAYS treated as an untrusted, non-deterministic
input. The determinism guarantee lives entirely within the decision engine,
not at the LLM boundary.

### Schema Validation

LLM output is validated against a JSON schema before entering the engine:

```typescript
validateJsonSchema(parsed.json, jsonSchema);
```

This is a structural guard — it ensures the LLM output conforms to the
expected shape, but does not validate semantic correctness.

---

## 3. Deterministic Fallback Mode

When no LLM is available (offline mode, CI, replay), the system falls back
to a purely deterministic computation path.

### Fallback Implementations

| Algorithm          | File                      | Deterministic | Notes                     |
| :----------------- | :------------------------ | :------------ | :------------------------ |
| Minimax Regret     | `src/lib/fallback.ts`     | YES           | Float tie-break concern   |
| Maximin            | `src/lib/fallback.ts`     | YES           | Same float tie-break      |
| Weighted Sum       | `src/lib/fallback.ts`     | YES           | Weight normalization safe |
| Zeolite Operations | `src/core/zeolite-core.ts` | YES          | All ops are deterministic |
| Core Shim          | `src/core/shim.ts`        | YES           | Deterministic mode toggle |

### Fallback Activation

```typescript
// Activate deterministic mode (epoch-zero timestamps, fixed seed)
activateDeterministicMode({ seed: "snapshot-create" });

// Execute with deterministic guarantees
const result = runDecision(spec, { depth: 2 });

// Deactivate
deactivateDeterministicMode();
```

### Fallback Invariant

If `activateDeterministicMode()` is called:

- `resolveTimestamp()` returns epoch zero (or the `ZEO_FIXED_TIME` env value).
- No LLM calls are made.
- All computations use the seeded PRNG if randomness is needed.
- Output is fully reproducible.

---

## 4. AI Output Hashing Strategy

### Principle: Hash After Validation, Before Trust

LLM output enters the system as a **proposal**. The flow is:

```text
1. LLM returns JSON response
2. Response is parsed (tryParseJsonObject)
3. Response is schema-validated (validateJsonSchema)
4. Response is hashed as an untrusted input
5. Response enters the referee_proposal operation
6. Engine adjudicates: accept or reject
7. Decision is recorded with both the proposal hash and the adjudication
```

### Hashing of LLM Output

LLM output is hashed at the point of entry using the standard `hashInput()`
mechanism. The hash captures:

- The exact JSON content of the LLM response (after parsing).
- The schema it was validated against.
- The provider name and model identifier (for audit).

This hash is NOT the same as the decision fingerprint. It is an **input
provenance hash** — it records what the AI said, not what the engine decided.

### Adjudication Record

When the engine's `referee_proposal` operation runs, it produces:

```json
{
  "adjudication": {
    "accepted": false,
    "agentClaim": "commit_now",
    "zeoBoundary": { "topAction": "verify_terms" },
    "diff": {
      "agentClaim": "commit_now",
      "zeoBoundary": "verify_terms",
      "whatWouldChange": ["..."]
    }
  }
}
```

The adjudication is deterministic — it depends only on the decision spec and
evidence, not on the specific LLM output. The LLM output merely selects which
comparison path to evaluate.

---

## 5. Trust Levels for AI Output

| Trust Level    | Meaning                                                |
| :------------- | :----------------------------------------------------- |
| `untrusted`    | Raw LLM output, schema-validated but not adjudicated   |
| `adjudicated`  | Engine has compared claim against decision boundary    |
| `accepted`     | Engine agrees with the AI's recommendation             |
| `rejected`     | Engine disagrees; AI recommendation diverges from math |

### Trust Erosion

If an AI provider consistently produces claims that the engine rejects,
the trust profile system (`shim.ts → recordTrustEvent`) records this.
The `deriveTrustTier()` function classifies providers:

| Tier          | Criteria                         |
| :------------ | :------------------------------- |
| `unknown`     | < 3 pass events                  |
| `provisional` | 3–9 pass events, 0 failures     |
| `established` | ≥ 10 pass events, 0 failures    |
| `untrusted`   | Any failure event recorded       |

---

## 6. Replay Safety for AI-Involved Decisions

### Problem

If a decision involved an AI proposal, replaying that decision requires:

1. The same decision spec (deterministic).
2. The same evidence (deterministic).
3. The same AI proposal (non-deterministic — the AI may give a different answer).

### Solution

The transcript records the **exact AI proposal** that was made. During replay:

- The original AI proposal is loaded from the transcript.
- The engine re-adjudicates using the recorded proposal.
- The adjudication is deterministic because it depends on the spec + evidence.
- The AI is NOT re-queried during replay.

**Invariant**: Replay never calls the LLM. It replays from the recorded
transcript. This is what makes replay deterministic even for AI-involved
decisions.

---

## 7. Security Boundary

### Prohibited at the Planner Boundary

- LLM output MUST NOT be `eval()`'d or dynamically executed.
- LLM output MUST NOT modify the decision spec or evidence.
- LLM output MUST NOT bypass schema validation.
- LLM output MUST NOT be used as a cryptographic input (key, nonce, etc.).

### Permitted at the Planner Boundary

- LLM output MAY propose an action (which is adjudicated).
- LLM output MAY provide reasoning text (recorded but not hashed into proofs).
- LLM output MAY suggest evidence to gather (user decides whether to act).

---

## 8. Formal Invariants

| ID     | Invariant                                                | Status |
| :----- | :------------------------------------------------------- | :----- |
| PLN-01 | LLM output is always schema-validated before use         | HOLDS  |
| PLN-02 | temperature=0 and seed enforced for deterministic mode   | HOLDS  |
| PLN-03 | Fallback mode produces identical output for same input   | HOLDS  |
| PLN-04 | Replay never re-queries the LLM                          | HOLDS  |
| PLN-05 | AI proposals are hashed at entry for provenance          | HOLDS  |
| PLN-06 | Adjudication is deterministic (depends on spec+evidence) | HOLDS  |
| PLN-07 | No dynamic eval of LLM output                           | HOLDS  |
