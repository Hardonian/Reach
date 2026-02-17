'use client';

import { useState } from 'react';
import { CATALOG, Pack } from '@/lib/packs';

export default function Home() {
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runTimeline, setRunTimeline] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'discover' | 'runs'>('discover');

  async function handleRun() {
    if (!selectedPack) return;
    setIsRunning(true);
    setRunTimeline([]);

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: selectedPack.id,
          inputs: selectedPack.inputs,
        }),
      });
      const data = await res.json();
      if (data.timeline) {
        // Stagger animation
        for (const event of data.timeline) {
          await new Promise((r) => setTimeout(r, 200));
          setRunTimeline((prev) => [...prev, event]);
        }
      } else if (data.error) {
        setRunTimeline([{ type: 'error', details: data.error, status: 'failed' }]);
      }
    } catch (e) {
      setRunTimeline([{ type: 'error', details: 'Network error', status: 'failed' }]);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="min-h-screen pb-24 relative">
      <header className="p-6 sticky top-0 bg-opacity-90 backdrop-blur-md z-10 border-b border-[var(--border)]">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--primary)]">REACH ARCADE</h1>
        <p className="text-sm text-gray-400 mt-1">v1.2.0 • Online</p>
      </header>

      <main className="p-4">
        {activeTab === 'discover' && (
          <div className="grid gap-4">
            {CATALOG.map((pack) => (
              <div
                key={pack.id}
                onClick={() => { setSelectedPack(pack); setRunTimeline([]); }}
                className={`card cursor-pointer hover:border-[var(--secondary)] ${
                  selectedPack?.id === pack.id ? 'border-[var(--secondary)]' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{pack.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                    pack.arcadeSafe ? 'bg-[var(--success)] text-black' : 'bg-[var(--error)] text-white'
                  }`}>
                    {pack.arcadeSafe ? 'SAFE' : 'UNSAFE'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-3">{pack.description}</p>
                <div className="flex gap-2 text-xs text-gray-500 font-mono">
                  <span>{pack.duration}</span>
                  <span>•</span>
                  <span>{pack.difficulty.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedPack && activeTab === 'discover' && (
          <div className="fixed bottom-0 left-0 w-full bg-[var(--surface-highlight)] border-t border-[var(--border)] p-4 pb-8 z-20 rounded-t-2xl shadow-xl transition-transform transform translate-y-0">
            <div className="max-w-xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold">{selectedPack.name}</h2>
                <button
                  onClick={() => setSelectedPack(null)}
                  className="text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              
              {runTimeline.length > 0 ? (
                <div className="bg-black/40 p-4 rounded-lg font-mono text-xs mb-4 max-h-40 overflow-y-auto">
                   {runTimeline.map((ev, i) => (
                      <div key={i} className="mb-1">
                        <span className="text-[var(--secondary)]">[{new Date().toLocaleTimeString()}]</span>{' '}
                        <span className={ev.status === 'failed' ? 'text-[var(--error)]' : 'text-gray-300'}>
                          {ev.type}
                        </span>
                        {ev.details && <div className="pl-4 text-gray-500">{ev.details}</div>}
                      </div>
                   ))}
                </div>
              ) : (
                <div className="mb-4 text-sm text-gray-400">
                  Ready to execute. Estimated duration: {selectedPack.duration}
                </div>
              )}

              <div className="flex gap-4 mt-4">
                <button
                  disabled={!selectedPack.arcadeSafe || isRunning}
                  onClick={handleRun}
                  className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                    !selectedPack.arcadeSafe
                      ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                      : isRunning
                      ? 'bg-[var(--secondary)] text-black animate-pulse'
                      : 'bg-[var(--primary)] text-white hover:opacity-90'
                  }`}
                >
                  {!selectedPack.arcadeSafe ? 'POLICY LOCKED' : isRunning ? 'EXECUTING...' : 'RUN NOW'}
                </button>
                
                {runTimeline.length > 0 && !isRunning && (
                   <button
                     onClick={() => {
                        const payload = {
                          pack: selectedPack,
                          timeline: runTimeline, 
                          timestamp: Date.now()
                        };
                        const token = btoa(JSON.stringify(payload));
                        const url = `${window.location.origin}/share?token=${encodeURIComponent(token)}`;
                        navigator.clipboard.writeText(url);
                        alert('Run Card Link Copied!');
                     }}
                     className="px-4 py-4 rounded-xl font-bold text-lg bg-[var(--surface-highlight)] border border-[var(--border)] text-[var(--secondary)] hover:bg-[var(--border)] transition-all"
                   >
                     SHARE 🔗
                   </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full bg-[var(--surface)] border-t border-[var(--border)] h-16 flex justify-around items-center z-50 pb-2">
        <button
          onClick={() => { setActiveTab('discover'); setSelectedPack(null); }}
          className={`flex flex-col items-center p-2 ${activeTab === 'discover' ? 'text-[var(--secondary)]' : 'text-gray-500'}`}
        >
          <span className="text-xl">🎮</span>
          <span className="text-xs mt-1">Arcade</span>
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`flex flex-col items-center p-2 ${activeTab === 'runs' ? 'text-[var(--secondary)]' : 'text-gray-500'}`}
        >
          <span className="text-xl">📜</span>
          <span className="text-xs mt-1">History</span>
        </button>
      </nav>
    </div>
  );
}
