"use client";

import React, { useState, useCallback } from "react";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";
import {
  createDefaultSnapshot,
  validateSnapshot,
  diffSnapshots,
  type ConfigSnapshot,
  type SnapshotDiff,
  SNAPSHOT_VERSION,
} from "@/lib/config-snapshot/schema";

const STORAGE_KEY = "reach:config-snapshot";

function loadStoredSnapshot(): ConfigSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = validateSnapshot(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function DiffViewer({ diffs }: { diffs: SnapshotDiff[] }) {
  if (diffs.length === 0) {
    return <p className="text-sm text-slate-500">No changes detected.</p>;
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800">
            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
              Path
            </th>
            <th className="px-3 py-2 text-left font-semibold text-red-600 dark:text-red-400">
              Current
            </th>
            <th className="px-3 py-2 text-left font-semibold text-emerald-600 dark:text-emerald-400">
              Incoming
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {diffs.map((d) => (
            <tr key={d.path} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">{d.path}</td>
              <td className="px-3 py-2 font-mono text-red-600 dark:text-red-400 break-all">
                {JSON.stringify(d.oldValue)}
              </td>
              <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-400 break-all">
                {JSON.stringify(d.newValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ConfigAsCodePage() {
  const [currentSnapshot] = useState<ConfigSnapshot>(
    () => loadStoredSnapshot() ?? createDefaultSnapshot(),
  );
  const [importDiffs, setImportDiffs] = useState<SnapshotDiff[] | null>(null);
  const [importData, setImportData] = useState<ConfigSnapshot | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(currentSnapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reach-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSnapshot]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportError(null);
      setImportDiffs(null);
      setApplied(false);

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(reader.result as string);
          const result = validateSnapshot(raw);
          if (!result.success) {
            setImportError(result.error);
            return;
          }
          const diffs = diffSnapshots(currentSnapshot, result.data);
          setImportDiffs(diffs);
          setImportData(result.data);
        } catch (err) {
          setImportError(err instanceof Error ? err.message : "Invalid JSON");
        }
      };
      reader.readAsText(file);
    },
    [currentSnapshot],
  );

  const handleApply = useCallback(() => {
    if (!importData) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(importData));
    setApplied(true);
  }, [importData]);

  return (
    <ConsoleLayout>
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Configuration Snapshot
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Export or import system configuration as versioned JSON. Version: {SNAPSHOT_VERSION}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Export */}
          <section className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-white dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
              Export Current Config
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Download the current configuration as a JSON snapshot. No secrets are included.
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white text-sm font-semibold rounded-lg hover:bg-[#135bec]/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export JSON
            </button>
          </section>

          {/* Import */}
          <section className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-white dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
              Import Config
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Upload a JSON snapshot to preview changes before applying.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-700"
            />

            {importError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                <span className="font-semibold">Validation Error:</span> {importError}
              </div>
            )}

            {importDiffs && (
              <div className="mt-4 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Diff Preview ({importDiffs.length} change
                  {importDiffs.length !== 1 ? "s" : ""})
                </h3>
                <DiffViewer diffs={importDiffs} />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={applied}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {applied ? "Applied (local)" : "Apply to Local Storage"}
                  </button>
                  {applied && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      Stored locally. Backend apply is not yet configured.
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </ConsoleLayout>
  );
}
