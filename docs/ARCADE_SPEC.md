# Reach Arcade Specification

## 1. Overview

Reach Arcade is a dedicated product surface designed for playful coding and instant feedback. It serves as a visual shell that allows users to discover capabilities, run safe packs, and share results.

## 2. Boundary Rules

### 2.1 UI Only
- The Arcade is strictly a presentation layer.
- It MUST NOT contain any core execution logic.
- It MUST interact with the execution engine only via defined APIs.

### 2.2 Environment Agnostic
- The Arcade generally runs on the client-side.
- It MUST render without assuming specific server-side environment variables, except for public configuration.

### 2.3 Policy Enforcement
- All executions initiated from the Arcade MUST pass through the Policy Gate.
- The Arcade cannot bypass any existing safety checks.

## 3. Execution Interface

### 3.1 Demo Runner API
- A local, sandboxed API layer handles execution requests from the Arcade.
- Rate limits are strictly enforced to prevent abuse.
- No external infrastructure is provisioned for this API.

### 3.2 Arcade-Safe Packs
- Only execution packs explicitly marked with `arcadeSafe: true` in their metadata are runnable in the Arcade.
- Attempts to run non-safe packs MUST be rejected by the API.

## 4. Data Handling

### 4.1 Secret Material
- Secret credentials (keys, tokens) MUST NEVER be displayed in the Arcade UI.
- Inputs requiring secrets must use secure, redacted handling.

### 4.2 Shared Run Cards
- Shared URLs MUST encode the pack ID, inputs, and a run reference.
- Shared views MUST rely on redacted logs/events.
- Replay is allowed ONLY if the deterministic flag is set and policy permits.

## 5. Technical Stack

- **Framework**: Next.js (Static-first export where possible).
- **Styling**: Vanilla CSS / Modules.
- **State**: React local state + URL params.
