'use client';

import React, { useState } from 'react';

interface ReasonForChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  actionName: string;
}

export function ReasonForChangeModal({ isOpen, onClose, onConfirm, actionName }: ReasonForChangeModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-[#2e3545] rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-slate-200 dark:border-[#2e3545] flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Audit Gate: Reason for Change</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">security</span>
              Action: <span className="font-bold">{actionName}</span>
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              This action will be recorded in the immutable audit trail.
            </p>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Reason for this change
            </label>
            <textarea
              id="reason"
              rows={4}
              className="w-full bg-slate-50 dark:bg-[#111318] border border-slate-200 dark:border-[#2e3545] rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#135bec] outline-none transition-all"
              placeholder="e.g., Scaling runners for peak demand, updating security policy per PR-421..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-[#111318] border-t border-slate-200 dark:border-[#2e3545] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2e3545] text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1f2e] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-[#135bec] text-white text-sm font-semibold hover:bg-[#135bec]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
}
