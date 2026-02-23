import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

const commonIssues = [
  {
    issue: "Hash mismatch on replay",
    cause: "Non-deterministic input or environment difference",
    fix: "Run ./reach doctor to check environment. Ensure all inputs are captured in the transcript.",
  },
  {
    issue: "Plugin not loading",
    cause: "Invalid plugin.json or missing required fields",
    fix: "Run ./reach plugins validate <path> to diagnose.",
  },
  {
    issue: "Decision health degraded",
    cause: "Evidence decay or policy drift",
    fix: "Review with ./reach explain <decision>. Refresh evidence or update policies.",
  },
  {
    issue: "Export bundle verification fails",
    cause: "Bundle tampered or corrupted",
    fix: "Regenerate bundle with ./reach export. Verify with ./reach verify-proof.",
  },
];

export default function TroubleshootingPage() {
  return (
    <DocLayout currentPath="/docs/troubleshooting" title="Troubleshooting">
      <p className="text-lg text-slate-600 mb-8">
        Common issues, debug workflows, and how to generate comprehensive bug reports for the Reach
        team.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Diagnostic Tools</h2>

      <h3 className="text-xl font-semibold mt-6 mb-2">System Health Check</h3>
      <CodeBlock code={`./reach doctor`} />
      <p className="mt-2">
        Checks all dependencies, permissions, and deterministic environment requirements.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-2">Generate Demo Report</h3>
      <CodeBlock
        code={`# Generate comprehensive demo report
./reach report demo

# Verify report integrity
./reach report verify demo-report/`}
      />
      <p className="mt-2">
        Creates a shareable artifact with hashes, timeline, and environment snapshot. Attach this to
        bug reports.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Common Issues</h2>
      <div className="space-y-4">
        {commonIssues.map((item, idx) => (
          <div key={idx} className="border rounded-lg p-4">
            <h3 className="font-semibold text-red-700">{item.issue}</h3>
            <p className="text-slate-600 mt-1">
              <strong>Cause:</strong> {item.cause}
            </p>
            <p className="text-slate-600 mt-1">
              <strong>Fix:</strong> {item.fix}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Debug Mode</h2>
      <CodeBlock
        code={`# Enable verbose logging
DEBUG=reach* ./reach doctor

# Trace a specific decision
./reach explain <decision-id> --verbose`}
      />

      <h2 className="text-2xl font-semibold mt-8 mb-4">Generating Bug Reports</h2>
      <p className="mb-4">When filing a bug report, please include:</p>
      <ol className="list-decimal pl-6 space-y-2">
        <li>Exact command run</li>
        <li>
          Output of <code>./reach doctor</code>
        </li>
        <li>
          Demo report artifact: <code>./reach report demo</code>
        </li>
        <li>Environment details (OS, Node version, etc.)</li>
      </ol>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Getting Help</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Bug Reports:</strong>{" "}
          <a
            href="https://github.com/reach/reach/issues/new?template=bug_report.yml"
            className="text-blue-600 hover:underline"
          >
            File an issue
          </a>
        </li>
        <li>
          <strong>Feature Requests:</strong>{" "}
          <a
            href="https://github.com/reach/reach/issues/new?template=feature_request.yml"
            className="text-blue-600 hover:underline"
          >
            Submit idea
          </a>
        </li>
        <li>
          <strong>Discussions:</strong>{" "}
          <a
            href="https://github.com/reach/reach/discussions"
            className="text-blue-600 hover:underline"
          >
            GitHub Discussions
          </a>
        </li>
      </ul>
    </DocLayout>
  );
}
