"use client";

import { ROUTES } from "@/lib/routes";

const tiers = [
  {
    name: "Reach (OSS)",
    description: "For individuals and teams getting started with local, deterministic runs.",
    price: "Free",
    period: "forever",
    features: [
      "Unlimited local runs",
      "Community-driven skill packs",
      "Run history in local UI",
      "Community support",
    ],
    cta: "Install CLI",
    href: ROUTES.DOCS,
    highlighted: false,
  },
  {
    name: "ReadyLayer Pro",
    description: "For teams needing cloud-based reporting, collaboration, and alerts.",
    price: "Usage-based",
    period: "with $29 base",
    features: [
      "Everything in Reach (OSS)",
      "Unlimited Cloud Reports",
      "Private Skill Packs",
      "Advanced Simulation compute",
      "Drift Guard alerts",
      "Team collaboration",
      "Priority support",
    ],
    cta: "Start with Pro",
    href: ROUTES.REGISTER,
    highlighted: true,
  },
  {
    name: "ReadyLayer Enterprise",
    description: "For mission-critical reliability, security, and compliance.",
    price: "Custom",
    period: "contact sales",
    features: [
      "Everything in Pro",
      "Agent Contracts & SLAs",
      "SOC2 Audit Artifacts",
      "Dedicated Infrastructure",
      "Single-tenant data isolation",
      "24/7 Premium support",
    ],
    cta: "Talk to Sales",
    href: ROUTES.CONTACT,
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <div className="section-container py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Find the right plan for your team</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Start for free with the Reach OSS CLI, and scale with the ReadyLayer cloud platform when
          you need enterprise-grade governance.
        </p>
      </div>

      {/* Pricing Grid */}
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`card flex flex-col ${tier.highlighted ? "border-accent relative" : ""}`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-accent text-white">
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">{tier.name}</h2>
              <p className="text-gray-400 text-sm">{tier.description}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">{tier.price}</span>
              {tier.period && <span className="text-gray-400 ml-2">{tier.period}</span>}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <svg
                    className="w-5 h-5 text-emerald-400 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href={tier.href}
              className={`text-center py-3 rounded-lg font-medium transition-colors ${
                tier.highlighted ? "btn-primary" : "btn-secondary"
              }`}
            >
              {tier.cta}
            </a>
          </div>
        ))}
      </div>

      {/* Feature Comparison Table */}
      <div className="max-w-5xl mx-auto mt-24">
        <h2 className="text-3xl font-bold text-center mb-12">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-4 px-6 text-gray-500 font-medium">Capability</th>
                <th className="py-4 px-6 text-white font-bold text-center">Reach (OSS)</th>
                <th className="py-4 px-6 text-white font-bold text-center">ReadyLayer Pro</th>
                <th className="py-4 px-6 text-white font-bold text-center">
                  ReadyLayer Enterprise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="py-4 px-6 text-gray-300">Deterministic Engine</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">Bit-Identical Replay</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">CI Gate Enforcement</td>
                <td className="py-4 px-6 text-center text-emerald-400">Local Only</td>
                <td className="py-4 px-6 text-center text-emerald-400">Managed CI</td>
                <td className="py-4 px-6 text-center text-emerald-400">Managed CI</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">Drift Guard Alerts</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">Multi-tenant Control Plane</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">Hosted Eval Dashboards</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">SOC2 Compliance Logs</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">Agent Contracts & SLAs</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300">Single-tenant Hosting</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-gray-600">—</td>
                <td className="py-4 px-6 text-center text-emerald-400">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Calculator */}
      <div className="max-w-3xl mx-auto mt-24">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Estimate Your Usage</h2>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-accent">$0.001</div>
              <div className="text-sm text-gray-400">per request</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent">$0.10</div>
              <div className="text-sm text-gray-400">per compute minute</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent">$0.50</div>
              <div className="text-sm text-gray-400">per GB stored/month</div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Volume discounts available for Enterprise plans. Contact sales for details.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto mt-24">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            {
              q: "Can I run Reach completely offline?",
              a: "Yes. Reach (OSS) is designed for local-first, air-gapped environments. ReadyLayer Pro/Enterprise features require a connection to our cloud or a self-hosted control plane.",
            },
            {
              q: "How does usage-based pricing work?",
              a: "You only pay for the managed requests made to the cloud platform, compute time for remote simulations, and storage for hosted capsules. Local runs are always free.",
            },
            {
              q: "Do you offer SOC2 audit artifacts?",
              a: "Yes, SOC2 and compliance reporting are available exclusively on the Enterprise tier.",
            },
            {
              q: "Is there a limit to local execution?",
              a: "No. Reach (OSS) has no hard limits on local execution, tasks, or packets.",
            },
          ].map((faq, i) => (
            <div key={i} className="card">
              <h3 className="font-bold mb-2">{faq.q}</h3>
              <p className="text-gray-400 text-sm">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
