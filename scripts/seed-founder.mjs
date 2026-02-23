import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "apps/arcade/data/reach.db");
const db = new Database(dbPath);

console.log("Seeding Founder Control System data...");

// Insert some entropy snapshots
db.prepare(
  `
  INSERT OR IGNORE INTO entropy_snapshots (id, timestamp, route_count, orphan_routes, avg_actions_per_screen, paragraph_violations, technical_debt_score, created_at)
  VALUES 
    ('ent_01', '2026-02-14T00:00:00Z', 10, 0, 2.1, 0, 0.05, datetime('now')),
    ('ent_02', '2026-02-21T00:00:00Z', 12, 1, 2.8, 0, 0.08, datetime('now'))
`,
).run();

// Insert some sample decisions
const decisions = [
  {
    id: "dec_01",
    title: "Consolidate Marketplace and Templates",
    description: "Merge divergent library routes into /library to reduce nav bloat.",
    status: "go",
    score_total: 42.5,
    strategic_align: 1,
  },
  {
    id: "dec_02",
    title: "Native iOS/Android App",
    description: "Build a full mobile wrapper for dashboard.",
    status: "defer",
    score_total: 12.0,
    strategic_align: 0,
  },
];

for (const dec of decisions) {
  db.prepare(
    `
    INSERT OR IGNORE INTO founder_decisions (id, title, description, status, score_total, strategic_align, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'u_demo_01', datetime('now'), datetime('now'))
  `,
  ).run(dec.id, dec.title, dec.description, dec.status, dec.score_total, dec.strategic_align);
}

console.log("✅ Founder data seeded.");
