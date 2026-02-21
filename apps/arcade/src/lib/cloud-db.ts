
/**
 * ReadyLayer Cloud DB Control Plane
 * Modularized for better maintainability and structural coherence.
 * All functions are exported here for backward compatibility.
 */

export * from './db/types';
export * from './db/connection';
export * from './db/helpers';
export * from './db/migrations';
export * from './db/tenants';
export * from './db/users';
export * from './db/api-keys';
export * from './db/workflows';
export * from './db/packs';
export * from './db/entitlements';
export * from './db/audit';
export * from './db/analytics';
export * from './db/gates';
export * from './db/scenarios';
export * from './db/seed';
export * from './db/onboarding';

import { getDB } from './db/connection';
import { applyMigrations } from './db/migrations';

// Initialize DB and apply migrations on module load
try {
  const db = getDB();
  applyMigrations(db);
} catch (err) {
  // Silent if cloud disabled, otherwise would throw CloudDisabledError
}
