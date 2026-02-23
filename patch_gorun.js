const fs = require('fs');

function replaceInFile(filePath, regex, replacement) {
try {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {}
}

const files = [
  'reach',
  '.github/workflows/perf-gate.yml',
  'services/integration-hub/README.md',
  'tools/dev.sh',
  'tools/mobile-smoke.sh'
];

files.forEach(f => {
  // In `reach`, we can just replace `go run ./cmd/reachctl` with `./reachctl` and `./reach-serve`.
  // Wait, if users run `./reach` they might expect it to work without building.
  // The migration doc says "Use the compiled reachctl binary for execution instead of running the source dir".
  replaceInFile(f, /go run \.\/cmd\//g, './');
});

console.log('Fixed go run ./cmd occurrences');
