import fs from "fs";
import path from "path";
import type { DglViolation } from "./types.js";

export interface OpenApiCompatResult {
  violations: DglViolation[];
  summary: { scanned_specs: string[]; breaking: number; warnings: number };
  endpoint_diffs: Array<{ method: string; path: string; level: "error" | "warn"; message: string }>;
}

interface CompatConfig {
  allowlisted_endpoints?: string[];
  allowlisted_status_shifts?: Array<{ endpoint: string; from: number; to: number }>;
  path_prefixes?: string[];
}

function parseScalar(v: string): any {
  const t = v.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^\d+$/.test(t)) return Number(t);
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) return t.slice(1, -1);
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1).split(",").map((x) => parseScalar(x));
  if (t.startsWith("{") && t.endsWith("}")) {
    const out: Record<string, any> = {};
    const body = t.slice(1, -1).trim();
    if (!body) return out;
    for (const pair of body.split(",")) {
      const [k, ...rest] = pair.split(":");
      out[k.trim()] = parseScalar(rest.join(":").trim());
    }
    return out;
  }
  return t;
}

function parseYamlLike(raw: string): any {
  const root: any = {};
  const stack: Array<{ indent: number; key: string | null; obj: any }> = [{ indent: -1, key: null, obj: root }];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (trimmed.startsWith("- ")) {
      const item = trimmed.slice(2);
      const arr = Array.isArray(parent) ? parent : (stack[stack.length - 1].obj = []);
      if (item.includes(":")) {
        const [k, ...rest] = item.split(":");
        const o: any = {};
        o[k.trim()] = rest.join(":").trim() ? parseScalar(rest.join(":").trim()) : {};
        arr.push(o);
        stack.push({ indent, key: k.trim(), obj: o });
      } else {
        arr.push(parseScalar(item));
      }
      continue;
    }
    const [k, ...rest] = trimmed.split(":");
    const valueRaw = rest.join(":").trim();
    if (valueRaw) {
      parent[k.trim()] = parseScalar(valueRaw);
    } else {
      parent[k.trim()] = {};
      stack.push({ indent, key: k.trim(), obj: parent[k.trim()] });
    }
  }
  return root;
}

function readSpec(filePath: string): any {
  const raw = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) return JSON.parse(raw);
  return parseYamlLike(raw);
}


function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];
  return Object.values(v);
}

function methodsFor(spec: any): Array<{ method: string; path: string; op: any }> {
  const paths = spec?.paths ?? {};
  const out: Array<{ method: string; path: string; op: any }> = [];
  for (const [p, item] of Object.entries<any>(paths)) {
    for (const m of ["get", "post", "put", "patch", "delete", "head", "options"]) {
      if (item?.[m]) out.push({ method: m.toUpperCase(), path: p, op: item[m] });
    }
  }
  return out;
}

function schemaSignature(schema: any): string { return JSON.stringify(schema ?? {}); }
function parseConfig(root: string): CompatConfig {
  const cfgPath = path.join(root, "config", "dgl-openapi.json");
  if (!fs.existsSync(cfgPath)) return {};
  return JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
}

export function discoverOpenApiSpecs(root: string): string[] {
  return ["openapi.yaml", "openapi.yml", "openapi.json", "openapi/reach.openapi.yaml"].map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
}

export function compareOpenApi(baseSpecPath: string, headSpecPath: string, root: string): OpenApiCompatResult {
  const base = readSpec(baseSpecPath); const head = readSpec(headSpecPath); const cfg = parseConfig(root);
  const baseOps = methodsFor(base); const headOps = methodsFor(head);
  const headMap = new Map(headOps.map((o) => [`${o.method} ${o.path}`, o]));
  const violations: DglViolation[] = []; const endpoint_diffs: OpenApiCompatResult["endpoint_diffs"] = [];

  for (const baseOp of baseOps) {
    const key = `${baseOp.method} ${baseOp.path}`;
    if (cfg.path_prefixes?.length && !cfg.path_prefixes.some((p) => baseOp.path.startsWith(p))) continue;
    if (cfg.allowlisted_endpoints?.includes(key)) continue;
    const next = headMap.get(key);
    if (!next) { violations.push({ type: "openapi", severity: "error", paths: [headSpecPath], line: 1, evidence: `Removed endpoint ${key}`, suggested_fix: "Restore endpoint or add explicit acknowledgement under dgl/intent-acknowledgements/." }); continue; }

    const bp = new Set(asArray(baseOp.op.parameters).filter((p: any) => p.required).map((p: any) => `${p.in}:${p.name}`));
    const np = new Set(asArray(next.op.parameters).filter((p: any) => p.required).map((p: any) => `${p.in}:${p.name}`));
    for (const p of np) if (!bp.has(p)) violations.push({ type: "openapi", severity: "error", paths: [headSpecPath], line: 1, evidence: `New required parameter ${p} in ${key}`, suggested_fix: "Make parameter optional, version the endpoint, or acknowledge intentionally breaking change." });

    const baseResp = Object.keys(baseOp.op.responses ?? {}); const nextResp = Object.keys(next.op.responses ?? {});
    for (const status of baseResp) if (!nextResp.includes(status)) {
      const shift = cfg.allowlisted_status_shifts?.some((s) => s.endpoint === key && s.from === Number(status) && nextResp.includes(String(s.to)));
      if (!shift) violations.push({ type: "openapi", severity: "error", paths: [headSpecPath], line: 1, evidence: `Removed documented response ${status} for ${key}`, suggested_fix: "Restore status code or add allowlist entry in config/dgl-openapi.json." });
    }

    const bs = schemaSignature(baseOp.op.responses?.["200"]?.content?.["application/json"]?.schema);
    const ns = schemaSignature(next.op.responses?.["200"]?.content?.["application/json"]?.schema);
    if (bs && ns && bs !== ns) {
      const bReq = new Set(baseOp.op.responses?.["200"]?.content?.["application/json"]?.schema?.required ?? []);
      const nReq = new Set(next.op.responses?.["200"]?.content?.["application/json"]?.schema?.required ?? []);
      const addedReq = [...nReq].filter((r) => !bReq.has(r));
      const bProps = Object.keys(baseOp.op.responses?.["200"]?.content?.["application/json"]?.schema?.properties ?? {});
      const nProps = Object.keys(next.op.responses?.["200"]?.content?.["application/json"]?.schema?.properties ?? {});
      const removedProps = bProps.filter((p) => !nProps.includes(p));
      violations.push({ type: "openapi", severity: removedProps.length || addedReq.length ? "error" : "warn", paths: [headSpecPath], line: 1, evidence: `Response schema change for ${key}`, suggested_fix: "Keep response backward compatible or acknowledge intentional contract break." });
    }
  }

  for (const v of violations) endpoint_diffs.push({ method: "*", path: v.paths[0], level: v.severity === "error" ? "error" : "warn", message: v.evidence });
  const summary = { scanned_specs: [baseSpecPath, headSpecPath], breaking: violations.filter((v) => v.severity === "error").length, warnings: violations.filter((v) => v.severity === "warn").length };
  return { violations, summary, endpoint_diffs };
}
