import { getTenantBySlug, createTenant } from "./tenants";
import { createUser, getUserById, addMember } from "./users";
import { createProject } from "./workflows";
import { createApiKey } from "./api-keys";
import { createWorkflow } from "./workflows";
import { getDB } from "./connection";
import { type Tenant, type User } from "./types";

export function seedDevData(): {
  tenant: Tenant;
  user: User;
  rawApiKey: string;
} {
  const db = getDB();
  const existing = db.prepare("SELECT id FROM tenants WHERE slug='reach-dev'").get();
  if (existing) {
    const tenant = getTenantBySlug("reach-dev")!;
    const user = db.prepare("SELECT id FROM users WHERE email='admin@reach.dev'").get() as {
      id: string;
    };
    return { tenant, user: getUserById(user.id)!, rawApiKey: "ALREADY_SEEDED" };
  }
  const tenant = createTenant("Reach Dev", "reach-dev");
  const user = createUser("admin@reach.dev", "dev-password-local", "Admin");
  addMember(tenant.id, user.id, "owner");
  const project = createProject(tenant.id, "Default Project", "Auto-created dev project");
  const { rawKey } = createApiKey(tenant.id, user.id, "dev-key", ["*"]);
  createWorkflow(
    tenant.id,
    project.id,
    "Hello World Workflow",
    "Sample workflow",
    user.id,
    JSON.stringify({
      nodes: [
        {
          id: "n1",
          type: "trigger",
          name: "Start",
          inputs: {},
          config: {},
          outputs: {},
        },
        {
          id: "n2",
          type: "agent",
          name: "Process",
          inputs: {},
          config: { model: "kimi-coding-2.5" },
          outputs: {},
        },
        {
          id: "n3",
          type: "output",
          name: "Result",
          inputs: {},
          config: {},
          outputs: {},
        },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
      ],
      triggers: [{ type: "manual" }],
      policies: [],
      version: 1,
    }),
  );
  return { tenant, user, rawApiKey: rawKey };
}
