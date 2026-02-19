'use client';

import { useState } from 'react';

// Mock data for the dashboard
const mockNodes = [
  { id: 'us-east-1', region: 'US East', location: 'N. Virginia', status: 'online', latency: 12, load: 45 },
  { id: 'us-west-2', region: 'US West', location: 'Oregon', status: 'online', latency: 28, load: 62 },
  { id: 'eu-west-1', region: 'Europe', location: 'Ireland', status: 'online', latency: 45, load: 38 },
  { id: 'eu-central-1', region: 'Europe', location: 'Frankfurt', status: 'warning', latency: 52, load: 78 },
  { id: 'ap-southeast-1', region: 'Asia Pacific', location: 'Singapore', status: 'online', latency: 89, load: 55 },
  { id: 'ap-northeast-1', region: 'Asia Pacific', location: 'Tokyo', status: 'online', latency: 95, load: 41 },
  { id: 'sa-east-1', region: 'South America', location: 'São Paulo', status: 'offline', latency: 0, load: 0 },
];

const mockDeployments = [
  { id: 'dep-1', name: 'customer-support-bot', version: 'v2.3.1', status: 'running', region: 'us-east-1', updated: '2 min ago' },
  { id: 'dep-2', name: 'data-pipeline-agent', version: 'v1.0.4', status: 'running', region: 'eu-west-1', updated: '15 min ago' },
  { id: 'dep-3', name: 'analytics-aggregator', version: 'v3.1.0', status: 'pending', region: 'us-west-2', updated: '1 hour ago' },
  { id: 'dep-4', name: 'notification-router', version: 'v1.2.0', status: 'error', region: 'eu-central-1', updated: '3 hours ago' },
];

// SVG Grid Map Component
function GlobalActivityMap() {
  const gridPoints: { x: number; y: number; active: boolean }[] = [];
  for (let x = 0; x < 20; x++) {
    for (let y = 0; y < 10; y++) {
      gridPoints.push({ x: x * 5 + 2.5, y: y * 10 + 5, active: Math.random() > 0.7 });
    }
  }

  return (
    <div className="relative w-full h-64 md:h-80 bg-surface/50 rounded-xl overflow-hidden border border-border">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="5" height="10" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 10" fill="none" stroke="rgba(124, 58, 237, 0.1)" strokeWidth="0.2" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        
        {/* Connection lines */}
        {gridPoints.filter(p => p.active).map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="0.8"
              fill="rgba(124, 58, 237, 0.6)"
              className="animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
            {i > 0 && point.active && gridPoints[i - 1]?.active && (
              <line
                x1={gridPoints[i - 1].x}
                y1={gridPoints[i - 1].y}
                x2={point.x}
                y2={point.y}
                stroke="rgba(124, 58, 237, 0.2)"
                strokeWidth="0.2"
              />
            )}
          </g>
        ))}
        
        {/* Region nodes */}
        <circle cx="20" cy="35" r="2" fill="#10B981" className="animate-pulse" />
        <circle cx="15" cy="40" r="2" fill="#10B981" />
        <circle cx="48" cy="32" r="2" fill="#10B981" />
        <circle cx="51" cy="35" r="2" fill="#F59E0B" />
        <circle cx="75" cy="55" r="2" fill="#10B981" />
        <circle cx="82" cy="38" r="2" fill="#10B981" />
        <circle cx="32" cy="72" r="2" fill="#EF4444" />
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-gray-400">Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-gray-400">Warning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-gray-400">Offline</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  return (
    <div className="section-container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Global Network Dashboard</h1>
        <p className="text-gray-400">Real-time overview of orchestration infrastructure</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Active Nodes</div>
          <div className="text-2xl font-bold text-emerald-400">148/150</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Running Agents</div>
          <div className="text-2xl font-bold">2,847</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Avg Latency</div>
          <div className="text-2xl font-bold">42ms</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Network Load</div>
          <div className="text-2xl font-bold text-accent">67%</div>
        </div>
      </div>

      {/* Global Activity Map */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Global Activity</h2>
        <GlobalActivityMap />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Node Health List */}
        <div>
          <h2 className="text-xl font-bold mb-4">Node Health</h2>
          <div className="space-y-2">
            {mockNodes.map((node) => (
              <div
                key={node.id}
                className={`card py-4 cursor-pointer transition-colors ${
                  selectedRegion === node.id ? 'border-accent' : ''
                }`}
                onClick={() => setSelectedRegion(node.id === selectedRegion ? null : node.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        node.status === 'online'
                          ? 'bg-emerald-500'
                          : node.status === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <div className="font-medium">{node.location}</div>
                      <div className="text-sm text-gray-500">{node.region}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">
                      {node.status === 'offline' ? '--' : `${node.latency}ms`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {node.status === 'offline' ? 'Offline' : `${node.load}% load`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deployment Status */}
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Deployments</h2>
          <div className="space-y-2">
            {mockDeployments.map((dep) => (
              <div key={dep.id} className="card py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {dep.name}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-gray-400">
                        {dep.version}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">{dep.region} • {dep.updated}</div>
                  </div>
                  <span
                    className={`status-pill ${
                      dep.status === 'running'
                        ? 'online'
                        : dep.status === 'pending'
                        ? 'pending'
                        : 'error'
                    }`}
                  >
                    {dep.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}