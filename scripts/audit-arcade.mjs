#!/usr/bin/env node
// audit-arcade.mjs — npm audit with named, justified exceptions.
//
// Replaces the blanket `continue-on-error` on the Arcade audit step, which
// would swallow NEW findings along with the known-unfixable ones. Here the
// unfixable advisories are named and reasoned about; anything else fails.
//
// Usage: node scripts/audit-arcade.mjs   (run from repo root; scans apps/arcade)
import { execSync } from 'node:child_process';

// Justified exceptions — package names with no safe fix path today.
const KNOWN_UNFIXABLE = {
  braces:
    'GHSA-vfj7-8cjw-p6xm covers ALL braces versions (patched_versions <0.0.0; ' +
    'latest release 3.0.3 is vulnerable). Tooling chain eslint-config-next -> ' +
    'fast-glob -> micromatch -> braces; the only resolution is a breaking ' +
    'eslint-config-next downgrade to 14.x, which is riskier than the ' +
    'build-time stack-exhaustion exposure. Re-check when braces ships a fix.',
  'postcss-selector-parser':
    'GHSA-rj75-hqrm-r3gf CPU exhaustion in flat selector parsing: fix exists ' +
    'only in 7.x while @tailwindcss/typography pins the 6.x line (7.x is a ' +
    'breaking change for it). Build-time DoS surface only. Unblock with the ' +
    'tailwind/typography upgrade, then drop this entry.',
};

let raw = '';
try {
  raw = execSync('npm audit --json', {
    cwd: 'apps/arcade',
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  // npm audit exits non-zero when findings exist; output is still on stdout.
  raw = e.stdout || '';
}
if (!raw) {
  console.error(
    'audit-arcade: npm audit produced no JSON output — cannot verify.',
  );
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error('audit-arcade: unparseable npm audit JSON — cannot verify.');
  process.exit(1);
}

// npm audit JSON v1 uses `advisories`; v2 uses `vulnerabilities` (entries may
// be direct advisories or dependents whose `via` names the vulnerable root).
// Never report green on a shape we cannot interpret.
const accepted = [];
const unexpected = [];
const note = (line) => accepted.push(line);
if (parsed.advisories) {
  for (const [id, a] of Object.entries(parsed.advisories)) {
    const line = `${a.severity} ${a.module_name} (${id}) ${a.title}`;
    (a.module_name in KNOWN_UNFIXABLE ? note : unexpected)(line);
  }
} else if (parsed.vulnerabilities) {
  for (const [name, v] of Object.entries(parsed.vulnerabilities)) {
    const vias = Array.isArray(v.via) ? v.via : [];
    const direct = vias.filter((x) => typeof x === 'object');
    const line = `${v.severity} ${name} via ${direct.map((d) => d.dependency || d.title).join(',') || vias.join(',')}`;
    const newRoot = direct.find(
      (d) => d.dependency && !(d.dependency in KNOWN_UNFIXABLE),
    );
    if (newRoot) {
      unexpected.push(line + ` (new root: ${newRoot.dependency})`);
    } else if (direct.length > 0) {
      note(line);
    } else {
      note(line + ' (dependent of documented exception)');
    }
  }
} else {
  console.error(
    'audit-arcade: npm audit JSON has neither `advisories` nor `vulnerabilities` — cannot verify.',
  );
  process.exit(1);
}

// Cross-check: if npm reported findings but we classified none, the shapes
// drifted — fail loudly instead of passing an unchecked gate.
const total = parsed.metadata?.vulnerabilities?.total;
if (
  typeof total === 'number' &&
  total > 0 &&
  accepted.length === 0 &&
  unexpected.length === 0
) {
  console.error(
    `audit-arcade: npm reports ${total} vulnerabilities but none were classifiable — cannot verify.`,
  );
  process.exit(1);
}

for (const line of accepted) console.log(`accepted (documented): ${line}`);
if (unexpected.length > 0) {
  console.error(
    '\naudit-arcade: NEW findings outside the documented exceptions:',
  );
  for (const line of unexpected) console.error(`  ${line}`);
  console.error(
    'Fix them or add a justified entry to KNOWN_UNFIXABLE in scripts/audit-arcade.mjs.',
  );
  process.exit(1);
}
console.log(
  `audit-arcade: OK — ${accepted.length} documented exception(s), 0 unexpected.`,
);
