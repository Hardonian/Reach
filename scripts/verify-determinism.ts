import { compileGovernanceIntent } from "../packages/core/src/nl-compiler/compiler.js";
import { generateGovernanceArtifacts } from "../packages/core/src/codegen/generate.js";
import crypto from "node:crypto";

const intent =
  process.argv.slice(2).join(" ") ||
  "Make sure no PR deploys unless evaluation score >= 0.9 and require provenance for all generated artifacts.";

function runCompiler() {
  const compiled = compileGovernanceIntent({
    intent,
    orgId: "verify-org",
    workspaceId: "verify-workspace",
    scope: "project",
    memory: [
      {
        orgId: "verify-org",
        workspaceId: "verify-workspace",
        scope: "project",
        memoryType: "eval_baseline",
        content: { evaluation_min: 0.9, hallucination_max: 0.1 },
        confidence: 0.9,
      },
      {
        orgId: "verify-org",
        workspaceId: "verify-workspace",
        scope: "project",
        memoryType: "policy_preference",
        content: { provenance_required: true },
        confidence: 0.8,
      },
    ],
    defaultRolloutMode: "dry-run",
  });

  const generated = generateGovernanceArtifacts({
    intent,
    spec: compiled.spec,
    specHash: compiled.specHash,
    ciEnforcement: compiled.ciEnforcement,
  });

  const canonicalArtifacts = generated.artifacts
    .map((artifact) => ({
      path: artifact.path,
      hash: artifact.hash,
      content: artifact.content,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const artifactHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalArtifacts), "utf8")
    .digest("hex");

  return {
    hash: compiled.specHash,
    canonicalSpec: compiled.canonicalSpec,
    artifacts: canonicalArtifacts,
    artifactHash,
  };
}

const first = runCompiler();
const second = runCompiler();

const sameHash = first.hash === second.hash;
const sameSpec = first.canonicalSpec === second.canonicalSpec;
const sameArtifacts = JSON.stringify(first.artifacts) === JSON.stringify(second.artifacts);
const sameArtifactHash = first.artifactHash === second.artifactHash;

if (!sameHash || !sameSpec || !sameArtifacts || !sameArtifactHash) {
  console.error("❌ Determinism check failed");
  console.error(
    JSON.stringify(
      {
        intent,
        first,
        second,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log("✅ Determinism verified");
console.log(`Intent: ${intent}`);
console.log(`GovernanceSpec hash: ${first.hash}`);
console.log(`Artifact bundle hash: ${first.artifactHash}`);
console.log(`Artifacts checked: ${first.artifacts.length}`);
