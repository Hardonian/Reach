'use client';

import { useState, Suspense, lazy } from 'react';
import { StatusIndicator } from '@/components/StatusIndicator';

// Lazy load the heavy visualization component
const GlobalActivityMap = lazy(() => 
  import('@/components/GlobalActivityMap').then(mod => ({ default: mod.GlobalActivityMap }))
);

// Loading fallback for the map
function MapLoadingFallback() {
  return (
    <div className="w-full h-64 md:h-80 bg-surface/50 rounded-xl border border-border flex items-center justify-center">
      <div className="text-gray-500">Loading visualization...</div>
    </div>
  );
}

// Mock data for the dashboard
const mockNodes = [
  { id: 'us-east-1', region: 'US East', location: 'N. Virginia', status: 'online' as const, latency: 12, load: 45 },
  { id: 'us-west-2', region: 'US West', location: 'Oregon', status: 'online' as const, latency: 28, load: 62 },
  { id: 'eu-west-1', region: 'Europe', location: 'Ireland', status: 'online' as const, latency: 45, load: 38 },
  { id: 'eu-central-1', region: 'Europe', location: 'Frankfurt', status: 'warning' as const, latency: 52, load: 78 },
  { id: 'ap-southeast-1', region: 'Asia Pacific', location: 'Singapore', status: 'online' as const, latency: 89, load: 55 },
  { id: 'ap-northeast-1', region: 'Asia Pacific', location: 'Tokyo', status: 'online' as const, latency: 95, load: 41 },
  { id: 'sa-east-1', region: 'South America', location: 'São Paulo', status: 'offline' as const, latency: 0, load: 0 },
];

const mockDeployments = [
  { id: 'dep-1', name: 'customer-support-bot', version: 'v2.3.1', status: 'running' as const, region: 'us-east-1', updated: '2 min ago' },
  { id: 'dep-2', name: 'data-pipeline-agent', version: 'v1.0.4', status: 'running' as const, region: 'eu-west-1', updated: '15 min ago' },
  { id: 'dep-3', name: 'analytics-aggregator', version: 'v3.1.0', status: 'pending' as const, region: 'us-west-2', updated: '1 hour ago' },
  { id: 'dep-4', name: 'notification-router', version: 'v1.2.0', status: 'error' as const, region: 'eu-central-1', updated: '3 hours ago' },
];

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

      {/* Global Activity Map - Lazy Loaded */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Global Activity</h2>
        <Suspense fallback={<MapLoadingFallback />}>
          <GlobalActivityMap />
        </Suspense>
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
                    <StatusIndicator 
                      status={node.status} 
                      pulse={node.status === 'online'}
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
                  <StatusIndicator 
                    status={dep.status} 
                    showLabel 
                    size="sm"
                    pulse={dep.status === 'running'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
