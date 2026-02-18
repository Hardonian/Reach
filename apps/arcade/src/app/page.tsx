'use client';

import { useState } from 'react';
import { Pack } from '@/lib/packs';
import { PackDiscovery } from '@/components/PackDiscovery';
import { ExecutionTimeline, TimelineEvent } from '@/components/ExecutionTimeline';

export default function Home() {
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runTimeline, setRunTimeline] = useState<TimelineEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'discover' | 'runs'>('discover');

  async function handleRun() {
    if (!selectedPack) return;
    setIsRunning(true);
    setRunTimeline([{ type: 'Initializing', status: 'pending', timestamp: Date.now() }]);

    try {
      // Simulate network delay for "feel"
      await new Promise(r => setTimeout(r, 600));

      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: selectedPack.id,
          inputs: selectedPack.inputs,
        }),
      });
      
      const data = await res.json();
      
      // Clear initial pending state
      setRunTimeline([]);

      if (data.timeline) {
        // Stagger animation for dramatic effect
        for (const event of data.timeline) {
          // Add random jitter to timing for realism
          await new Promise((r) => setTimeout(r, Math.random() * 150 + 100));
          setRunTimeline((prev) => [...prev, {
            type: event.type || 'Event',
            details: event.details,
            status: event.status || 'completed',
            timestamp: Date.now(),
          }]);
        }
        
        // Final success state
        setRunTimeline((prev) => [...prev, {
             type: 'Execution Complete', 
             status: 'completed', 
             timestamp: Date.now() 
        }]);

      } else if (data.error) {
        setRunTimeline(prev => [...prev, { type: 'Execution Failed', details: data.error, status: 'failed', timestamp: Date.now() }]);
      }
    } catch (e) {
      setRunTimeline(prev => [...prev, { type: 'Network Error', details: 'Failed to reach execution node', status: 'failed', timestamp: Date.now() }]);
    } finally {
      setIsRunning(false);
    }
  }

  const handleCopyLink = () => {
    if (!selectedPack) return;
    const payload = {
      pack: selectedPack,
      timeline: runTimeline, 
      timestamp: Date.now()
    };
    const token = btoa(JSON.stringify(payload));
    const url = `${window.location.origin}/share?token=${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url);
    alert('Run Card Link Copied! 🔗');
  };

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="app-header">
        <div className="container p-0 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gradient">
              REACH ARCADE
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="status-dot animate-pulse" />
              <p className="text-2xs font-mono text-tertiary tracking-widest uppercase">
                System Online • v1.2.0
              </p>
            </div>
          </div>
          <a href="/studio" className="user-avatar" aria-label="Open Reach Studio" title="Open Reach Studio">
            🧭
          </a>
        </div>
      </header>

      <main className="container app-content">
        {activeTab === 'discover' && (
          <PackDiscovery 
            onSelect={(pack) => {
              setSelectedPack(pack);
              setRunTimeline([]);
            }} 
            selectedId={selectedPack?.id}
          />
        )}

        {/* History Tab placeholder */}
        {activeTab === 'runs' && (
          <div className="placeholder-screen">
             <div className="text-3xl mb-4 opacity-50">📜</div>
             <p>Local history coming in Phase 2.</p>
          </div>
        )}
      </main>

      {/* Execution Drawer / Modal */}
      {selectedPack && activeTab === 'discover' && (
        <>
          {/* Backdrop */}
          <div 
             className="modal-backdrop"
             onClick={() => !isRunning && setSelectedPack(null)}
             aria-hidden="true"
          />
          
          {/* Bottom Sheet */}
          <div 
             className="bottom-sheet"
             role="dialog"
             aria-modal="true"
             aria-labelledby="sheet-title"
          >
            
            {/* Handle bar for visual affordance */}
            <div className="sheet-handle" onClick={() => !isRunning && setSelectedPack(null)} aria-hidden="true">
              <div className="sheet-handle-bar" />
            </div>

            {/* Content */}
            <div className="sheet-content">
              <div className="sheet-header">
                <div>
                  <h2 id="sheet-title" className="text-2xl font-bold mb-1 leading-tight">{selectedPack.name}</h2>
                  <p className="text-secondary text-sm">{selectedPack.description}</p>
                </div>
                <button
                  onClick={() => setSelectedPack(null)}
                  disabled={isRunning}
                  className="close-btn"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Timeline Area */}
              <div className="mb-6 min-h-timeline">
                 {runTimeline.length > 0 ? (
                    <ExecutionTimeline events={runTimeline} isRunning={isRunning} />
                 ) : (
                    <div className="timeline-placeholder">
                      <div className="text-3xl mb-3 opacity-50" aria-hidden="true">⚡</div>
                      <p className="text-secondary text-sm mb-1">Ready to Execute</p>
                      <p className="text-tertiary text-2xs font-mono">
                        Est. Duration: {selectedPack.duration}
                      </p>
                    </div>
                 )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="sheet-footer">
               <div className="action-bar">
                  <button
                    disabled={!selectedPack.arcadeSafe || isRunning}
                    onClick={handleRun}
                    className="btn-primary flex-1"
                  >
                    {!selectedPack.arcadeSafe 
                      ? '🔒 POLICY LOCKED' 
                      : isRunning 
                      ? 'EXECUTING...' 
                      : 'RUN NOW'
                    }
                  </button>

                  {runTimeline.length > 0 && !isRunning && (
                     <button
                       onClick={handleCopyLink}
                       className="btn-icon"
                       aria-label="Share Run"
                       title="Share Run Results"
                     >
                       🔗
                     </button>
                  )}
               </div>
            </div>

          </div>
        </>
      )}

      {/* Bottom Nav */}
      <nav className="bottom-nav" aria-label="Main Navigation">
        <button
          onClick={() => { setActiveTab('discover'); setSelectedPack(null); }}
          className={`nav-item ${activeTab === 'discover' ? 'active' : ''}`}
          aria-current={activeTab === 'discover' ? 'page' : undefined}
        >
          <span className="text-xl mb-1" aria-hidden="true">🎮</span>
          <span className="text-2xs font-bold tracking-wider">ARCADE</span>
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`nav-item ${activeTab === 'runs' ? 'active' : ''}`}
          aria-current={activeTab === 'runs' ? 'page' : undefined}
        >
          <span className="text-xl mb-1" aria-hidden="true">📜</span>
          <span className="text-2xs font-bold tracking-wider">HISTORY</span>
        </button>
      </nav>
    </div>
  );
}
