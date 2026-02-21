import React from 'react';

export interface TraceStep {
  id: string;
  time: string;
  elapsedTime?: string;
  duration?: string;
  title: string;
  status: 'Success' | 'Running' | 'Warning' | 'Error';
  description?: string;
  icon: string;
  color?: string;
  tokens?: string;
  cost?: string;
  type?: string;
  score?: number;
  highlighted?: boolean;
  children?: TraceStep[];
}

interface TraceTimelineProps {
  steps: TraceStep[];
  onStepClick?: (step: TraceStep) => void;
}

export function TraceTimeline({ steps, onStepClick }: TraceTimelineProps) {
  return (
    <div className="relative pl-4">
      <div className="absolute left-[27px] top-6 bottom-10 w-0.5 bg-slate-300 dark:bg-slate-700"></div>
      
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className={`relative flex gap-4 pb-8 group ${step.type === 'subtask' ? 'ml-12' : ''}`}>
             {/* Path Connector for Subtasks */}
            {step.type === 'subtask' && (
               <div className="absolute left-[-21px] top-[-30px] w-[24px] h-[75px] border-l-2 border-b-2 border-dashed border-slate-300 dark:border-slate-600 rounded-bl-xl pointer-events-none"></div>
            )}
            {/* Simple Vertical Line Connector */}
            {index > 0 && step.type !== 'subtask' && (
               <div className="absolute left-[28px] top-[-30px] bottom-[calc(100%-20px)] w-0.5 bg-slate-300 dark:bg-slate-700"></div>
            )}

            <div className="hidden sm:block w-24 pt-4 text-right pr-4 shrink-0">
              <span className="block text-xs font-mono text-slate-500 dark:text-slate-400">{step.time}</span>
              {step.elapsedTime && <span className="block text-[10px] text-slate-400 dark:text-slate-500">{step.elapsedTime}</span>}
            </div>

            <div className="relative z-10 flex-none pt-2">
              <div className={`h-10 w-10 rounded-full bg-white dark:bg-background-dark border-2 flex items-center justify-center shadow-sm transition-all ${
                step.status === 'Running' ? 'border-[#135bec] shadow-[0_0_0_4px_rgba(19,91,236,0.15)]' :
                step.status === 'Success' ? 'border-green-500' :
                step.status === 'Warning' ? 'border-orange-500' :
                'border-slate-200 dark:border-slate-700'
              } group-hover:border-[#135bec]`}>
                <span className={`material-symbols-outlined text-[20px] ${
                  step.status === 'Running' ? 'text-[#135bec]' :
                  step.status === 'Success' ? 'text-green-600' :
                  step.status === 'Warning' ? 'text-orange-500' :
                  'text-slate-400'
                }`}>{step.icon}</span>
              </div>
            </div>

            <div 
              onClick={() => onStepClick?.(step)}
              className={`flex-1 bg-white dark:bg-[#181b21] border rounded-xl p-4 shadow-sm transition-all cursor-pointer relative overflow-hidden ${
                step.highlighted ? 'border-[#135bec] ring-1 ring-[#135bec]/20 shadow-lg shadow-blue-900/5' : 'border-slate-200 dark:border-slate-800 hover:border-[#135bec]/50 hover:shadow-md'
              }`}
            >
              {step.highlighted && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#135bec]"></div>}
              
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{step.title}</h3>
                  {step.status === 'Running' && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    step.status === 'Success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                    step.status === 'Running' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                    step.status === 'Warning' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}>
                    {step.status}
                  </span>
                </div>
                {step.duration && <div className="text-xs text-slate-400 font-mono">{step.duration}</div>}
              </div>

              {step.description && <p className="text-sm text-slate-500 dark:text-slate-400">{step.description}</p>}

              {step.score !== undefined && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1 text-xs text-slate-500">
                    <span>Score: <span className="text-orange-500 font-bold">{step.score}</span></span>
                    <span>Threshold: 0.80</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${step.score * 100}%` }}></div>
                  </div>
                </div>
              )}

              {(step.tokens || step.cost) && (
                <div className="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                  {step.tokens && (
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block mb-1">Tokens</span>
                      <div className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">{step.tokens}</div>
                    </div>
                  )}
                  {step.cost && (
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block mb-1">Cost</span>
                      <div className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">{step.cost}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
