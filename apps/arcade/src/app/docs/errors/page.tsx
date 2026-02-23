import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Error Codes | ReadyLayer Documentation",
  description:
    "Reference guide for common ReadyLayer execution and policy errors.",
};

export default function ErrorsPage() {
  const commonErrors = [
    {
      code: "ERR_POL_001",
      title: "Capability Violation",
      desc: "The agent attempted to call a tool not listed in its signed pack manifest.",
    },
    {
      code: "ERR_DET_402",
      title: "Drift Detected",
      desc: "The execution core detected non-deterministic behavior during a replay attempt.",
    },
    {
      code: "ERR_NET_503",
      title: "MCP Timeout",
      desc: "An MCP tool server failed to respond within the policy-defined timeout boundary.",
    },
    {
      code: "ERR_AUTH_403",
      title: "Token Expired",
      desc: "The session bearer token has expired or the signature is invalid.",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold mb-4">Error Codes</h1>
        <p className="text-xl text-gray-400">
          ReadyLayer uses structured error codes to help debug policy and
          execution issues.
        </p>
      </header>

      <section className="space-y-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-gray-400 text-sm">
              <th className="py-2 pr-4 font-semibold uppercase tracking-wider">
                Code
              </th>
              <th className="py-2 pr-4 font-semibold uppercase tracking-wider">
                Title
              </th>
              <th className="py-2 font-semibold uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {commonErrors.map((err) => (
              <tr key={err.code}>
                <td className="py-4 pr-4 font-mono text-accent text-sm whitespace-nowrap">
                  {err.code}
                </td>
                <td className="py-4 pr-4 font-bold">{err.title}</td>
                <td className="py-4 text-sm text-gray-400">{err.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
