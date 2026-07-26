import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

export type RunRecord = {
  run_id: string;
  timestamp: string;
  violations?: Array<{ severity?: string }>;
  status?: "passed" | "failed";
  governed?: boolean;
  [key: string]: unknown;
};

export function runStatus(record: RunRecord): "passed" | "failed" {
  if (record.status) return record.status;
  return (record.violations ?? []).some((v) => v.severity === "error") ? "failed" : "passed";
}

export function exportRun(runFile: string, outputZip: string): void {
  const record = JSON.parse(fs.readFileSync(runFile, "utf8")) as RunRecord & { dgl_report_paths?: string[] };
  const files = [runFile, ...(record.dgl_report_paths ?? [])].map((item) => path.resolve(item));
  for (const file of files) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`run evidence file not found: ${file}`);
  }
  fs.mkdirSync(path.dirname(path.resolve(outputZip)), { recursive: true });
  execFileSync("zip", ["-j", path.resolve(outputZip), ...files], { stdio: "ignore" });
}
