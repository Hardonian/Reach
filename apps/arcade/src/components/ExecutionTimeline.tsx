'use client';

import React, { useEffect, useRef } from 'react';

export interface TimelineEvent {
  type: string;
  details?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  timestamp?: number;
}

interface ExecutionTimelineProps {
  events: TimelineEvent[];
  isRunning: boolean;
}

export function ExecutionTimeline({ events, isRunning }: ExecutionTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const getIcon = (type: string, status?: string) => {
    if (status === 'failed') return '❌';
    if (type.includes('start')) return '🚀';
    if (type.includes('policy')) return '🛡️';
    if (type.includes('network')) return '🌐';
    if (type.includes('fs')) return '📂';
    if (type.includes('result')) return '✅';
    return '🔹';
  };

  return (
    <div className="timeline-container">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const icon = getIcon(event.type.toLowerCase(), event.status);
        const isActive = isLast && isRunning;
        const isFailed = event.status === 'failed';

        return (
          <div 
            key={index}
            className={`timeline-event ${isActive ? 'active' : ''} ${!isActive && !isLast ? 'opacity-80' : ''}`}
          >
            {/* Timeline Node */}
            <div className={`timeline-node ${isActive ? 'active' : ''} ${isFailed ? 'failed' : ''}`}>
              {icon}
            </div>

            {/* Content */}
            <div className={`timeline-content ${isFailed ? 'failed' : ''}`}>
              <div className="flex justify-between items-center mb-1">
                  <span className="font-mono font-bold text-sm">
                    {event.type}
                  </span>
                  <span className="text-2xs font-mono text-tertiary">
                    {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                  </span>
              </div>
              
              {event.details && (
                <div className="text-xs font-mono text-secondary line-clamp-2">
                  {event.details}
                </div>
              )}
            </div>
            
            {/* Connector Line Fill for active step */}
            {isActive && <div className="timeline-connector" />}
          </div>
        );
      })}
      
      {/* Loading Indicator */}
      {isRunning && (
        <div className="timeline-event animate-pulse">
           <div className="timeline-node node-transparent">
             {/* Simple loader or just empty space */}
             ⏳
           </div>
           <div className="p-2 text-xs text-tertiary font-mono">
             Processing...
           </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
