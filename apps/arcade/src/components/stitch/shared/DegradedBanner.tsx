import React from 'react';

interface DegradedBannerProps {
  title: string;
  message: string;
}

export function DegradedBanner({ title, message }: DegradedBannerProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 dark:text-yellow-400 relative overflow-hidden group">
      <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      <div className="flex items-start gap-3 relative z-10">
        <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-500 mt-0.5">warning</span>
        <div>
          <h3 className="text-sm font-bold text-yellow-700 dark:text-yellow-400">{title}</h3>
          <p className="text-sm text-yellow-700/80 dark:text-yellow-400/80 mt-0.5">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 relative z-10">
        <button type="button" className="px-4 py-1.5 rounded-md bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 text-sm font-semibold transition-colors w-full sm:w-auto border border-yellow-500/20">
          Investigate
        </button>
        <button type="button" className="p-1.5 rounded-md hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 transition-colors">
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>
    </div>
  );
}
