export const metadata = {
  title: "Execution Graph — ReadyLayer Docs",
  description:
    "Every run produces an execution graph with tool invocations, provider info, token counts, and evaluation.",
};

export default function ExecutionDocsPage() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1>Execution Graph</h1>
      <p>
        Every run produces a full execution graph. The graph captures the
        complete flow from input through skill execution, tool invocations,
        provider routing, evaluation, and output.
      </p>

      <h2>Graph Structure</h2>
      <p>Each graph contains:</p>
      <ul>
        <li>
          <strong>Nodes</strong> — Input, Skill, Tool, Provider, Evaluation,
          Output
        </li>
        <li>
          <strong>Edges</strong> — Directed connections between nodes
        </li>
        <li>
          <strong>Tool Invocations</strong> — Detailed log of each tool call
          with timing
        </li>
        <li>
          <strong>Provider Info</strong> — Which provider/model was used and why
        </li>
        <li>
          <strong>Token Usage</strong> — Input/output tokens and estimated cost
        </li>
        <li>
          <strong>Evaluation Summary</strong> — Score, checks run, findings
        </li>
      </ul>

      <h2>Visibility</h2>
      <p>
        The execution graph is hidden by default in the Playground. Users can
        expand it via &ldquo;View execution details&rdquo; to see the full
        graph, tool log, token usage, and artifacts.
      </p>

      <h2>Artifacts</h2>
      <p>Each run produces four artifact formats:</p>
      <table>
        <thead>
          <tr>
            <th>Format</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>json</code>
            </td>
            <td>Full execution graph as JSON</td>
          </tr>
          <tr>
            <td>
              <code>mcp-config</code>
            </td>
            <td>MCP server configuration derived from the run</td>
          </tr>
          <tr>
            <td>
              <code>cli-command</code>
            </td>
            <td>CLI command to replay this exact run</td>
          </tr>
          <tr>
            <td>
              <code>report</code>
            </td>
            <td>Human-readable markdown report</td>
          </tr>
        </tbody>
      </table>

      <h2>API</h2>
      <pre>
        <code>{`POST /api/v1/execute
{
  "skill_id": "readiness-check",
  "inputs": { "agent_trace": {} },
  "mode": "browser",
  "routing_strategy": "default"
}

# Returns: { graph, artifacts }`}</code>
      </pre>

      <h2>Execution Modes</h2>
      <table>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>browser</code>
            </td>
            <td>Browser sandbox execution</td>
          </tr>
          <tr>
            <td>
              <code>edge</code>
            </td>
            <td>Edge worker execution</td>
          </tr>
          <tr>
            <td>
              <code>mcp-server</code>
            </td>
            <td>MCP server-mediated execution</td>
          </tr>
          <tr>
            <td>
              <code>local-cli</code>
            </td>
            <td>Local CLI execution</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
