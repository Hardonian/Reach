"use client";

import { BRAND_NAME } from "@/lib/brand";

export default function BillingPage() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>Settings</span>
        <span className="material-symbols-outlined text-[12px]">
          chevron_right
        </span>
        <span className="text-white">Billing</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Billing</h1>
      <p className="text-gray-400 max-w-2xl mb-8">
        Manage your {BRAND_NAME} subscription, payment methods, and invoices.
      </p>

      {/* Current Plan */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Current Plan</h2>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-accent">Pro</span>
              <span className="status-pill online text-xs">Active</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              $49/month · Billed monthly · Renews Mar 1, 2026
            </p>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary text-sm py-2 px-4">
              Change Plan
            </button>
            <button className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-gray-400 mb-1">API Calls (this cycle)</p>
          <p className="text-2xl font-bold">12,480</p>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-accent h-1.5 rounded-full"
              style={{ width: "42%" }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">42% of 30,000 limit</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400 mb-1">Tokens Used</p>
          <p className="text-2xl font-bold">450,230</p>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: "65%" }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">65% of 700k limit</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400 mb-1">Current Spend</p>
          <p className="text-2xl font-bold">$12.50</p>
          <p className="text-xs text-gray-500 mt-1">of $49.00 plan</p>
        </div>
      </div>

      {/* Payment Method */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-border">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-gray-400">
              credit_card
            </span>
            <div>
              <p className="text-sm font-medium">Visa ending in 4242</p>
              <p className="text-xs text-gray-500">Expires 12/2027</p>
            </div>
          </div>
          <button className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
            Update
          </button>
        </div>
      </div>

      {/* Invoice History */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Invoice History</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-gray-500 uppercase text-xs font-semibold tracking-wider">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              { date: "Feb 1, 2026", amount: "$49.00", status: "Paid" },
              { date: "Jan 1, 2026", amount: "$49.00", status: "Paid" },
              { date: "Dec 1, 2025", amount: "$49.00", status: "Paid" },
            ].map((inv) => (
              <tr
                key={inv.date}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-6 py-3 text-gray-300">{inv.date}</td>
                <td className="px-6 py-3 font-medium">{inv.amount}</td>
                <td className="px-6 py-3">
                  <span className="status-pill online text-xs">
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button className="text-accent hover:text-accent/80 text-xs font-medium transition-colors">
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
