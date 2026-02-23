import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Model Context Protocol (MCP) | ReadyLayer Documentation",
  description:
    "Learn how ReadyLayer integrates with MCP to provide standardized tool and resource access.",
};

export default function MCPPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">
          Model Context Protocol (MCP)
        </h1>
        <p className="text-xl text-gray-400">
          ReadyLayer uses the Model Context Protocol (MCP) as the standard
          interface between LLMs and external data/tools.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Why MCP?
        </h2>
        <p className="text-gray-400">
          Before MCP, every AI integration required custom "glue code" for
          authentication, data formatting, and error handling. ReadyLayer adopts
          MCP to provide:
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Interoperability</h3>
            <p className="text-xs text-gray-500">
              Works with any MCP-compliant server (PostgreSQL, GitHub, Slack,
              etc.) without custom runners.
            </p>
          </div>
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Type Safety</h3>
            <p className="text-xs text-gray-500">
              Tool schemas and resource types are formally defined, reducing
              runtime execution errors.
            </p>
          </div>
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Security</h3>
            <p className="text-xs text-gray-500">
              ReadyLayer wraps MCP calls in policy gates, ensuring signed
              execution regardless of the tool source.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Configuring MCP Servers
        </h2>
        <p className="text-gray-400">
          MCP servers are registered in the ReadyLayer <code>config.yaml</code>{" "}
          or via the CLI.
        </p>
        <div className="bg-black/40 border border-border rounded-xl p-6 font-mono text-sm">
          <div className="text-gray-500 mb-2"># Example MCP Configuration</div>
          <div className="text-white">
            {`mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "re_..."
  postgres:
    command: "docker"
    args: ["run", "-i", "--rm", "mcp/postgres"]
    env:
      DATABASE_URL: "postgres://..."`}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Architecture within ReadyLayer
        </h2>
        <div className="bg-white/5 p-8 rounded-xl border border-white/10 font-mono text-sm overflow-x-auto whitespace-pre">
          {`+----------------+       +-------------------+       +-------------------+
|   ReadyLayer Runner | <--->  |   MCP Client SDK  | <---> |   MCP Server      |
| (Policy Gate)  |       | (Standard Wire)   |       | (GitHub/DB/etc)   |
+----------------+       +-------------------+       +-------------------+
       ^                                                    |
       |                                                    |
       +------------------- [Tools & Resources] ------------+`}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Governance & Permissions
        </h2>
        <p className="text-gray-400">
          Unlike raw MCP usage, ReadyLayer requires every tool call to be
          authorized by a <strong>Capability Profile</strong>.
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold mb-2">Capabilities</h3>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
              <li>
                <code>mcp:github/read_issue</code>
              </li>
              <li>
                <code>mcp:postgres/query</code>
              </li>
              <li>
                <code>mcp:filesystem/write</code>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-2">Enforcement</h3>
            <p className="text-sm text-gray-400">
              If an agent attempts to call an MCP tool not present in its signed
              capability pack, the ReadyLayer Runner terminates the process
              immediately with a <code>CAPABILITY_VIOLATION</code>.
            </p>
          </div>
        </div>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/api" className="text-accent hover:underline">
            API Reference →
          </a>
        </div>
      </footer>
    </div>
  );
}
