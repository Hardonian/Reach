import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

const examples = [
  {
    id: "01",
    name: "Quickstart Local",
    description:
      "Your first Reach decision. Create a decision, add evidence, export results.",
    command: "node examples/01-quickstart-local/run.js",
    concepts: ["Decision creation", "Evidence", "Export"],
  },
  {
    id: "02",
    name: "Diff and Explain",
    description: "Compare two decisions and understand why outcomes differ.",
    command: "node examples/02-diff-and-explain/run.js",
    concepts: ["Decision diffing", "Explanation", "Comparison"],
  },
  {
    id: "03",
    name: "Junction to Decision",
    description: "Transform junction templates into executable decisions.",
    command: "node examples/03-junction-to-decision/run.js",
    concepts: ["Junctions", "Templates", "Transformation"],
  },
  {
    id: "04",
    name: "Action Plan Execute Safe",
    description: "Generate action plans with safety checks and execute them.",
    command: "node examples/04-action-plan-execute-safe/run.js",
    concepts: ["Action plans", "Safety checks", "Execution"],
  },
  {
    id: "05",
    name: "Export Verify Replay",
    description: "Export decision bundles and verify replay determinism.",
    command: "node examples/05-export-verify-replay/run.js",
    concepts: ["Export bundles", "Verification", "Replay"],
  },
  {
    id: "06",
    name: "Retention Compact Safety",
    description: "Manage evidence retention with compaction and safety bounds.",
    command: "node examples/06-retention-compact-safety/run.js",
    concepts: ["Retention", "Compaction", "Safety"],
  },
];

export default function ExamplesPage() {
  return (
    <DocLayout currentPath="/docs/examples" title="Examples">
      <p className="text-lg text-slate-600 mb-8">
        Six complete examples that demonstrate Reach's core capabilities, from
        basic decision creation to advanced replay verification.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Run All Examples</h2>
      <CodeBlock
        code={`# Run all core examples sequentially
node examples/01-quickstart-local/run.js
node examples/02-diff-and-explain/run.js
node examples/03-junction-to-decision/run.js
node examples/04-action-plan-execute-safe/run.js
node examples/05-export-verify-replay/run.js
node examples/06-retention-compact-safety/run.js`}
      />

      <h2 className="text-2xl font-semibold mt-8 mb-4">Individual Examples</h2>
      <div className="space-y-6">
        {examples.map((ex) => (
          <div key={ex.id} className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                {ex.id}
              </span>
              <h3 className="text-xl font-semibold">{ex.name}</h3>
            </div>
            <p className="text-slate-600 mb-4">{ex.description}</p>
            <CodeBlock code={ex.command} />
            <div className="mt-4 flex gap-2">
              {ex.concepts.map((concept) => (
                <span
                  key={concept}
                  className="bg-slate-100 text-slate-700 text-sm px-2 py-1 rounded"
                >
                  {concept}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Demo Pack</h2>
      <p className="mb-4">
        For a visual walkthrough, run the web demo which provides an interactive
        evidence graph visualization.
      </p>
      <CodeBlock
        code={`# Start the web interface
pnpm run demo

# Open http://localhost:3000`}
      />
    </DocLayout>
  );
}
