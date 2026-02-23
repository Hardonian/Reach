import { loadConfig } from "../core/env.js";
// @ts-nocheck
/**
 * Studio CLI Module
 *
 * Commands:
 *   zeo studio             Launch Zeo Studio (opens browser + starts dev server)
 *   zeo export-report <id> Generate signed run report (JSON + HTML + SHA-256)
 *   zeo verify-report <f>  Verify a signed report's SHA-256 integrity
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hashString } from "../determinism/index.js";
import { execSync, spawn, type ChildProcess } from "node:child_process";

// ─── Studio Launch ───────────────────────────────────────────────────────────

export async function runStudioCommand(argv: string[]): Promise<number> {
  const port = argv.includes("--port") ? argv[argv.indexOf("--port") + 1] : "3000";
  const noBrowser = argv.includes("--no-browser");

  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║           🧬 Zeo Studio — Local Workbench        ║
║                                                  ║
║  Run, Replay, Diff, Evidence, Tools, Compliance  ║
║  Local-first · Deterministic · No network calls  ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);

  console.log(`Starting Studio on http://localhost:${port}/studio ...`);

  // Check if apps/web exists
  const webDir = join(process.cwd(), "apps", "web");
  const hasWeb = existsSync(join(webDir, "package.json"));

  if (!hasWeb) {
    console.log("\n⚠ apps/web not found. Ensure you're in the Zeo project root.\n");
    console.log("  You can still access Studio by running 'pnpm --filter web dev' manually,");
    console.log("  then navigating to http://localhost:3000/studio");
    return 1;
  }

  // Try to open dev server
  try {
    const env = { ...process.env, PORT: String(loadConfig().PORT || port) };
    let child: ChildProcess;

    const isWindows = process.platform === "win32";
    if (isWindows) {
      child = spawn("npx.cmd", ["next", "dev", "--port", port], {
        cwd: webDir,
        env,
        stdio: "pipe",
      });
    } else {
      child = spawn("npx", ["next", "dev", "--port", port], {
        cwd: webDir,
        env,
        stdio: "pipe",
      });
    }

    child.stdout?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.log(`  [studio] ${line}`);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line && !line.includes("ExperimentalWarning")) {
        console.log(`  [studio] ${line}`);
      }
    });

    // Open browser after a short delay
    if (!noBrowser) {
      setTimeout(() => {
        const url = `http://localhost:${port}/studio`;
        try {
          if (isWindows) execSync(`start ${url}`, { stdio: "ignore" });
          else if (process.platform === "darwin") execSync(`open ${url}`, { stdio: "ignore" });
          else execSync(`xdg-open ${url}`, { stdio: "ignore" });
        } catch {
          console.log(`\n  Open in browser: ${url}\n`);
        }
      }, 3000);
    }

    // Wait for process
    return new Promise<number>((resolve) => {
      child.on("exit", (code) => resolve(code ?? 0));
      process.on("SIGINT", () => {
        child.kill();
        resolve(0);
      });
    });
  } catch (e) {
    console.error(`Failed to start Studio: ${(e as Error).message}`);
    console.log("\nManual start:");
    console.log("  cd apps/web && pnpm dev");
    console.log(`  Then open: http://localhost:${port}/studio\n`);
    return 1;
  }
}

// ─── Export Report ───────────────────────────────────────────────────────────

export async function runExportReportCommand(argv: string[]): Promise<number> {
  const runId = argv[0];
  if (!runId) {
    console.error("Usage: zeo export-report <run_id> [--out <dir>]");
    console.error("\nGenerates a signed run report containing:");
    console.error("  • Run metadata, spec, evaluations, explanation");
    console.error("  • Replay verification (if possible)");
    console.error("  • Evidence graph summary");
    console.error("  • Tool registry state");
    console.error("  • Compliance report");
    console.error("  • SHA-256 signature for integrity verification\n");
    console.error("Output: <run_id>-report.json and <run_id>-report.html");
    return 1;
  }

  const outDir = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : process.cwd();

  try {
    const core = await import("@zeo/core");
    const snapshot = core.loadSnapshot(runId);
    if (!snapshot) {
      console.error(`❌ Snapshot not found: ${runId}`);
      console.error("Run 'zeo snapshots' to list available runs.");
      return 1;
    }

    console.log(`📋 Generating signed report for ${runId}...`);

    // Gather run data
    const runData = {
      runId: snapshot.runId,
      createdAt: snapshot.createdAt,
      deterministic: snapshot.deterministic,
      inputHash: snapshot.inputHash,
      outputHash: snapshot.outputHash,
      chainHash: snapshot.chainHash,
      durationMs: snapshot.durationMs,
      title: snapshot.input.spec.title,
      nodeCount: snapshot.output?.graph.nodes.length ?? 0,
      edgeCount: snapshot.output?.graph.edges.length ?? 0,
      seed: snapshot.seed,
      spec: snapshot.input.spec,
      evaluations: snapshot.output?.evaluations ?? [],
      explanation: snapshot.output?.explanation ?? {
        why: [],
        whatWouldChange: [],
      },
      nextBestEvidence: snapshot.output?.nextBestEvidence ?? [],
    };

    // Replay
    let replayData:
      | {
          verdict: string;
          originalOutputHash: string;
          replayOutputHash: string;
          durationMs: number;
        }
      | undefined;
    try {
      console.log("  🔁 Running replay verification...");
      const replayResult = core.replayRun(runId);
      replayData = {
        verdict: replayResult.verdict,
        originalOutputHash: replayResult.originalOutputHash,
        replayOutputHash: replayResult.replayOutputHash,
        durationMs: replayResult.durationMs,
      };
      console.log(`     Replay: ${replayResult.verdict}`);
    } catch (e) {
      console.log(`     Replay: skipped (${(e as Error).message})`);
    }

    // Evidence
    let evidenceNodes: unknown[] = [];
    try {
      const graph = core.loadEvidenceGraph();
      evidenceNodes = graph.nodes;
    } catch {
      // No evidence graph
    }

    // Tools
    const toolRegistry = core.getDefaultToolRegistry();

    // Build report
    const report: Record<string, unknown> = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      run: runData,
      replay: replayData,
      evidence: evidenceNodes,
      tools: toolRegistry.tools,
      signature: "", // Computed below
    };

    // Compute signature
    const toSign = { ...report };
    delete toSign.signature;
    const normalized = JSON.stringify(toSign, Object.keys(toSign).sort(), 0);
    const signature = hashString(normalized);
    report.signature = signature;

    // Write JSON
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, `${runId}-report.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`  ✅ JSON report: ${jsonPath}`);

    // Write HTML
    const htmlPath = join(outDir, `${runId}-report.html`);
    const htmlContent = generateCliHtmlReport(report);
    writeFileSync(htmlPath, htmlContent, "utf8");
    console.log(`  ✅ HTML report: ${htmlPath}`);

    console.log(`\n  Signature: ${signature}`);
    console.log(`  Verify:    zeo verify-report ${jsonPath}\n`);

    return 0;
  } catch (e) {
    console.error(`❌ Report generation failed: ${(e as Error).message}`);
    return 1;
  }
}

// ─── Verify Report ───────────────────────────────────────────────────────────

export async function runVerifyReportCommand(argv: string[]): Promise<number> {
  const filePath = argv[0];
  if (!filePath) {
    console.error("Usage: zeo verify-report <report.json>");
    console.error("\nVerifies the SHA-256 signature of a signed run report.");
    return 1;
  }

  try {
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return 1;
    }

    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);
    const reportedSignature = parsed.signature;

    if (!reportedSignature) {
      console.error("❌ No signature found in report.");
      return 1;
    }

    // Recompute
    const toVerify = { ...parsed };
    delete toVerify.signature;
    const normalized = JSON.stringify(toVerify, Object.keys(toVerify).sort(), 0);
    const computedSignature = hashString(normalized);

    const valid = computedSignature === reportedSignature;

    console.log(`\n📋 Report Verification: ${filePath}\n`);
    console.log(`  Run ID:    ${parsed.run?.runId ?? "unknown"}`);
    console.log(`  Generated: ${parsed.generatedAt ?? "unknown"}`);
    console.log(`  Version:   ${parsed.version ?? "unknown"}`);
    console.log();
    console.log(`  Reported:  ${reportedSignature}`);
    console.log(`  Computed:  ${computedSignature}`);
    console.log();

    if (valid) {
      console.log("  ✅ VALID — Report integrity verified.\n");
      return 0;
    } else {
      console.log("  ❌ INVALID — Report has been modified since signing.\n");
      return 1;
    }
  } catch (e) {
    console.error(`❌ Verification failed: ${(e as Error).message}`);
    return 1;
  }
}

// ─── HTML Report Generator (CLI) ─────────────────────────────────────────────

function generateCliHtmlReport(report: Record<string, unknown>): string {
  const run = report.run as Record<string, unknown>;
  const replay = report.replay as Record<string, unknown> | undefined;
  const evidence = (report.evidence as Array<Record<string, unknown>>) ?? [];
  const tools = (report.tools as Array<Record<string, unknown>>) ?? [];
  const sig = String(report.signature ?? "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zeo Run Report — ${run.runId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem;max-width:900px;margin:0 auto}
  h1{font-size:1.5rem;margin-bottom:.25rem;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  h2{font-size:1rem;margin:1.5rem 0 .75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
  .meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem;margin-bottom:1.5rem}
  .meta-item{background:#1e293b;padding:.75rem 1rem;border-radius:.5rem;border:1px solid #334155}
  .meta-item .label{font-size:.7rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
  .meta-item .val{font-family:ui-monospace,monospace;font-size:.85rem;color:#f1f5f9;margin-top:.125rem}
  .section{border:1px solid #334155;border-radius:.75rem;padding:1.25rem;margin-bottom:1rem;background:#1e293b80}
  .badge{display:inline-block;font-size:.7rem;font-weight:600;padding:.15rem .5rem;border-radius:9999px}
  .badge-pass{background:#06592244;color:#4ade80;border:1px solid #4ade8033}
  .badge-drift{background:#7c290044;color:#f87171;border:1px solid #f8717133}
  .badge-det{background:#1e40af33;color:#60a5fa;border:1px solid #60a5fa33}
  table{width:100%;border-collapse:collapse;font-size:.8rem}
  th{text-align:left;padding:.5rem;color:#64748b;border-bottom:1px solid #334155;font-size:.7rem;text-transform:uppercase}
  td{padding:.5rem;border-bottom:1px solid #1e293b}
  code{font-family:ui-monospace,monospace;font-size:.8rem;background:#0f172a;padding:.1rem .3rem;border-radius:.25rem}
  .sig{margin-top:2rem;padding:1rem;background:#0f172a;border:1px solid #334155;border-radius:.5rem;word-break:break-all;font-family:ui-monospace,monospace;font-size:.75rem;color:#64748b}
  footer{margin-top:2rem;text-align:center;font-size:.75rem;color:#475569}
</style>
</head>
<body>
<h1>Zeo Signed Run Report</h1>
<p style="color:#94a3b8;font-size:.85rem;margin-bottom:1.5rem">Generated ${String(report.generatedAt)} • Report v${String(report.version)}</p>

<h2>Run Metadata</h2>
<div class="meta">
  <div class="meta-item"><div class="label">Run ID</div><div class="val">${run.runId}</div></div>
  <div class="meta-item"><div class="label">Title</div><div class="val">${run.title}</div></div>
  <div class="meta-item"><div class="label">Created</div><div class="val">${run.createdAt}</div></div>
  <div class="meta-item"><div class="label">Duration</div><div class="val">${run.durationMs}ms</div></div>
  <div class="meta-item"><div class="label">Mode</div><div class="val">${run.deterministic ? '<span class="badge badge-det">DETERMINISTIC</span>' : "Standard"}</div></div>
  <div class="meta-item"><div class="label">Input Hash</div><div class="val"><code>${String(run.inputHash).slice(0, 24)}…</code></div></div>
  <div class="meta-item"><div class="label">Output Hash</div><div class="val"><code>${String(run.outputHash).slice(0, 24)}…</code></div></div>
  <div class="meta-item"><div class="label">Chain Hash</div><div class="val"><code>${String(run.chainHash).slice(0, 24)}…</code></div></div>
</div>

${
  replay
    ? `
<h2>Replay Verification</h2>
<div class="section">
  <span class="badge ${String(replay.verdict) === "PASS" ? "badge-pass" : "badge-drift"}">${replay.verdict}</span>
  <p style="margin-top:.5rem;font-size:.85rem">Original: <code>${replay.originalOutputHash}</code></p>
  <p style="font-size:.85rem">Replay: <code>${replay.replayOutputHash}</code></p>
  <p style="font-size:.85rem;color:#94a3b8">Duration: ${replay.durationMs}ms</p>
</div>`
    : '<h2>Replay</h2><p style="color:#64748b;font-size:.85rem">Not replayed.</p>'
}

<h2>Evidence (${evidence.length} nodes)</h2>
${
  evidence.length > 0
    ? `<table>
  <tr><th>ID</th><th>Claim</th><th>Confidence</th><th>Source</th></tr>
  ${evidence
    .slice(0, 20)
    .map(
      (e) =>
        `<tr><td><code>${e.id}</code></td><td>${e.claim}</td><td>${(((e.confidenceScore as number) ?? 0) * 100).toFixed(0)}%</td><td>${e.source}</td></tr>`,
    )
    .join("")}
</table>`
    : '<p style="color:#64748b;font-size:.85rem">No evidence nodes.</p>'
}

<h2>Tools (${tools.length})</h2>
<table>
  <tr><th>Tool</th><th>Version</th><th>Status</th></tr>
  ${tools.map((t) => `<tr><td>${t.name}</td><td>${t.version}</td><td>${t.status}</td></tr>`).join("")}
</table>

<div class="sig">
  <strong>Report Signature (SHA-256):</strong><br>${sig}
</div>
<footer>Zeo Studio • Signed Run Report • Verify with: <code>zeo verify-report report.json</code></footer>
</body>
</html>`;
}
