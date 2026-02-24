import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

export default function QuickstartPage() {
  return (
    <DocLayout currentPath="/docs/quickstart" title="Quickstart">
      <p className="text-lg text-slate-600 mb-8">
        Get Reach running locally in under a minute. This guide walks you through installation,
        verification, and your first decision workflow.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Prerequisites</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Node.js 20+</li>
        <li>Go 1.22+</li>
        <li>Rust (for core engine development)</li>
        <li>Git</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Clone and Install</h2>
      <CodeBlock
        code={`git clone https://github.com/reach/reach.git
cd reach
npm install
make build`}
      />

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. Verify Your Setup</h2>
      <CodeBlock code={`./reach version
./reach doctor`} />
      <p className="mt-4">
        The doctor command checks all dependencies, file permissions, and deterministic environment
        requirements. You should see all checks pass.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">3. Run One-Command Demo</h2>
      <CodeBlock code={`./reach demo`} />
      <p className="mt-4">
        This runs the sample pack, verifies and replays it, and creates a portable capsule.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. Verify Determinism</h2>
      <p>
        Use the generated capsule to verify and replay deterministically.
      </p>
      <CodeBlock
        code={`reach capsule verify data/capsules/<run-id>.capsule.json
reach capsule replay data/capsules/<run-id>.capsule.json`}
      />

      <h2 className="text-2xl font-semibold mt-8 mb-4">Next Steps</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          Explore the{" "}
          <a href="/docs/examples" className="text-blue-600 hover:underline">
            six core examples
          </a>
        </li>
        <li>
          Choose a{" "}
          <a href="/docs/presets" className="text-blue-600 hover:underline">
            preset
          </a>{" "}
          for your use case
        </li>
        <li>
          Build a{" "}
          <a href="/docs/plugins" className="text-blue-600 hover:underline">
            plugin
          </a>{" "}
          to extend Reach
        </li>
      </ul>
    </DocLayout>
  );
}
