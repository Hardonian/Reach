'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Decision {
  id: string;
  source_type: string;
  source_ref: string;
  status: string;
  outcome_status: string;
  recommended_action_id: string | null;
  created_at: string;
}

interface JunctionsCliArgs {
  command: 'scan' | 'list' | 'show';
  since?: string;
  json?: boolean;
  junctionType?: string;
  minSeverity?: number;
  limit?: number;
  id?: string;
}

// Mock data for demonstration - in production, this would come from API calls
const mockDecisions: Decision[] = [];

export default function DecisionsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [decisions, setDecisions] = useState<Decision[]>(mockDecisions);

  const filteredDecisions = filter === 'all' 
    ? decisions 
    : decisions.filter(d => d.status === filter);

  const getSeverityColor = (sourceType: string) => {
    switch (sourceType) {
      case 'diff': return 'bg-blue-100 text-blue-800';
      case 'drift': return 'bg-yellow-100 text-yellow-800';
      case 'trust': return 'bg-red-100 text-red-800';
      case 'policy': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'reviewed': return 'text-yellow-600';
      case 'evaluated': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Decision Inbox</h1>
              <p className="mt-2 text-gray-600">
                Review and manage automated decisions from critical junctions
              </p>
            </div>
            <Link
              href="/decisions/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              New Decision
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {['all', 'draft', 'evaluated', 'reviewed', 'accepted', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {decisions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No decisions yet</h3>
            <p className="text-gray-500 mb-6">
              Decisions will appear here when junctions trigger evaluations
            </p>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md mx-auto">
              <h4 className="font-medium text-gray-900 mb-2">Getting Started</h4>
              <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                <li>Configure junction triggers in your pipeline</li>
                <li>Run a scan with <code className="bg-gray-100 px-1 rounded">reach junctions scan --since 7d</code></li>
                <li>Evaluate a junction with <code className="bg-gray-100 px-1 rounded">reach decide evaluate --junction &#60;id&#62;</code></li>
              </ol>
            </div>
          </div>
        )}

        {/* Decision List */}
        {decisions.length > 0 && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recommendation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDecisions.map((decision) => (
                  <tr key={decision.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(decision.source_type)}`}>
                        {decision.source_type}
                      </span>
                      <div className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                        {decision.source_ref}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getStatusColor(decision.status)}`}>
                        {decision.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {decision.recommended_action_id || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {decision.outcome_status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(decision.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/decisions/${decision.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
