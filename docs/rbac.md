# RBAC — Role-Based Access Control

## Role Hierarchy

```
viewer < member < admin < owner
```

Roles are stored per-tenant in the `memberships` table. Every authenticated request resolves to an `AuthContext` with the user's role.

## Role → Route → Action Matrix

| Route                   | viewer | member         | admin             | owner |
| ----------------------- | ------ | -------------- | ----------------- | ----- |
| `/console` (dashboard)  | read   | read           | full              | full  |
| `/console/agents`       | read   | read, run      | full              | full  |
| `/console/runners`      | read   | read           | manage            | full  |
| `/console/traces`       | read   | read           | read              | full  |
| `/console/evaluation`   | read   | run evals      | configure         | full  |
| `/console/governance`   | read   | read           | configure         | full  |
| `/console/datasets`     | read   | read, upload   | delete            | full  |
| `/console/cost`         | —      | read           | read              | full  |
| `/console/billing`      | —      | —              | manage            | full  |
| `/console/ecosystem`    | read   | read           | manage            | full  |
| `/console/integrations` | read   | read           | rotate/disable    | full  |
| `/console/artifacts`    | read   | read, download | delete, retention | full  |
| `/console/alerts`       | read   | read, ack      | configure         | full  |
| `/console/safety`       | read   | read           | configure         | full  |

## Admin-Only Actions

These actions require `admin` role or higher and are enforced both in the UI (disabled with tooltip) and at the API layer:

- **Delete dataset** — `DELETE /api/v1/datasets/:id`
- **Rotate / disable integrations** — `POST /api/v1/integrations/:id/rotate`
- **Freeze system / pause queue** — `POST /api/v1/ops/pause`
- **Billing / chargeback controls** — `/console/billing`
- **Retention policy changes** — `PUT /api/v1/artifacts/retention`
- **API key management** — `POST /api/v1/api-keys`, `DELETE /api/v1/api-keys/:id`

## UI Gating

Use the `createPermissions()` helper from `@/lib/permissions`:

```tsx
import { createPermissions } from "@/lib/permissions";

const perms = createPermissions(auth.role);

<button disabled={!perms.can("admin")} title={perms.tooltip("admin")}>
  Delete Dataset
</button>;
```

When auth is unavailable, use `DEGRADED_PERMISSIONS` which defaults to viewer (read-only).

## Server-Side Enforcement

Use `requireRole()` from `@/lib/cloud-auth`:

```ts
const ctx = await requireAuth(req);
if ("error" in ctx) return errorResponse(ctx);
if (!requireRole(ctx, "admin")) {
  return cloudErrorResponse("Insufficient permissions", 403, ctx.correlationId);
}
```
