import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

export default function ProofPage() {
  return (
    <DocLayout currentPath="/docs/proof" title="Proof of Reality">
      <p className="text-lg text-slate-600 mb-8">
        How we verify that Reach is not "theatre." Every claim of determinism and integrity is
        backed by automated, reproducible proofs.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Automated Verification</h2>
        <p className="text-slate-600 mb-6">
          The following commands are run against every commit to ensure the "Reality" of the
          execution fabric. You can run them yourself to verify the integrity of your local
          installation.
        </p>

        <div className="space-y-8">
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xl font-bold mb-2 text-slate-900">Full Repository Verification</h3>
            <p className="text-sm text-slate-500 mb-4">
              The ultimate truth check for the entire codebase.
            </p>
            <CodeBlock code={`npm run verify`} language="bash" />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold mb-2 text-slate-900">CLI Verification</h3>
              <p className="text-sm text-slate-600 mb-4">
                Validates that all documented CLI commands exist in the binary and return expected
                exit codes.
              </p>
              <CodeBlock code={`npm run verify:cli`} language="bash" />
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold mb-2 text-slate-900">Determinism Verification</h3>
              <p className="text-sm text-slate-600 mb-4">
                Runs 50+ deterministic seeds to ensure bit-identical traces across environments.
              </p>
              <CodeBlock code={`npm run verify:determinism`} language="bash" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold mb-2 text-slate-900">OSS Purity</h3>
              <p className="text-sm text-slate-600 mb-4">
                Ensures no proprietary enterprise logic or metrics have drifted into the open-source
                core.
              </p>
              <CodeBlock code={`npm run verify:oss`} language="bash" />
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold mb-2 text-slate-900">Doc & Route Integrity</h3>
              <p className="text-sm text-slate-600 mb-4">
                Validates that every documentation link and site route is live and accurate.
              </p>
              <CodeBlock code={`npm run verify:routes`} language="bash" />
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">60-Second Proof</h2>
        <p className="text-slate-600 mb-4">
          Want to see reality right now? Run these three commands in order:
        </p>
        <div className="bg-slate-900 p-6 rounded-xl">
          <CodeBlock
            code={`# Step 1: Diagnose your environment
./reach doctor

# Step 2: Execute a deterministic demo
./reach demo

# Step 3: Verify system status
./reach status`}
            language="bash"
          />
        </div>
      </section>

      <footer className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500">
        <span>Verified by Reach Artifacts</span>
        <a href="https://github.com/reach/reach/actions" className="text-blue-600 hover:underline">
          View CI Proofs →
        </a>
      </footer>
    </DocLayout>
  );
}
