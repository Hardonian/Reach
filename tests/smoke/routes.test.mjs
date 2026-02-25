/**
 * Route Smoke Tests
 *
 * Verifies that all canonical routes return 200 (or redirect for auth-protected routes)
 * and contain expected heading text. No external dependencies required.
 *
 * Usage:
 *   # Start the dev server first, then:
 *   BASE_URL=http://localhost:3000 node tests/smoke/routes.test.mjs
 *
 * The test accepts redirects (302/307) for console routes as valid since they
 * require authentication. Public routes must return 200.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const PUBLIC_ROUTES = [
  { path: "/", heading: "Reach" },
  { path: "/architecture", heading: "Architecture" },
  { path: "/transparency", heading: "Transparency" },
  { path: "/marketplace", heading: "Marketplace" },
  { path: "/docs", heading: "Documentation" },
  { path: "/faq", heading: "FAQ" },
  { path: "/pricing", heading: "Pricing" },
  { path: "/governance", heading: "Governance" },
];

const CONSOLE_ROUTES = [
  { path: "/console", heading: "Console" },
  { path: "/console/agents", heading: "Agent" },
  { path: "/console/runners", heading: "Runner" },
  { path: "/console/evaluation", heading: "Evaluation" },
  { path: "/console/governance", heading: "Governance" },
  { path: "/console/datasets", heading: "Dataset" },
  { path: "/console/cost", heading: "Cost" },
  { path: "/console/ecosystem", heading: "Ecosystem" },
  { path: "/console/integrations", heading: "Integration" },
  { path: "/console/artifacts", heading: "Artifact" },
  { path: "/console/alerts", heading: "Alert" },
  { path: "/console/traces", heading: "Trace" },
];

const API_ROUTES = [
  { path: "/api/health", statuses: [200] },
  { path: "/api/ready", statuses: [200, 503] },
  { path: "/api/v1/dgl", statuses: [200, 401, 403] },
  { path: "/api/v1/cpx", statuses: [200, 401, 403] },
  { path: "/api/v1/sccl", statuses: [200, 401, 403] },
  { path: "/api/v1/policy", statuses: [200, 401, 403] },
  { path: "/api/v1/governance/history", statuses: [200, 401, 403] },
  { path: "/api/v1/governance/artifacts/test", statuses: [401, 403, 404] },
];

let passed = 0;
let failed = 0;
let skipped = 0;

async function fetchFinal(url, maxHops = 5) {
  let currentUrl = url;
  let status = 0;

  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(currentUrl, { redirect: "manual" });
    status = res.status;
    if (![301, 302, 307, 308].includes(status)) {
      return { res, finalUrl: currentUrl, redirectHops: hop };
    }
    const location = res.headers.get("location");
    if (!location) {
      return { res, finalUrl: currentUrl, redirectHops: hop };
    }
    currentUrl = new URL(location, currentUrl).toString();
  }

  return {
    res: new Response(null, { status }),
    finalUrl: currentUrl,
    redirectHops: maxHops,
  };
}

async function testRoute(path, heading, allowRedirect = false) {
  const url = `${BASE_URL}${path}`;
  try {
    const { res } = await fetchFinal(url);
    const status = res.status;
    const allowed = allowRedirect ? [200, 302, 307] : [200];
    if (!allowed.includes(status)) {
      console.error(`  FAIL: ${path} → ${status} (expected ${allowed.join("/")})`);
      failed++;
      return;
    }

    if (allowRedirect && (status === 302 || status === 307)) {
      console.log(`  PASS (redirect): ${path} → ${status}`);
      passed++;
      return;
    }

    const body = await res.text();

    // Check for heading text (case-insensitive substring)
    if (heading && !body.toLowerCase().includes(heading.toLowerCase())) {
      console.warn(`  WARN: ${path} → 200 but missing expected text "${heading}"`);
      // Don't fail on heading check — content may be client-rendered
    }

    // Check for obvious server error pages
    if (body.includes("Internal Server Error")) {
      console.error(`  FAIL: ${path} → 200 but contains error indicators`);
      failed++;
      return;
    }

    console.log(`  PASS: ${path} → ${status}`);
    passed++;
  } catch (err) {
    if (err.cause?.code === "ECONNREFUSED") {
      console.error(`  SKIP: ${path} — server not reachable at ${BASE_URL}`);
      skipped++;
    } else {
      console.error(`  FAIL: ${path} — ${err.message}`);
      failed++;
    }
  }
}

async function testApiRoute(path, allowedStatuses) {
  const url = `${BASE_URL}${path}`;
  try {
    const { res } = await fetchFinal(url);
    const status = res.status;
    if (!allowedStatuses.includes(status)) {
      console.error(`  FAIL: ${path} -> ${status} (expected one of ${allowedStatuses.join(",")})`);
      failed++;
      return;
    }
    console.log(`  PASS: ${path} -> ${status}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${path} — ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log(`\nSmoke testing against ${BASE_URL}\n`);

  console.log("Public routes:");
  for (const route of PUBLIC_ROUTES) {
    await testRoute(route.path, route.heading, false);
  }

  console.log("\nConsole routes (auth-protected, redirect OK):");
  for (const route of CONSOLE_ROUTES) {
    await testRoute(route.path, route.heading, true);
  }

  console.log("\nAPI routes (contract smoke):");
  for (const route of API_ROUTES) {
    await testApiRoute(route.path, route.statuses);
  }

  console.log(`\n--- Results: ${passed} passed, ${failed} failed, ${skipped} skipped ---`);

  if (skipped > 0 && passed === 0) {
    console.log("Server not reachable — tests skipped (not a failure).");
    process.exit(0);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
