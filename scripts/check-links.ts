import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..");
const DOCS_APP_ROOT = path.join(REPO_ROOT, "apps/docs/app");
const ARCADE_APP_ROOT = path.join(REPO_ROOT, "apps/arcade/src/app");

interface LinkIssue {
  file: string;
  link: string;
  type: "404" | "casing" | "slash";
  suggestion?: string;
}

function walk(dir: string, callback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
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

function getRoutes(root: string): Set<string> {
  const routes = new Set<string>();
  walk(root, (filePath) => {
    const relative = path.relative(root, filePath);
    const parts = relative.split(path.sep);

    // Skip special Next.js folders
    if (parts.some((p) => p.startsWith("_") || p.startsWith("(") || p.startsWith("["))) {
      // Basic support for dynamic routes if needed
    }

    const filename = parts[parts.length - 1];
    if (filename === "page.tsx" || filename === "route.ts") {
      let routePath = "/" + parts.slice(0, -1).join("/");
      if (routePath === "//") routePath = "/";
      if (routePath.length > 1 && routePath.endsWith("/")) routePath = routePath.slice(0, -1);

      // Clean up grouped routes
      const cleanRoute = routePath.replace(/\/\([^)]+\)/g, "");
      routes.add(cleanRoute || "/");
    }
  });
  return routes;
}

function extractLinks(content: string): string[] {
  const links: string[] = [];
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

function main() {
  console.log("--- Comprehensive Link Integrity Check ---");

  const docsRoutes = getRoutes(DOCS_APP_ROOT);
  const arcadeRoutes = getRoutes(ARCADE_APP_ROOT);

  // Combine routes for cross-app linking if intended,
  // but usually they stay within their domain.
  // For now, let's treat them as separate or combined?
  // The request says "no broken internal links".
  const allRoutes = new Set([...docsRoutes, ...arcadeRoutes]);

  console.log(`Found ${docsRoutes.size} routes in apps/docs.`);
  console.log(`Found ${arcadeRoutes.size} routes in apps/arcade.`);

  const issues: LinkIssue[] = [];
  const appsToScan = [DOCS_APP_ROOT, ARCADE_APP_ROOT];

  for (const appRoot of appsToScan) {
    walk(appRoot, (filePath) => {
      if (!filePath.endsWith(".tsx") && !filePath.endsWith(".ts") && !filePath.endsWith(".mdx"))
        return;

      const content = fs.readFileSync(filePath, "utf-8");
      const links = extractLinks(content);

      for (const link of links) {
        const [pathOnly] = link.split(/[?#]/);
        let normalizedPath = pathOnly;
        if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
          normalizedPath = normalizedPath.slice(0, -1);
        }

        if (!allRoutes.has(normalizedPath)) {
          // Special case for cross-brand links that might be absolute in production but relative here?
          // Actually, let's just stick to what we know.
          issues.push({
            file: path.relative(REPO_ROOT, filePath),
            link,
            type: "404",
          });
        }
      }
    });
  }

  if (issues.length > 0) {
    console.error(`❌ Found ${issues.length} broken internal links:`);
    issues.forEach((issue) => {
      console.error(`  [${issue.type.toUpperCase()}] ${issue.file}: ${issue.link}`);
    });
    process.exit(1);
  } else {
    console.log("✅ All internal links verified!");
  }
}

main();
