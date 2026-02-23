import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEMO_DATA = {
  id: "demo-seed-1",
  version: "1.0.0",
  timestamp: "2024-01-01T00:00:00.000Z",
  entities: [
    {
      id: "entity-1",
      type: "decision",
      name: "Sample Decision",
      description: "A sample decision for testing purposes",
      inputs: {
        temperature: 20,
        humidity: 50,
        pressure: 1013,
      },
      policy: "allow-all",
      artifacts: ["artifact-1", "artifact-2"],
    },
    {
      id: "entity-2",
      type: "junction",
      name: "Test Junction",
      description: "A test junction configuration",
      rules: {
        condition: "temperature > 15",
        action: "proceed",
      },
    },
  ],
  artifacts: [
    {
      id: "artifact-1",
      type: "model",
      name: "Temperature Model",
      version: "1.0.0",
      hash: "sha256:abc123",
    },
    {
      id: "artifact-2",
      type: "data",
      name: "Weather Data",
      version: "1.0.0",
      hash: "sha256:def456",
    },
  ],
};

export function seedDemoData(cwd: string): string {
  const seedPath = join(cwd, "demo-seed.json");
  writeFileSync(seedPath, JSON.stringify(DEMO_DATA, null, 2));
  return seedPath;
}
