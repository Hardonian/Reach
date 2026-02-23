import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "../../..");
const ARCADE_APP_ROOT = path.join(REPO_ROOT, "apps/arcade/src/app");
const ARTIFACTS_DIR = path.join(REPO_ROOT, ".artifacts/docs-drift");
const ALLOWLIST_PATH = path.join(__dirname, "claims.allowlist.json");

const HIGH_RISK_CLAIMS = [
  "SOC2",
  "HIPAA",
  "PCI",
  "fully offline",
  "end-to-end encrypted",
  "zero data stored",
  "100% secure",
  "unbreakable",
];

interface ClaimIssue {
  file: string;
  claim: string;
  context: string;
}

interface ClaimsReport {
  timestamp: string;
  issues: ClaimIssue[];
}

function walk(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, callback);
    } else {
      callback(filePath);
    }
  }
}

function getAllowlist(): Set<string> {
  if (fs.existsSync(ALLOWLIST_PATH)) {
    const data = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf-8"));
    return new Set(data.allowlist.map((c: string) => c.toLowerCase()));
  }
  return new Set();
}

function scanClaims() {
  console.log("--- Feature Claims Sanity Check ---");
  const allowlist = getAllowlist();
  const issues: ClaimIssue[] = [];

  walk(ARCADE_APP_ROOT, (filePath) => {
    if (!filePath.endsWith(".tsx") && !filePath.endsWith(".mdx")) return;

    const content = fs.readFileSync(filePath, "utf-8");
    const lowerContent = content.toLowerCase();

    for (const claim of HIGH_RISK_CLAIMS) {
      if (lowerContent.includes(claim.toLowerCase())) {
        if (!allowlist.has(claim.toLowerCase())) {
          // Extract context
          const index = lowerContent.indexOf(claim.toLowerCase());
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + claim.length + 50);
          const context = content.substring(start, end).replace(/\n/g, " ").trim();

          issues.push({
            file: path.relative(REPO_ROOT, filePath),
            claim,
            context: `...${context}...`,
          });
        }
      }
    }
  });

  const report: ClaimsReport = {
    timestamp: new Date().toISOString(),
    issues,
  };

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const reportPath = path.join(ARTIFACTS_DIR, "claims.report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (issues.length > 0) {
    console.warn(`Found ${issues.length} high-risk marketing claims in docs:`);
    issues.forEach((issue) => {
      console.log(`[CLAIM] ${issue.file}: "${issue.claim}" found in context: ${issue.context}`);
      console.log(
        `Action: Verify this claim in SECURITY.md or add to tools/docs/drift/claims.allowlist.json`,
      );
    });
    process.exit(1);
  } else {
    console.log("No unverified high-risk claims found!");
  }
}

scanClaims();
