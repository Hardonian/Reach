export default function Governance() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Governance</h1>
        <p className="text-gray-400 mb-8">
          Manage policies, compliance, and oversight for agent behavior and platform operations.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">What is Agent Governance?</h2>
            <p className="text-gray-400">
              Governance in Reach provides frameworks for controlling agent behavior, ensuring compliance with policies, and maintaining accountability. It encompasses access control, audit logging, policy enforcement, and human oversight.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Policy Framework</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Policy Definition</h3>
                <p>Policies are declarative rules that constrain agent behavior. They can be defined at organization, project, or agent levels.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Policy Types</h3>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Security policies (access control, data handling)</li>
                  <li>Operational policies (rate limits, resource usage)</li>
                  <li>Ethical policies (content restrictions, bias prevention)</li>
                  <li>Compliance policies (regulatory requirements)</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Access Control</h2>
            <p className="text-gray-400 mb-4">
              Role-based access control (RBAC) for agents and users:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`# policy.yaml`}</p>
              <p>{`roles:`}</p>
              <p>{`  - name: agent-operator`}</p>
              <p>{`    permissions:`}</p>
              <p>{`      - agent:deploy`}</p>
              <p>{`      - agent:execute`}</p>
              <p>{`      - agent:monitor`}</p>
              <p>{`  - name: agent-developer`}</p>
              <p>{`    permissions:`}</p>
              <p>{`      - agent:create`}</p>
              <p>{`      - agent:edit`}</p>
              <p>{`      - agent:test`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Audit & Compliance</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Audit Logging</h3>
                <p className="text-gray-400 text-sm">Comprehensive logs of all agent actions, decisions, and data access.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Traceability</h3>
                <p className="text-gray-400 text-sm">End-to-end tracking of request flow through multiple agents.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Compliance Reports</h3>
                <p className="text-gray-400 text-sm">Automated generation of compliance documentation.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Data Retention</h3>
                <p className="text-gray-400 text-sm">Configurable policies for data lifecycle management.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Human-in-the-Loop</h2>
            <p className="text-gray-400 mb-4">
              Require human approval for critical decisions:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`steps:`}</p>
              <p>{`  - name: high-value-transfer`}</p>
              <p>{`    agent: payment-agent`}</p>
              <p>{`    approval:`}</p>
              <p>{`      required: true`}</p>
              <p>{`      approvers:`}</p>
              <p>{`        - role: finance-manager`}</p>
              <p>{`      timeout: 24h`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Governance APIs</h2>
            <p className="text-gray-400 mb-4">
              Programmatically manage governance:
            </p>
            <ul className="space-y-2 text-gray-400">
              <li>• <code className="bg-black/50 px-2 py-1 rounded">POST /v1/policies</code> - Create policies</li>
              <li>• <code className="bg-black/50 px-2 py-1 rounded">GET /v1/audit/logs</code> - Query audit logs</li>
              <li>• <code className="bg-black/50 px-2 py-1 rounded">POST /v1/approvals</code> - Submit approvals</li>
              <li>• <code className="bg-black/50 px-2 py-1 rounded">GET /v1/compliance/report</code> - Generate reports</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
