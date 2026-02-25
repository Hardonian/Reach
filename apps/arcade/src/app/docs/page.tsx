import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation | ReadyLayer",
  description:
    "Master the ReadyLayer deterministic execution fabric with our comprehensive documentation and guides.",
};

export default function DocsPage() {
  const categories = [
    {
      title: "Getting Started",
      description: "Go from zero to a fully deterministic execution in 5 minutes.",
      href: "/docs/getting-started",
      icon: "🚀",
    },
    {
      title: "Architecture",
      description: "Deep dive into the core engine, signed packs, and capability firewalls.",
      href: "/docs/architecture",
      icon: "🏗️",
    },
    {
      title: "MCP Integration",
      description: "Standardize tool access with the Model Context Protocol.",
      href: "/docs/mcp",
      icon: "🔌",
    },
    {
      title: "API Reference",
      description: "Explore the gRPC and REST interfaces for ReadyLayer services.",
      href: "/docs/api",
      icon: "📚",
    },
    {
      title: "CLI Tooling",
      description: "Master the reach command line and diagnostic utility.",
      href: "/docs/cli",
      icon: "💻",
    },
    {
      title: "Governance",
      description: "Manage policies, compliance, and oversight for agent systems.",
      href: "/docs/governance",
      icon: "⚖️",
    },
    {
      title: "Deployment",
      description: "How to deploy ReadyLayer across Cloud, Edge, and Mobile.",
      href: "/docs/deployment",
      icon: "🚢",
    },
  ];

  return (
    <div className="section-container py-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-16 text-center">
          <h1 className="text-5xl font-extrabold mb-6 tracking-tight text-white">
            Reach <span className="text-gradient">Documentation</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Everything you need to build, deploy, and govern deterministic agentic workloads at
            global scale.
          </p>
        </header>

        {/* Docs At a Glance */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 px-4">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
            <h3 className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
              What is this?
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              An open-source protocol and deterministic engine for running AI agents with guaranteed
              replayability and strict policy enforcement.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
              Who is it for?
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Developers and architects building production AI systems who need to eliminate
              non-deterministic bugs and satisfy audit requirements.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
              Why use it?
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              To move away from "vibes-based" testing and into rigorous, auditable AI operations
              with bit-identical execution parity across environments.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              key={category.href}
              href={category.href}
              className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-accent/50 hover:bg-white/[0.07] transition-all duration-300 flex flex-col items-start gap-4"
            >
              <div className="text-3xl grayscale group-hover:grayscale-0 transition-all duration-300">
                {category.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2 text-white group-hover:text-accent transition-colors">
                  {category.title}
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">{category.description}</p>
              </div>
              <div className="mt-auto pt-4 text-accent text-xs font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                Explore Documentation <span>→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-20 p-1 bg-linear-to-r from-accent/20 via-border to-accent/20 rounded-3xl">
          <div className="bg-[#0A0A0B] rounded-[calc(1.5rem-1px)] p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-md">
              <h2 className="text-3xl font-bold mb-4">Enterprise Grade Support</h2>
              <p className="text-gray-400 mb-6">
                Looking for SLAs, mission-critical response times, or custom integration assistance?
                Our team is here to help.
              </p>
              <div className="flex gap-4">
                <Link href="/support" className="btn-primary py-3 px-8">
                  Get Support
                </Link>
                <Link href="/faq" className="btn-secondary py-3 px-8">
                  Read FAQ
                </Link>
              </div>
            </div>
            <div className="hidden md:block w-32 h-32 opacity-20 rotate-12">
              <span className="text-8xl">🛡️</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
