import fs from "fs-extra";
import path from "path";
import { ConfigSchema, EconomicsConfig } from "./types";

export async function loadConfig(): Promise<EconomicsConfig> {
  // Assuming run from repo root or tool root, try to find config
  const possiblePaths = [
    path.join(process.cwd(), "config", "economics.json"),
    path.join(process.cwd(), "..", "..", "config", "economics.json"),
  ];

  const configPath = possiblePaths.find((p) => fs.existsSync(p));
  if (!configPath) throw new Error(`Config not found in: ${possiblePaths.join(", ")}`);

  const raw = await fs.readJson(configPath);
  return ConfigSchema.parse(raw);
}
