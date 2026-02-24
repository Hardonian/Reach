import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deployment Guide | ReadyLayer Documentation',
  description: 'How to deploy ReadyLayer across various environments from Desktop to Mobile and Cloud.',
};

export default function DeploymentPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">Deployment Guide</h1>
        <p className="text-xl text-gray-400">
          ReadyLayer is designed for portability. Deploy it on servers, dev machines, edge devices, or mobile terminals.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Deployment Targets</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Server / Cloud</h3>
            <p className="text-sm text-gray-400">
              Ideal for high-throughput orchestration and production API loads.
              Supports Docker, Kubernetes, and bare metal (Linux/amd64/arm64).
            </p>
            <div className="mt-4 flex gap-2">
              <span className="badge bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded border border-green-500/20">Production Ready</span>
            </div>
          </div>
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Mobile (Termux)</h3>
            <p className="text-sm text-gray-400">
              Run localized agent workloads directly on Android devices.
              Optimized for low-memory and offline-first scenarios.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="badge bg-blue-500/10 text-blue-500 text-[10px] px-2 py-0.5 rounded border border-blue-500/20">Edge Optimized</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Docker Deployment</h2>
        <p className="text-gray-400">
          The recommended way to run ReadyLayer in production is via Docker Compose.
        </p>
        <div className="bg-black/40 border border-border rounded-xl p-6 font-mono text-sm overflow-x-auto">
{`# docker-compose.yml
services:
  runner:
    image: reach/runner:latest
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
      - ./config.yaml:/app/config.yaml
    environment:
      - REACH_MODE=production
      - DATABASE_URL=sqlite:///app/data/reach.db`}
        </div>
        <div className="mt-4">
          <code className="bg-white/5 px-3 py-1 rounded text-sm select-all">docker-compose up -d</code>
        </div>
      </section>

      <section className="space-y-8">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Environment Configuration</h2>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-white">Variable</th>
              <th className="py-2 text-white">Default</th>
              <th className="py-2 text-white">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            <tr className="border-b border-border/5">
              <td className="py-3 font-mono text-accent">REACH_PORT</td>
              <td className="py-3">8080</td>
              <td className="py-3">Interface port for the API</td>
            </tr>
            <tr className="border-b border-border/5">
              <td className="py-3 font-mono text-accent">REACH_LOG_LEVEL</td>
              <td className="py-3">info</td>
              <td className="py-3">debug, info, warn, error</td>
            </tr>
            <tr className="border-b border-border/5">
              <td className="py-3 font-mono text-accent">REACH_LOW_MEMORY</td>
              <td className="py-3">false</td>
              <td className="py-3">Enables aggressive GC for mobile/edge</td>
            </tr>
            <tr className="border-b border-border/5">
              <td className="py-3 font-mono text-accent">DATABASE_URL</td>
              <td className="py-3">sqlite://...</td>
              <td className="py-3">Postgres or SQLite connection string</td>
            </tr>
          </tbody>
        </table>
      </section>


      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Vercel Project Alignment</h2>
        <p className="text-gray-400">
          Keep project settings aligned with repository configuration so builds remain deterministic.
          Use <code className="bg-white/5 px-1 rounded">apps/arcade</code> as the project root,
          keep Node.js in the 18-22 range, and ensure build/install commands match <code className="bg-white/5 px-1 rounded">vercel.json</code>.
        </p>
        <div className="bg-black/40 border border-border rounded-xl p-6 font-mono text-sm overflow-x-auto">
{`Root Directory: apps/arcade
Install Command: npm install
Build Command: npm run build
Node.js: 18.x or 22.x (must satisfy >=18 <23)`}
        </div>
      </section>
      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Static Asset Preparation</h2>
        <p className="text-gray-400">
          When deploying the <strong>ReadyLayer Arcade</strong>, ensure static params are generated for
          all documentation routes to prevent runtime lookups.
        </p>
        <div className="bg-white/5 p-6 rounded-xl border border-white/10 italic text-sm text-gray-400">
          "ReadyLayer builds are strictly validated. If a route defined in the navigation map is missing
          during the build phase, the CI pipeline will terminate with a <code>ROUTE_INTEGRITY_FAILURE</code>."
        </div>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/security" className="text-accent hover:underline">Security Hardening →</a>
        </div>
      </footer>
    </div>
  );
}
