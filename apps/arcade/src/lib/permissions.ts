import type { Role } from "@/lib/cloud-db";

/**
 * RBAC permission helper for UI gating.
 *
 * Reuses the existing role hierarchy from cloud-auth:
 *   viewer < member < admin < owner
 *
 * Usage:
 *   const perms = createPermissions(auth.role);
 *   if (perms.can('admin')) { ... }
 *   <button disabled={!perms.can('admin')} title={perms.tooltip('admin')}>Delete</button>
 */

const ROLE_ORDER: Role[] = ["viewer", "member", "admin", "owner"];

export interface Permissions {
  role: Role;
  /** Returns true if the user's role meets or exceeds the minimum required. */
  can: (minRole: Role) => boolean;
  /** Returns a tooltip string for disabled controls when the user lacks permission. */
  tooltip: (minRole: Role) => string | undefined;
}

export function createPermissions(role: Role): Permissions {
  const roleIndex = ROLE_ORDER.indexOf(role);

  return {
    role,
    can(minRole: Role): boolean {
      return roleIndex >= ROLE_ORDER.indexOf(minRole);
    },
    tooltip(minRole: Role): string | undefined {
      if (roleIndex >= ROLE_ORDER.indexOf(minRole)) return undefined;
      return `Requires ${minRole} role or higher`;
    },
  };
}

/**
 * Default degraded permissions for when auth is unavailable.
 * All mutating actions are blocked; read-only access is allowed.
 */
export const DEGRADED_PERMISSIONS: Permissions = {
  role: "viewer",
  can: (minRole: Role) =>
    ROLE_ORDER.indexOf("viewer") >= ROLE_ORDER.indexOf(minRole),
  tooltip: (minRole: Role) => {
    if (ROLE_ORDER.indexOf("viewer") >= ROLE_ORDER.indexOf(minRole))
      return undefined;
    return "Authentication unavailable — read-only mode";
  },
};
