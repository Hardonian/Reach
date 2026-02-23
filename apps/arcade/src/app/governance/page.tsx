"use client";

import React, { useState } from "react";
import { PolicyRow } from "@/components/PolicyRow";
import { EmptyState } from "@/components/EmptyState";
import { StatusIndicator } from "@/components/StatusIndicator";

// Mock data
const mockPolicies = [
  {
    id: "policy-1",
    name: "Data Residency - EU Only",
    description: "Ensure all data processing occurs within EU regions only",
    type: "data-residency",
    severity: "critical" as const,
    status: "active" as const,
    regions: ["eu-west-1", "eu-central-1"],
    createdAt: "2024-01-15",
  },
  {
    id: "policy-2",
    name: "Rate Limit - 1000 req/min",
    description: "Maximum 1000 requests per minute per API key",
    type: "rate-limit",
    severity: "high" as const,
    status: "active" as const,
    limit: 1000,
    window: "1m",
    createdAt: "2024-01-10",
  },
  {
    id: "policy-3",
    name: "PII Redaction Required",
    description: "Automatically redact personally identifiable information",
    type: "pii",
    severity: "critical" as const,
    status: "active" as const,
    fields: ["email", "phone", "ssn"],
    createdAt: "2024-01-05",
  },
  {
    id: "policy-4",
    name: "Model Access - GPT-4 Only",
    description: "Restrict model access to GPT-4 for compliance",
    type: "model-restriction",
    severity: "medium" as const,
    status: "draft" as const,
    allowedModels: ["gpt-4"],
    createdAt: "2024-01-20",
  },
];

const mockAuditLog = [
  {
    id: "audit-1",
    timestamp: "2024-01-20T14:32:00Z",
    actor: "admin@company.com",
    action: "policy.created",
    resource: "Data Residency - EU Only",
    status: "success" as const,
    details: "Policy activated for all EU workloads",
  },
  {
    id: "audit-2",
    timestamp: "2024-01-20T13:45:00Z",
    actor: "user@company.com",
    action: "agent.deployed",
    resource: "customer-support-bot",
    status: "success" as const,
    details: "Deployed to us-east-1, us-west-2",
  },
  {
    id: "audit-3",
    timestamp: "2024-01-20T12:20:00Z",
    actor: "system",
    action: "policy.violation",
    resource: "data-pipeline-agent",
    status: "blocked" as const,
    details: "Attempted to process data outside allowed regions",
  },
  {
    id: "audit-4",
    timestamp: "2024-01-20T11:15:00Z",
    actor: "admin@company.com",
    action: "permission.granted",
    resource: "Engineering Team",
    status: "success" as const,
    details: "Granted deploy access to staging environment",
  },
  {
    id: "audit-5",
    timestamp: "2024-01-20T10:00:00Z",
    actor: "user@company.com",
    action: "agent.updated",
    resource: "notification-router",
    status: "failed" as const,
    details: "Unauthorized modification attempt",
  },
];

const mockPermissions = [
  {
    role: "Admin",
    deploy: true,
    configure: true,
    audit: true,
    manageUsers: true,
    managePolicies: true,
  },
  {
    role: "Developer",
    deploy: true,
    configure: true,
    audit: false,
    manageUsers: false,
    managePolicies: false,
  },
  {
    role: "Operator",
    deploy: true,
    configure: false,
    audit: true,
    manageUsers: false,
    managePolicies: false,
  },
  {
    role: "Viewer",
    deploy: false,
    configure: false,
    audit: true,
    manageUsers: false,
    managePolicies: false,
  },
];

export default function Governance() {
  const [activeTab, setActiveTab] = useState<"policies" | "audit" | "permissions">("policies");

  const handleEditPolicy = (id: string) => {
    // TODO: Implement edit policy
  };

  const handleDeletePolicy = (id: string) => {
    // TODO: Implement delete policy
  };

  return (
    <div className="section-container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Governance & Compliance</h1>
        <p className="text-gray-400">Manage policies, audit trails, and access control</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg mb-8 w-fit">
        {(["policies", "audit", "permissions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? "bg-accent text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Policies Tab */}
      {activeTab === "policies" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Policy Rules</h2>
            <button className="btn-primary text-sm py-2">+ New Policy</button>
          </div>

          <div className="space-y-3">
            {mockPolicies.length > 0 ? (
              mockPolicies.map((policy) => (
                <PolicyRow
                  key={policy.id}
                  {...policy}
                  onEdit={handleEditPolicy}
                  onDelete={handleDeletePolicy}
                />
              ))
            ) : (
              <EmptyState
                icon="🛡️"
                title="No policies yet"
                description="Create your first policy to enforce compliance rules across your agents."
                action={{
                  label: "Create Policy",
                  onClick: () => {
                    /* TODO: Implement create policy */
                  },
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Audit Log</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search events..."
                className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              <button className="btn-secondary text-sm py-2">Export</button>
            </div>
          </div>

          {mockAuditLog.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 text-sm font-medium text-gray-500">Timestamp</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Actor</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Action</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Resource</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAuditLog.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50">
                      <td className="py-4 text-sm font-mono text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 text-sm">{entry.actor}</td>
                      <td className="py-4 text-sm">
                        <code className="px-2 py-1 rounded bg-surface-hover text-accent">
                          {entry.action}
                        </code>
                      </td>
                      <td className="py-4 text-sm">{entry.resource}</td>
                      <td className="py-4">
                        <StatusIndicator
                          status={
                            entry.status === "success"
                              ? "online"
                              : entry.status === "blocked"
                                ? "error"
                                : "warning"
                          }
                          showLabel
                          size="sm"
                        />
                      </td>
                      <td className="py-4 text-sm text-gray-500">{entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="📋"
              title="No audit events"
              description="Audit events will appear here when actions are performed."
            />
          )}
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Permission Matrix</h2>
            <button className="btn-primary text-sm py-2">+ New Role</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-sm font-medium text-gray-500">Role</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-center">Deploy</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-center">Configure</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-center">Audit</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-center">
                    Manage Users
                  </th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-center">
                    Manage Policies
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockPermissions.map((perm) => (
                  <tr key={perm.role} className="border-b border-border/50">
                    <td className="py-4 font-medium">{perm.role}</td>
                    <td className="py-4 text-center">
                      {perm.deploy ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-gray-600">✗</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {perm.configure ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-gray-600">✗</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {perm.audit ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-gray-600">✗</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {perm.manageUsers ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-gray-600">✗</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {perm.managePolicies ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-gray-600">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-surface/50 rounded-lg border border-border">
            <h3 className="font-bold mb-2">Permission Guidelines</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Admin: Full access to all platform features and user management</li>
              <li>• Developer: Can deploy and configure agents, view audit logs</li>
              <li>
                • Operator: Can deploy agents and view audit logs, cannot modify configurations
              </li>
              <li>• Viewer: Read-only access to audit logs and configurations</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
