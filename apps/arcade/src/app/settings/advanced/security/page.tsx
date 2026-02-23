"use client";

import { BRAND_NAME } from "@/lib/brand";

export default function SecuritySettingsPage() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>Settings</span>
        <span className="material-symbols-outlined text-[12px]">
          chevron_right
        </span>
        <span>Advanced</span>
        <span className="material-symbols-outlined text-[12px]">
          chevron_right
        </span>
        <span className="text-white">Security</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Security</h1>
      <p className="text-gray-400 max-w-2xl mb-8">
        Manage authentication, access controls, and security settings for your{" "}
        {BRAND_NAME} account.
      </p>

      {/* MFA */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <span className="material-symbols-outlined">lock</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Multi-Factor Authentication
              </h2>
              <p className="text-sm text-gray-400">
                Protect your account with an additional verification step.
              </p>
            </div>
          </div>
          <span className="status-pill online text-xs">Enabled</span>
        </div>
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Method</span>
            <p className="font-medium mt-0.5">Authenticator App</p>
          </div>
          <div>
            <span className="text-gray-400">Recovery Codes</span>
            <p className="font-medium mt-0.5">3 remaining</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button className="btn-secondary text-sm py-1.5 px-3">
            Regenerate Recovery Codes
          </button>
          <button className="text-sm text-red-400 hover:text-red-300 transition-colors">
            Disable MFA
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            <span className="material-symbols-outlined">password</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Password</h2>
            <p className="text-sm text-gray-400">Last changed 45 days ago.</p>
          </div>
        </div>
        <button className="btn-secondary text-sm py-1.5 px-3">
          Change Password
        </button>
      </div>

      {/* Active Sessions */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <span className="material-symbols-outlined">devices</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Active Sessions</h2>
            <p className="text-sm text-gray-400">
              Devices currently signed into your account.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            {
              device: "Chrome on macOS",
              location: "San Francisco, US",
              current: true,
              lastActive: "Now",
            },
            {
              device: "Firefox on Windows",
              location: "London, UK",
              current: false,
              lastActive: "2 days ago",
            },
          ].map((s) => (
            <div
              key={s.device}
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-border"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-400">
                  {s.device.includes("macOS")
                    ? "laptop_mac"
                    : "desktop_windows"}
                </span>
                <div>
                  <p className="text-sm font-medium">{s.device}</p>
                  <p className="text-xs text-gray-500">
                    {s.location} ·{" "}
                    {s.current ? (
                      <span className="text-emerald-400">Current Session</span>
                    ) : (
                      `Active ${s.lastActive}`
                    )}
                  </p>
                </div>
              </div>
              {!s.current && (
                <button className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button className="text-sm text-red-400 hover:text-red-300 transition-colors">
            Revoke All Other Sessions
          </button>
        </div>
      </div>

      {/* Audit Log */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <button className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
            View Full Log
          </button>
        </div>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-border">
            {[
              { action: "Signed in", ip: "192.168.1.1", time: "2 mins ago" },
              {
                action: "API key created",
                ip: "192.168.1.1",
                time: "1 hour ago",
              },
              {
                action: "Password changed",
                ip: "10.0.0.42",
                time: "45 days ago",
              },
            ].map((a, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-3 font-medium">{a.action}</td>
                <td className="px-6 py-3 text-gray-400 font-mono text-xs">
                  {a.ip}
                </td>
                <td className="px-6 py-3 text-gray-400 text-right">{a.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
