import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "../../..");
const ARCADE_APP_ROOT = path.join(REPO_ROOT, "apps/arcade/src/app");
const ARTIFACTS_DIR = path.join(REPO_ROOT, ".artifacts/docs-drift");

interface LinkIssue {
  file: string;
  link: string;
  type: "404" | "casing" | "slash";
  suggestion?: string;
}

interface Report {
  timestamp: string;
  totalFilesChecked: number;
  totalLinksFound: number;
  issues: LinkIssue[];
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

function getRoutes(): Set<string> {
  const routes = new Set<string>();
  walk(ARCADE_APP_ROOT, (filePath) => {
    const relative = path.relative(ARCADE_APP_ROOT, filePath);
    const parts = relative.split(path.sep);

    // Skip special files that aren't routes
    if (
      parts.some(
        (p) => p.startsWith("_") || p.startsWith("(") || p.startsWith("["),
      )
    ) {
      // Logic for catch-all or grouped routes could be added here if needed
      // For now, we'll keep it simple
    }

    const filename = parts[parts.length - 1];
    if (filename === "page.tsx" || filename === "route.ts") {
      let routePath = "/" + parts.slice(0, -1).join("/");
      if (routePath === "//") routePath = "/";
      if (routePath.length > 1 && routePath.endsWith("/"))
        routePath = routePath.slice(0, -1);

      // Clean up grouped routes and catch-all for mapping
      const cleanRoute = routePath
        .replace(/\/\([^)]+\)/g, "")
        .replace(/\/\[[^\]]+\]/g, "/*");
      routes.add(cleanRoute || "/");
    }
  });
  return routes;
}

function extractLinks(content: string): string[] {
  const links: string[] = [];
  // Match href="..." or href='...'
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    const link = match[1];
    if (link.startsWith("/") && !link.startsWith("//")) {
      links.push(link);
    }
  }
  return links;
}

const IS_FIX_MODE = process.argv.includes("--fix");

function audit() {
  console.log("--- Docs Route + Link Auditor ---");
  if (IS_FIX_MODE) console.log("FIX MODE ENABLED");

  const routes = getRoutes();
  console.log(`Found ${routes.size} routes.`);

  const issues: LinkIssue[] = [];
  let totalFilesChecked = 0;
  let totalLinksFound = 0;
  let fixesApplied = 0;

  walk(ARCADE_APP_ROOT, (filePath) => {
    if (
      !filePath.endsWith(".tsx") &&
      !filePath.endsWith(".ts") &&
      !filePath.endsWith(".mdx")
    )
      return;

    totalFilesChecked++;
    let content = fs.readFileSync(filePath, "utf-8");
    let originalContent = content;
    const links = extractLinks(content);
    totalLinksFound += links.length;

    for (const link of links) {
      const [pathOnly] = link.split(/[?#]/);
      let normalizedPath = pathOnly;
      if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
        normalizedPath = normalizedPath.slice(0, -1);
      }

      // Check for exact match
      if (!routes.has(normalizedPath)) {
        // Check for casing mismatch
        let foundCasingMatch = false;
        for (const route of routes) {
          if (route.toLowerCase() === normalizedPath.toLowerCase()) {
            issues.push({
              file: path.relative(REPO_ROOT, filePath),
              link,
              type: "casing",
              suggestion: route,
            });

            if (IS_FIX_MODE) {
              // Replace only exact link match with the correct casing
              // Be careful not to replace unintentional matches, but href="..." is fairly specific
              const quotedLink = `"${link}"`;
              const quotedSuggestion = `"${route}"`;
              if (content.includes(quotedLink)) {
                content = content.replace(quotedLink, quotedSuggestion);
                fixesApplied++;
              }
            }

            foundCasingMatch = true;
            break;
          }
        }

        if (!foundCasingMatch) {
          issues.push({
            file: path.relative(REPO_ROOT, filePath),
            link,
            type: "404",
          });
        }
      }
    }

    if (IS_FIX_MODE && content !== originalContent) {
      fs.writeFileSync(filePath, content);
    }
  });

  const report: Report = {
    timestamp: new Date().toISOString(),
    totalFilesChecked,
    totalLinksFound,
    issues,
  };

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const reportPath = path.join(ARTIFACTS_DIR, "links.report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Audited ${totalFilesChecked} files.`);
  console.log(`Found ${totalLinksFound} internal links.`);

  if (fixesApplied > 0) {
    console.log(`Applied ${fixesApplied} casing fixes.`);
  }

  if (issues.length > 0) {
    // In fix mode, if we applied fixes, some issues might still remain (404s)
    const remainingIssues = IS_FIX_MODE
      ? issues.filter((i) => i.type === "404")
      : issues;
    if (remainingIssues.length > 0) {
      console.warn(`Found ${remainingIssues.length} remaining issues:`);
      remainingIssues.forEach((issue) => {
        console.log(
          `[${issue.type.toUpperCase()}] ${issue.file}: ${issue.link}`,
        );
      });
      process.exit(1);
    } else {
      console.log("All fixable issues resolved!");
    }
  } else {
    console.log("No link issues found!");
  }
}

audit();
