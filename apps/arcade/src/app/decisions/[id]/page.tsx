'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Decision {
  id: string;
  source_type: string;
  source_ref: string;
  status: string;
  outcome_status: string;
  outcome_notes: string | null;
  recommended_action_id: string | null;
  input_fingerprint: string;
  decision_input: string;
  decision_output: string | null;
  decision_trace: string | null;
  calibration_delta: number | null;
  created_at: string;
  updated_at: string;
}

export default function DecisionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const decisionId = params.id as string;
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');

  useEffect(() => {
    // In production, fetch from API
    // For now, show empty state
    setLoading(false);
  }, [decisionId]);

  const handleAccept = () => {
    setSelectedAction('accept');
  };

  const handleReject = () => {
    setSelectedAction('reject');
  };

  const handleRecordOutcome = (status: string) => {
    // In production, call API to record outcome
    console.log('Recording outcome:', { decisionId, status, notes: outcomeNotes });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Decision not found</h3>
            <p className="text-gray-500 mb-6">
              The decision with ID {decisionId} could not be found.
            </p>
            <Link
              href="/decisions"
              className="text-blue-600 hover:text-blue-900"
            >
              ← Back to Decisions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const parsedInput = decision.decision_input ? JSON.parse(decision.decision_input) : null;
  const parsedOutput = decision.decision_output ? JSON.parse(decision.decision_output) : null;
  const parsedTrace = decision.decision_trace ? JSON.parse(decision.decision_trace) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link href="/decisions" className="text-blue-600 hover:text-blue-900">
            ← Back to Decisions
          </Link>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Decision Details</h1>
              <p className="mt-2 text-gray-600">ID: {decision.id}</p>
              <p className="text-sm text-gray-500">
                Fingerprint: <code className="bg-gray-100 px-1 rounded">{decision.input_fingerprint}</code>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowJson(!showJson)}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {showJson ? 'Hide JSON' : 'Show JSON'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Evidence Context Panel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Evidence Context</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Source Type</span>
                  <p className="font-medium">{decision.source_type}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Source Reference</span>
                  <p className="font-medium">{decision.source_ref}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Created</span>
                  <p className="font-medium">{new Date(decision.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Updated</span>
                  <p className="font-medium">{new Date(decision.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Recommendation Panel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendation</h2>
              {parsedOutput ? (
                <div>
                  <div className="text-3xl font-bold text-blue-600 mb-4">
                    {parsedOutput.recommended_action}
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Ranking:</span>
                    <ul className="mt-2 space-y-1">
                      {parsedOutput.ranking?.map((action: string, idx: number) => (
                        <li key={action} className="flex items-center gap-2">
                          <span className="text-gray-400">{idx + 1}.</span>
                          <span>{action}</span>
                          {action === parsedOutput.recommended_action && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No recommendation available</p>
              )}
            </div>

            {/* Trace Panel */}
            {parsedTrace && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Trace</h2>
                <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">
                  {JSON.stringify(parsedTrace, null, 2)}
                </pre>
              </div>
            )}

            {/* JSON Panel */}
            {showJson && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Raw JSON</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Decision Input</h3>
                    <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                      {JSON.stringify(parsedInput, null, 2)}
                    </pre>
                  </div>
                  {parsedOutput && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Decision Output</h3>
                      <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                        {JSON.stringify(parsedOutput, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Panel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Decision Status</span>
                  <span className="font-medium capitalize">{decision.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Outcome</span>
                  <span className="font-medium capitalize">{decision.outcome_status}</span>
                </div>
                {decision.calibration_delta !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Calibration Delta</span>
                    <span className={`font-medium ${decision.calibration_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {decision.calibration_delta.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Lifecycle Panel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Lifecycle</h2>
              <div className="space-y-3">
                <button
                  onClick={handleAccept}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Accept Decision
                </button>
                <button
                  onClick={handleReject}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Reject Decision
                </button>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add notes about this decision..."
                />
              </div>
            </div>

            {/* Outcome Tracking Panel */}
            {decision.status === 'accepted' || decision.status === 'rejected' ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Track Outcome</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => handleRecordOutcome('success')}
                    className="w-full px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                  >
                    Mark as Success
                  </button>
                  <button
                    onClick={() => handleRecordOutcome('failure')}
                    className="w-full px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
                  >
                    Mark as Failure
                  </button>
                  <button
                    onClick={() => handleRecordOutcome('mixed')}
                    className="w-full px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
                  >
                    Mark as Mixed
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
