import type { DglViolation } from "./types.js";

function lineOf(content: string, needle: string): number {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.includes(needle));
  return idx >= 0 ? idx + 1 : 1;
}

function readJson(input: string): Record<string, unknown> | null {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function compareRequired(filePath: string, baseObj: Record<string, unknown>, headObj: Record<string, unknown>, baseText: string, headText: string): DglViolation[] {
  const violations: DglViolation[] = [];
  const baseReq = new Set(((baseObj.required as unknown[]) ?? []).map(String));
  const headReq = new Set(((headObj.required as unknown[]) ?? []).map(String));

  for (const field of baseReq) {
    if (!headReq.has(field)) {
      violations.push({
        type: "api_contract",
        severity: "error",
        paths: [filePath],
        evidence: `Required field removed: '${field}'.`,
        suggested_fix: "Retain required field or version the contract with migration guidance.",
        line: lineOf(baseText, `\"${field}\"`),
      });
    }
  }
  for (const field of headReq) {
    if (!baseReq.has(field)) {
      violations.push({
        type: "api_contract",
        severity: "warn",
        paths: [filePath],
        evidence: `New required field added: '${field}'.`,
        suggested_fix: "Ensure clients can provide this field or make it optional with defaults.",
        line: lineOf(headText, `\"${field}\"`),
      });
    }
  }
  return violations;
}

function compareEnums(filePath: string, baseObj: Record<string, unknown>, headObj: Record<string, unknown>, baseText: string, headText: string, prefix = "root"): DglViolation[] {
  const violations: DglViolation[] = [];
  const baseEnum = Array.isArray(baseObj.enum) ? new Set(baseObj.enum.map(String)) : null;
  const headEnum = Array.isArray(headObj.enum) ? new Set(headObj.enum.map(String)) : null;

  if (baseEnum || headEnum) {
    const b = baseEnum ?? new Set<string>();
    const h = headEnum ?? new Set<string>();
    for (const v of b) {
      if (!h.has(v)) {
        violations.push({
          type: "api_contract",
          severity: "error",
          paths: [filePath],
          evidence: `Enum value removed at ${prefix}: '${v}'.`,
          suggested_fix: "Avoid removing enum values on public surfaces; deprecate first.",
          line: lineOf(baseText, `\"${v}\"`),
        });
      }
    }
    for (const v of h) {
      if (!b.has(v)) {
        violations.push({
          type: "api_contract",
          severity: "warn",
          paths: [filePath],
          evidence: `Enum value added at ${prefix}: '${v}'.`,
          suggested_fix: "Document new enum semantics and client handling.",
          line: lineOf(headText, `\"${v}\"`),
        });
      }
    }
  }

  const baseProps = asRecord(baseObj.properties);
  const headProps = asRecord(headObj.properties);
  const keys = new Set([...Object.keys(baseProps), ...Object.keys(headProps)]);
  for (const k of keys) {
    violations.push(...compareEnums(filePath, asRecord(baseProps[k]), asRecord(headProps[k]), baseText, headText, `${prefix}.properties.${k}`));
  }

  return violations;
}

function compareSchemaProperties(filePath: string, baseObj: Record<string, unknown>, headObj: Record<string, unknown>, baseText: string, headText: string): DglViolation[] {
  const violations: DglViolation[] = [];
  const baseProps = new Set(Object.keys(asRecord(baseObj.properties)));
  const headProps = new Set(Object.keys(asRecord(headObj.properties)));

  for (const prop of baseProps) {
    if (!headProps.has(prop)) {
      violations.push({
        type: "api_contract",
        severity: "error",
        paths: [filePath],
        evidence: `Schema property removed: '${prop}'.`,
        suggested_fix: "Avoid removing public schema fields or add versioned compatibility migration.",
        line: lineOf(baseText, `\"${prop}\"`),
      });
    }
  }

  for (const prop of headProps) {
    if (!baseProps.has(prop)) {
      violations.push({
        type: "api_contract",
        severity: "warn",
        paths: [filePath],
        evidence: `Schema property added: '${prop}'.`,
        suggested_fix: "Document the new field and client compatibility expectations.",
        line: lineOf(headText, `\"${prop}\"`),
      });
    }
  }

  violations.push(...compareRequired(filePath, baseObj, headObj, baseText, headText));
  violations.push(...compareEnums(filePath, baseObj, headObj, baseText, headText));
  return violations;
}

function openApiPaths(text: string): Set<string> {
  const paths = new Set<string>();
  const lines = text.split("\n");
  let inPaths = false;
  for (const line of lines) {
    if (/^paths:\s*$/.test(line.trim())) {
      inPaths = true;
      continue;
    }
    if (inPaths && /^\w/.test(line)) inPaths = false;
    if (!inPaths) continue;
    const m = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (m) paths.add(m[1]);
  }
  return paths;
}

function diffOpenApiYaml(filePath: string, baseText: string, headText: string): DglViolation[] {
  const violations: DglViolation[] = [];
  const base = openApiPaths(baseText);
  const head = openApiPaths(headText);

  for (const p of base) {
    if (!head.has(p)) {
      violations.push({
        type: "api_contract",
        severity: "error",
        paths: [filePath],
        evidence: `OpenAPI path removed: '${p}'.`,
        suggested_fix: "Restore path or add a deprecation window with migration docs.",
        line: lineOf(baseText, `${p}:`),
      });
    }
  }
  for (const p of head) {
    if (!base.has(p)) {
      violations.push({
        type: "api_contract",
        severity: "warn",
        paths: [filePath],
        evidence: `OpenAPI path added: '${p}'.`,
        suggested_fix: "Verify auth, tenancy, and backward compatibility for the new path.",
        line: lineOf(headText, `${p}:`),
      });
    }
  }

  return violations;
}

function routeMethodDiff(filePath: string, baseText: string, headText: string): DglViolation[] {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const exportMethod = (txt: string, m: string) => new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(txt);
  const violations: DglViolation[] = [];

  for (const method of methods) {
    const had = exportMethod(baseText, method);
    const has = exportMethod(headText, method);
    if (had && !has) {
      violations.push({
        type: "api_contract",
        severity: "error",
        paths: [filePath],
        evidence: `HTTP method handler removed: ${method}.`,
        suggested_fix: "Restore removed route handler or provide deprecation/migration path.",
        line: lineOf(baseText, `function ${method}`),
      });
    }
    if (!had && has) {
      violations.push({
        type: "api_contract",
        severity: "warn",
        paths: [filePath],
        evidence: `HTTP method handler added: ${method}.`,
        suggested_fix: "Confirm auth, rate-limit, and tenancy checks for new endpoint.",
        line: lineOf(headText, `function ${method}`),
      });
    }
  }

  return violations;
}

export function diffApiContract(filePath: string, baseText: string, headText: string): DglViolation[] {
  if (/openapi\/.+\.ya?ml$/.test(filePath) || /openapi:\s*3\./.test(baseText) || /openapi:\s*3\./.test(headText)) {
    return diffOpenApiYaml(filePath, baseText, headText);
  }

  if (filePath.endsWith(".json") || filePath.includes("schema")) {
    const baseObj = readJson(baseText);
    const headObj = readJson(headText);
    if (!baseObj || !headObj) {
      return [{
        type: "api_contract",
        severity: "warn",
        paths: [filePath],
        evidence: "Could not parse JSON contract for structural diff.",
        suggested_fix: "Ensure the contract file is valid JSON.",
        line: 1,
      }];
    }

    const schemasBase = asRecord(asRecord(baseObj.components).schemas);
    const schemasHead = asRecord(asRecord(headObj.components).schemas);
    const hasOpenApiSchemas = Object.keys(schemasBase).length > 0 || Object.keys(schemasHead).length > 0;
    if (hasOpenApiSchemas) {
      const out: DglViolation[] = [];
      const keys = new Set([...Object.keys(schemasBase), ...Object.keys(schemasHead)]);
      for (const key of keys) {
        out.push(...compareSchemaProperties(filePath, asRecord(schemasBase[key]), asRecord(schemasHead[key]), baseText, headText));
      }
      return out;
    }

    return compareSchemaProperties(filePath, baseObj, headObj, baseText, headText);
  }

  if (filePath.includes("/api/") && filePath.endsWith("route.ts")) {
    return routeMethodDiff(filePath, baseText, headText);
  }

  return [];
}
