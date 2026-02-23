import Link from "next/link";

export const metadata = {
  title: "Skills System — ReadyLayer Docs",
  description:
    "Composable units of agent behavior with manifests, inputs, tools, and evaluation hooks.",
};

export default function SkillsDocsPage() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1>Skills System</h1>
      <p>
        Skills are composable units of agent behavior. Each skill declares its inputs, required
        tools, model hints, and evaluation hooks.
      </p>

      <h2>Skill Manifest</h2>
      <p>Every skill is defined by a manifest with the following fields:</p>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>id</code>
            </td>
            <td>string</td>
            <td>Unique skill identifier</td>
          </tr>
          <tr>
            <td>
              <code>name</code>
            </td>
            <td>string</td>
            <td>Display name</td>
          </tr>
          <tr>
            <td>
              <code>version</code>
            </td>
            <td>string</td>
            <td>Semver version</td>
          </tr>
          <tr>
            <td>
              <code>inputs</code>
            </td>
            <td>SkillInput[]</td>
            <td>Declared input parameters</td>
          </tr>
          <tr>
            <td>
              <code>tools</code>
            </td>
            <td>string[]</td>
            <td>Tool IDs required by this skill</td>
          </tr>
          <tr>
            <td>
              <code>modelHints</code>
            </td>
            <td>ModelHint[]</td>
            <td>Recommended provider/model pairs</td>
          </tr>
          <tr>
            <td>
              <code>evaluationHooks</code>
            </td>
            <td>string[]</td>
            <td>Hooks run after execution</td>
          </tr>
        </tbody>
      </table>

      <h2>Built-in Skills</h2>
      <ul>
        <li>
          <strong>Readiness Check</strong> — Full readiness sweep: tool reliability, policy gates,
          output schema, latency.
        </li>
        <li>
          <strong>Policy Gate</strong> — Validate tool calls against defined rules.
        </li>
        <li>
          <strong>Change Detection</strong> — Compare current run against saved baseline.
        </li>
        <li>
          <strong>Trace Capture</strong> — Capture a full execution trace without enforcing rules.
        </li>
        <li>
          <strong>Release Gate</strong> — CI/CD gate that blocks merges when agent score drops.
        </li>
        <li>
          <strong>MCP Bridge</strong> — Connect to MCP servers and expose tools as skill inputs.
        </li>
      </ul>

      <h2>Skill Composition</h2>
      <p>
        Skills can be composed into pipelines. A composition defines which skills run in sequence
        and how they connect.
      </p>

      <h2>MCP Export</h2>
      <p>
        Any skill can be exported as an MCP server configuration. This allows ReadyLayer skills to
        be consumed by any MCP-compatible client.
      </p>

      <div className="not-prose mt-8">
        <Link href="/skills" className="btn-primary text-sm">
          Browse Skills
        </Link>
      </div>
    </div>
  );
}
