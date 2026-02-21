'use client';

import { useState } from 'react';
import { BRAND_NAME } from '@/lib/brand';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scope: string;
  scopeColor: string;
  created: string;
  lastUsed: string;
}

const demoKeys: ApiKey[] = [
  {
    id: '1',
    name: 'Production Runner 01',
    prefix: 'sk_live_...4f9a',
    scope: 'Runner Trigger',
    scopeColor: 'text-blue-400 bg-blue-400/10 ring-blue-400/20',
    created: 'Oct 20, 2023',
    lastUsed: '2 mins ago',
  },
  {
    id: '2',
    name: 'CI/CD Pipeline Read',
    prefix: 'sk_live_...9b2x',
    scope: 'Read Only',
    scopeColor: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20',
    created: 'Sep 15, 2023',
    lastUsed: '5 days ago',
  },
  {
    id: '3',
    name: 'Admin Dashboard Local',
    prefix: 'sk_test_...1z8q',
    scope: 'Admin',
    scopeColor: 'text-accent bg-accent/10 ring-accent/20',
    created: 'Nov 02, 2023',
    lastUsed: 'Never',
  },
];

export default function ApiKeysPage() {
  const [keys] = useState<ApiKey[]>(demoKeys);

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>Settings</span>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-white">API Keys</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-2">User Profile &amp; API Keys</h1>
      <p className="text-gray-400 max-w-2xl mb-8">
        Manage your personal account details, developer access tokens, and security
        preferences for the {BRAND_NAME} Orchestration Plane.
      </p>

      {/* Profile + Usage Stats grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Profile Card */}
        <div className="lg:col-span-2 card flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-accent/30 flex items-center justify-center text-2xl font-bold text-white">
              JD
            </div>
            <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-emerald-500 border-4 border-surface" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold">John Doe</h2>
              <span className="status-pill pending text-xs">Senior DevOps Engineer</span>
            </div>
            <p className="text-gray-400 text-sm mt-1">Primary Org: <span className="text-white font-medium">Acme Corp</span></p>
            <p className="text-gray-400 text-sm">john.doe@acme.corp</p>
          </div>
          <button className="text-sm font-medium text-accent hover:text-accent/80 transition-colors">
            Edit Profile
          </button>
        </div>

        {/* Usage Stats */}
        <div className="flex flex-col gap-4">
          <div className="card relative overflow-hidden group flex-1">
            <p className="text-sm font-medium text-gray-400 mb-1">Token Consumption (Monthly)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">450,230</span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>12%
              </span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-accent h-1.5 rounded-full" style={{ width: '65%' }} />
            </div>
          </div>
          <div className="card relative overflow-hidden group flex-1">
            <p className="text-sm font-medium text-gray-400 mb-1">Estimated Cost</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">$12.50</span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>5%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys Table */}
      <div className="card p-0 overflow-hidden mb-8">
        <div className="border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Personal API Keys</h2>
            <p className="text-sm text-gray-400">Manage API keys for accessing the {BRAND_NAME} platform via CLI or SDK.</p>
          </div>
          <button className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Generate New Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-gray-500 uppercase text-xs font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Key Name</th>
                <th className="px-6 py-4">Scope</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Last Used</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{k.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="px-1.5 py-0.5 rounded bg-white/5 text-xs font-mono text-gray-400">
                          {k.prefix}
                        </code>
                        <button className="text-gray-500 hover:text-accent transition-colors" title="Copy">
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${k.scopeColor}`}>
                      {k.scope}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{k.created}</td>
                  <td className="px-6 py-4 text-gray-300">{k.lastUsed}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button className="p-1 rounded text-gray-400 hover:text-accent hover:bg-white/5 transition-colors" title="Rotate Key">
                        <span className="material-symbols-outlined text-[20px]">sync</span>
                      </button>
                      <button className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Revoke Key">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MFA */}
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <span className="material-symbols-outlined">lock</span>
              </div>
              <div>
                <h3 className="text-base font-semibold">Multi-Factor Authentication</h3>
                <p className="text-sm text-gray-400">Add an extra layer of security to your account.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Enabled
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-400">Method</span>
              <span className="font-medium">Authenticator App</span>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <span className="material-symbols-outlined">devices</span>
            </div>
            <div>
              <h3 className="text-base font-semibold">Active Sessions</h3>
              <p className="text-sm text-gray-400">Manage devices logged into your account.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-400 text-2xl">laptop_mac</span>
                <div>
                  <p className="text-sm font-medium">Chrome on macOS</p>
                  <p className="text-xs text-gray-500">San Francisco, US · <span className="text-emerald-400">Current Session</span></p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-400 text-2xl">desktop_windows</span>
                <div>
                  <p className="text-sm font-medium">Firefox on Windows</p>
                  <p className="text-xs text-gray-500">London, UK · Active 2 days ago</p>
                </div>
              </div>
              <button className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
                Revoke
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
