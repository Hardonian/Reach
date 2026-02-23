import Link from "next/link";

export const metadata = {
  title: "Tool Registry — ReadyLayer Docs",
  description:
    "Executable capabilities with permissions, scope, and audit trails.",
};

export default function ToolsDocsPage() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1>Tool Registry</h1>
      <p>
        Tools are executable capabilities that skills invoke. Each tool has
        permissions, scope, audit trail, and can be bound to one or more skills.
      </p>

      <h2>Tool Types</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>http</code>
            </td>
            <td>HTTP API calls to external services</td>
          </tr>
          <tr>
            <td>
              <code>github</code>
            </td>
            <td>GitHub API operations (repos, PRs, check runs)</td>
          </tr>
          <tr>
            <td>
              <code>file</code>
            </td>
            <td>Local file system read/write operations</td>
          </tr>
          <tr>
            <td>
              <code>webhook</code>
            </td>
            <td>Outbound webhook notifications</td>
          </tr>
          <tr>
            <td>
              <code>local-cli</code>
            </td>
            <td>Local CLI command execution</td>
          </tr>
          <tr>
            <td>
              <code>vector-db</code>
            </td>
            <td>Vector database search and storage</td>
          </tr>
        </tbody>
      </table>

      <h2>Permissions Model</h2>
      <p>Each tool declares permissions as action/resource pairs:</p>
      <ul>
        <li>
          <code>read</code> — Read access to a resource
        </li>
        <li>
          <code>write</code> — Write access to a resource
        </li>
        <li>
          <code>execute</code> — Execute a command or process
        </li>
        <li>
          <code>network</code> — Make outbound network requests
        </li>
      </ul>

      <h2>Scope</h2>
      <p>
        Tools can be scoped globally or to a specific tenant/project. Global
        tools are available to all skills.
      </p>

      <h2>API</h2>
      <pre>
        <code>{`GET /api/v1/tools              # List all tools
GET /api/v1/tools?id=trace-parser  # Get specific tool
GET /api/v1/tools?type=http        # Filter by type`}</code>
      </pre>

      <div className="not-prose mt-8">
        <Link href="/tools" className="btn-primary text-sm">
          Browse Tools
        </Link>
      </div>
    </div>
  );
}
