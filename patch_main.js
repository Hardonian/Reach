const fs = require('fs');

const path = 'services/runner/cmd/reachctl/main.go';
let content = fs.readFileSync(path, 'utf8');

// remove imports
content = content.replace(/"reach\/decision-engine\/services\/runner\/internal\/consensus"\s*\n?/g, '');

// remove runVerifyPeer and everything below it
const match = 'func runVerifyPeer(';
const idx = content.indexOf(match);
if (idx !== -1) {
  content = content.slice(0, idx);
}

// remove runByzantine route
const routeMatch = 'if len(args) > 0 && args[0] == "byzantine" {\n\t\treturn runByzantine(ctx, dataRoot, args[1:], out, errOut)\n\t}';
content = content.replace(routeMatch, '');

// Save changes
fs.writeFileSync(path, content, 'utf8');
console.log('main.go patched successfully');
