import { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Status | ReadyLayer",
  description:
    "Live status and uptime reporting for ReadyLayer core services and orchestration platform.",
};

export default function SystemStatusPage() {
  const systems = [
    {
      name: "Runner Engine",
      status: "Operational",
      uptime: "99.99%",
      region: "Global",
    },
    {
      name: "Marketplace Registry",
      status: "Operational",
      uptime: "99.98%",
      region: "Global",
    },
    {
      name: "Policy Orchestrator",
      status: "Operational",
      uptime: "100%",
      region: "Global",
    },
    {
      name: "Session Hub",
      status: "Operational",
      uptime: "99.95%",
      region: "Multi-Region",
    },
    {
      name: "ReadyLayer Arcade UI",
      status: "Operational",
      uptime: "99.99%",
      region: "Edge",
    },
  ];

  const incidents = [
    {
      date: "Feb 18, 2026",
      title: "Registry Latency Spike",
      resolved: true,
      description:
        "Brief latency spike in marketplace resolution due to peak routing load. Mitigated via auto-scaling.",
    },
    {
      date: "Feb 12, 2026",
      title: "Scheduled Maintenance",
      resolved: true,
      description:
        "Upgraded deterministic core to v2.4.0. Completed with zero downtime.",
    },
  ];

  return (
    <div className="section-container py-16">
      <div className="max-w-4xl mx-auto">
        <header className="mb-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-bold mb-4">System Status</h1>
            <p className="text-gray-400">
              Live reporting for all ReadyLayer core services.
            </p>
          </div>
          <div className="px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center gap-4">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-500 font-bold uppercase tracking-widest text-sm">
              All Systems Operational
            </span>
          </div>
        </header>

        {/* Status Table */}
        <section className="mb-20">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            Core Infrastructure <span className="w-5 h-px bg-white/20"></span>
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-gray-500">
                  <th className="px-8 py-4 font-bold text-gray-400">System</th>
                  <th className="px-8 py-4 font-bold text-gray-400">Status</th>
                  <th className="px-8 py-4 font-bold text-gray-400">Uptime</th>
                  <th className="px-8 py-4 font-bold text-gray-400">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {systems.map((s) => (
                  <tr
                    key={s.name}
                    className="group hover:bg-white/2 transition-colors"
                  >
                    <td className="px-8 py-6 font-semibold text-white">
                      {s.name}
                    </td>
                    <td className="px-8 py-6">
                      <span className="flex items-center gap-2 text-sm text-green-400">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm text-gray-400">
                      {s.uptime}
                    </td>
                    <td className="px-8 py-6 text-xs text-gray-500 font-mono italic">
                      {s.region}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Incidents */}
        <section>
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            Incident History <span className="w-5 h-px bg-white/20"></span>
          </h2>
          <div className="space-y-4">
            {incidents.map((i, index) => (
              <div
                key={index}
                className="p-8 bg-white/5 border border-white/10 rounded-3xl"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-gray-500 font-mono">
                    {i.date}
                  </span>
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] rounded border border-green-500/20 font-bold uppercase tracking-tight">
                    Resolved
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3">{i.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed italic">
                  {i.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 text-center">
          <p className="text-xs text-gray-600">
            ReadyLayer status data is updated every 60 seconds. <br />
            For personalized status reports, please visit your organization
            dashboard.
          </p>
          <div className="mt-8 pt-8 border-t border-white/5 grid md:grid-cols-2 gap-8 text-left max-w-2xl mx-auto">
            <div>
              <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">
                Communication
              </h4>
              <p className="text-xs text-gray-400">
                Major outages are broadcast via our official 𝕏 feed and the
                ReadyLayer status Discord channel. Critical security patches are
                coordinated via the security mailing list.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">
                Tracking
              </h4>
              <p className="text-xs text-gray-400">
                You can track active resolution progress in the
                <a
                  href="https://github.com"
                  className="text-accent hover:underline ml-1"
                >
                  GitHub Status Discussion
                </a>
                .
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
