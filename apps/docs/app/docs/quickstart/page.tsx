import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

export default function QuickstartPage() {
  return (
    <DocLayout currentPath="/docs/quickstart" title="Quickstart">
      <p className="text-lg text-slate-600 mb-8">
        Get Reach running locally in under a minute. This guide walks you
        through installation, verification, and your first decision workflow.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Prerequisites</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Node.js 18+</li>
        <li>Go 1.21+</li>
        <li>Rust 1.75+</li>
        <li>Git</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Clone and Install</h2>
      <CodeBlock
        code={`git clone https://github.com/reach/reach.git
cd reach
pnpm install`}
      />

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. Verify Your Setup</h2>
      <CodeBlock code={`./reach doctor`} />
      <p className="mt-4">
        The doctor command checks all dependencies, file permissions, and
        deterministic environment requirements. You should see all checks pass.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">
        3. Run Your First Example
      </h2>
      <CodeBlock code={`node examples/01-quickstart-local/run.js`} />
      <p className="mt-4">
        This creates a local decision, adds evidence, and outputs a
        deterministic result card.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">
        4. Verify Determinism
      </h2>
      <p>
        Run the same command twice. The transcript hash will be identical—this
        is Reach's core guarantee.
      </p>
      <CodeBlock
        code={`# Run once
node examples/01-quickstart-local/run.js | grep "Transcript hash"

# Run again
node examples/01-quickstart-local/run.js | grep "Transcript hash"

# Hashes match ✓`}
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
