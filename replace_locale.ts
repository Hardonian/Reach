import * as fs from "fs";
import * as path from "path";

const pluginsDir = path.join(__dirname, "plugins");

function walk(dir: string) {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes("node_modules")) {
      results = results.concat(walk(file));
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(pluginsDir);

files.forEach((f) => {
  let content = fs.readFileSync(f, "utf8");
  let modified = false;

  if (content.includes("localeCompare")) {
    content = content.replace(
      /\.sort\(\(a, b\) => a\[0\]\.localeCompare\(b\[0\]\)\)/g,
      `.sort((a, b) => a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0))`
    );
    content = content.replace(
      /\.sort\(\(a, b\) => a\.type\.localeCompare\(b\.type\)\)/g,
      `.sort((a, b) => a.type < b.type ? -1 : (a.type > b.type ? 1 : 0))`
    );
    content = content.replace(
      /return aStr\.localeCompare\(bStr\);/g,
      `return aStr < bStr ? -1 : (aStr > bStr ? 1 : 0);`
    );
    content = content.replace(
      /\.sort\(\(a, b\) => a\.message\.localeCompare\(b\.message\)\)/g,
      `.sort((a, b) => a.message < b.message ? -1 : (a.message > b.message ? 1 : 0))`
    );
    content = content.replace(
      /\.sort\(\(a, b\) => a\.name\.localeCompare\(b\.name\)\)/g,
      `.sort((a, b) => a.name < b.name ? -1 : (a.name > b.name ? 1 : 0))`
    );
    content = content.replace(
      /\.sort\(\(a, b\) => JSON\.stringify\(a\)\.localeCompare\(JSON\.stringify\(b\)\)\)/g,
      `.sort((a, b) => { let sa = JSON.stringify(a), sb = JSON.stringify(b); return sa < sb ? -1 : (sa > sb ? 1 : 0); })`
    );
    content = content.replace(
      /\.sort\(\(a, b\) => \(a\.id \|\| ""\)\.localeCompare\(b\.id \|\| ""\)\)/g,
      `.sort((a, b) => { let ia = a.id || "", ib = b.id || ""; return ia < ib ? -1 : (ia > ib ? 1 : 0); })`
    );
    fs.writeFileSync(f, content);
  }
});
