"use client";

import React from "react";

type IntegrationStatus = "Connected" | "Pending" | "Disconnected";
type IntegrationHealth = "Healthy" | "Degraded" | "Disconnected";
type SyncLevel = "success" | "warning" | "info";

interface IntegrationCard {
  name: string;
  status: IntegrationStatus;
  category: string;
  icon: string;
  desc: string;
}

interface HealthRow {
  name: string;
  detail: string;
  status: IntegrationHealth;
  latency: string;
  icon: string;
}

interface SyncEvent {
  title: string;
  detail: string;
  ago: string;
  level: SyncLevel;
}

interface WebhookEvent {
  src: string;
  ev: string;
  status: string;
  statusClass: string;
  time: string;
}

const integrations: IntegrationCard[] = [
  {
    name: "GitHub",
    status: "Connected",
    category: "Source Control",
    icon: "code",
    desc: "Repository sync and CI/CD triggers",
  },
  {
    name: "Slack",
    status: "Connected",
    category: "Notifications",
    icon: "forum",
    desc: "Alert routing and incident channels",
  },
  {
    name: "Datadog",
    status: "Pending",
    category: "Observability",
    icon: "analytics",
    desc: "Metrics forwarding and APM traces",
  },
  {
    name: "PagerDuty",
    status: "Disconnected",
    category: "Incident Management",
    icon: "warning",
    desc: "On-call escalation policies",
  },
  {
    name: "Snowflake",
    status: "Connected",
    category: "Data Warehouse",
    icon: "dataset",
    desc: "Training data export pipelines",
  },
  {
    name: "Jira",
    status: "Disconnected",
    category: "Project Tracking",
    icon: "task",
    desc: "Issue creation from alerts",
  },
];

const connectedHealth: HealthRow[] = [
  { name: "AWS S3", detail: "us-east-1", status: "Healthy", latency: "24ms", icon: "cloud_queue" },
  { name: "OpenAI API", detail: "v4.0.1", status: "Healthy", latency: "156ms", icon: "smart_toy" },
  {
    name: "GitHub Webhooks",
    detail: "main-repo",
    status: "Degraded",
    latency: "840ms",
    icon: "hub",
  },
];

const syncActivity: SyncEvent[] = [
  {
    title: "User Data Sync Completed",
    detail: "Successfully synced 1,240 records to AWS S3.",
    ago: "2m ago",
    level: "success",
  },
  {
    title: "Model Fine-tuning Started",
    detail: "OpenAI job #8921 initiated via API.",
    ago: "15m ago",
    level: "info",
  },
  {
    title: "Webhook Delivery Failed",
    detail: "Slack notification endpoint returned 502 Bad Gateway.",
    ago: "1h ago",
    level: "warning",
  },
];

const webhookEvents: WebhookEvent[] = [
  {
    src: "GitHub",
    ev: "push.main",
    status: "200 OK",
    statusClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    time: "10:42 AM",
  },
  {
    src: "Slack",
    ev: "command.trigger",
    status: "200 OK",
    statusClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    time: "10:41 AM",
  },
  {
    src: "Datadog",
    ev: "alert.triggered",
    status: "202 Accepted",
    statusClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    time: "10:39 AM",
  },
];

const integrationStatusClass: Record<IntegrationStatus, string> = {
  Connected: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Disconnected: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const statValueClass = {
  Active: "text-emerald-400",
  "Pending Auth": "text-amber-400",
  Disconnected: "text-slate-300",
  "Webhooks Fired (24h)": "text-blue-400",
} as const;

const healthIconClass: Record<IntegrationHealth, string> = {
  Healthy: "bg-emerald-500/10 text-emerald-500",
  Degraded: "bg-amber-500/10 text-amber-500",
  Disconnected: "bg-slate-500/10 text-slate-400",
};

const healthStatusClass: Record<IntegrationHealth, string> = {
  Healthy: "text-emerald-500",
  Degraded: "text-amber-500",
  Disconnected: "text-slate-400",
};

const syncDotClass: Record<SyncLevel, string> = {
  success: "bg-emerald-500",
  warning: "bg-red-500",
  info: "bg-[#135bec]",
};

export function IntegrationsHub() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#101622] font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#282e39] bg-[#111318] px-10 py-5">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase tracking-widest text-[#135bec]">
            Integrations
          </h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">
            Third-party connections and webhook endpoints
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Integration
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Active", value: "3" },
            { label: "Pending Auth", value: "1" },
            { label: "Disconnected", value: "2" },
            { label: "Webhooks Fired (24h)", value: "1,284" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#1e293b] rounded-2xl border border-slate-700/50 p-6"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9da6b9] mb-2">
                {stat.label}
              </p>
              <p
                className={`text-3xl font-black ${statValueClass[stat.label as keyof typeof statValueClass]}`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">
            Available Integrations
          </h3>
          {integrations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="bg-[#1e293b] rounded-2xl border border-slate-700/50 p-6 flex flex-col gap-4 hover:border-[#135bec]/40 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#111318] border border-slate-700/50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#9da6b9] text-[20px]">
                          {integration.icon}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-black text-sm">{integration.name}</p>
                        <p className="text-[10px] text-[#9da6b9] font-bold uppercase tracking-widest">
                          {integration.category}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] border ${integrationStatusClass[integration.status]}`}
                    >
                      {integration.status}
                    </span>
                  </div>
                  <p className="text-[#9da6b9] text-xs">{integration.desc}</p>
                  <div className="mt-auto pt-2 border-t border-slate-700/50 flex justify-end">
                    <button
                      type="button"
                      className="text-[10px] font-black uppercase tracking-widest text-[#135bec] hover:text-blue-400 transition-colors"
                    >
                      {integration.status === "Connected" ? "Configure" : "Connect"} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#1e293b] rounded-2xl border border-dashed border-slate-700/50 p-8 text-center">
              <p className="text-sm font-bold text-white uppercase tracking-widest">
                No Integrations Configured
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Connect a provider to start collecting events and health telemetry.
              </p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">
            Connection Health
          </h3>
          {connectedHealth.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {connectedHealth.map((service) => (
                <div
                  key={service.name}
                  className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${healthIconClass[service.status]}`}
                      aria-hidden="true"
                    >
                      <span className="material-symbols-outlined text-lg">{service.icon}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{service.name}</span>
                      <span className="text-xs text-slate-400">{service.detail}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${healthStatusClass[service.status]}`}
                    >
                      {service.status}
                    </span>
                    <p className="text-[11px] font-mono text-slate-500 mt-1">{service.latency}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#1e293b] rounded-xl border border-dashed border-slate-700/50 p-6 text-center text-sm text-slate-400">
              Health checks unavailable right now.
            </div>
          )}
        </div>

        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">
            Sync Activity
          </h3>
          {syncActivity.length > 0 ? (
            <div className="relative pl-4 border-l border-slate-700/50 space-y-5">
              {syncActivity.map((event) => (
                <div key={`${event.title}-${event.ago}`} className="relative">
                  <div
                    className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#101622] ${syncDotClass[event.level]}`}
                    aria-hidden="true"
                  />
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{event.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{event.detail}</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {event.ago}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#1e293b] rounded-xl border border-dashed border-slate-700/50 p-6 text-center text-sm text-slate-400">
              No sync events yet.
            </div>
          )}
        </div>

        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">
            Recent Webhook Events
          </h3>
          {webhookEvents.length > 0 ? (
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700/50 overflow-x-auto">
              <table className="w-full text-left font-sans min-w-[620px]">
                <thead className="bg-[#111318] text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-8 py-4">Source</th>
                    <th className="px-8 py-4">Event</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {webhookEvents.map((row) => (
                    <tr
                      key={`${row.src}-${row.ev}-${row.time}`}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-8 py-5 font-bold text-white uppercase tracking-wide">
                        {row.src}
                      </td>
                      <td className="px-8 py-5 font-mono text-[#9da6b9] text-[11px]">{row.ev}</td>
                      <td className="px-8 py-5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] border ${row.statusClass}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right font-mono text-slate-500">{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-[#1e293b] rounded-2xl border border-dashed border-slate-700/50 p-8 text-center">
              <p className="text-sm font-bold text-white uppercase tracking-widest">
                No webhook events yet
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Events will appear after your first provider trigger.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
