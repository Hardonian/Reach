'use client';

import React from 'react';

interface GridPoint {
  x: number;
  y: number;
  active: boolean;
}

interface GlobalActivityMapProps {
  className?: string;
}

export function GlobalActivityMap({ className = '' }: GlobalActivityMapProps) {
  // Generate grid points deterministically (same on every render)
  const gridPoints = React.useMemo(() => {
    const points: GridPoint[] = [];
    // Use deterministic pseudo-random based on position for stable SSR/client
    const isActive = (x: number, y: number) => ((x * 7 + y * 13) % 10) > 6;
    
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 10; y++) {
        points.push({
          x: x * 5 + 2.5,
          y: y * 10 + 5,
          active: isActive(x, y),
        });
      }
    }
    return points;
  }, []);

  // Active points for rendering connections
  const activePoints = React.useMemo(() => 
    gridPoints.filter((p) => p.active),
    [gridPoints]
  );

  return (
    <div className={`relative w-full h-64 md:h-80 bg-surface/50 rounded-xl overflow-hidden border border-border ${className}`}>
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="5" height="10" patternUnits="userSpaceOnUse">
            <path
              d="M 5 0 L 0 0 0 10"
              fill="none"
              stroke="rgba(124, 58, 237, 0.1)"
              strokeWidth="0.2"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />

        {/* Connection lines between nearby active points */}
        {activePoints.map((point, i) => {
          // Only connect to next point to avoid excessive lines
          const nextPoint = activePoints[i + 1];
          if (!nextPoint) return null;
          
          return (
            <line
              key={`line-${i}`}
              x1={point.x}
              y1={point.y}
              x2={nextPoint.x}
              y2={nextPoint.y}
              stroke="rgba(124, 58, 237, 0.2)"
              strokeWidth="0.2"
            />
          );
        })}

        {/* Active grid points */}
        {activePoints.map((point, i) => (
          <circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r="0.8"
            fill="rgba(124, 58, 237, 0.6)"
            className="animate-pulse"
            style={{ animationDelay: `${(i % 10) * 0.1}s` }}
          />
        ))}

        {/* Region nodes - static positions for major regions */}
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
