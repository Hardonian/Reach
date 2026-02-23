"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHECKLIST, type ChecklistItemId } from "@/lib/copy";
import { track } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

const STORAGE_KEY = "rl_onboarding_progress";

function loadProgress(): Set<ChecklistItemId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as ChecklistItemId[]);
  } catch {
    return new Set();
  }
}

function saveProgress(done: Set<ChecklistItemId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch {
    /* ignore */
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [completed, setCompleted] = useState<Set<ChecklistItemId>>(new Set());
  const [activeItem, setActiveItem] = useState<ChecklistItemId | null>(null);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    const saved = loadProgress();
    setCompleted(saved);
    if (saved.size === CHECKLIST.length) setAllDone(true);
  }, []);

  async function markDone(id: ChecklistItemId) {
    const next = new Set(completed);
    next.add(id);
    setCompleted(next);
    saveProgress(next);

    await track("onboarding_step_completed", { step_id: id });

    if (next.size === CHECKLIST.length) {
      setAllDone(true);
      await track("onboarding_checklist_completed", {
        steps_completed: next.size,
      });
    }
  }

  function handleCta(item: (typeof CHECKLIST)[number]) {
    setActiveItem(item.id);
    switch (item.id) {
      case "demo_run":
        router.push(ROUTES.PLAYGROUND);
        break;
      case "connect_repo":
        router.push(ROUTES.DOCS);
        break;
      case "active_gate":
        router.push(ROUTES.SETTINGS.ADVANCED.RELEASE_GATES);
        break;
      case "save_baseline":
        markDone("save_baseline");
        break;
      case "invite":
        markDone("invite");
        break;
    }
  }

  const doneCount = completed.size;
  const totalCount = CHECKLIST.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="section-container py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Get started with ReadyLayer
          </h1>
          <p className="text-gray-400">
            5 steps to your first successful agent check.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">
              {doneCount} of {totalCount} complete
            </span>
            <span className="text-accent font-medium">{pct}%</span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* All done banner */}
        {allDone && (
          <div className="card border-emerald-500/40 bg-emerald-950/20 p-6 mb-6 text-center animate-slide-up">
            <div className="text-3xl mb-2">✅</div>
            <h2 className="text-xl font-bold text-emerald-400 mb-1">
              You&apos;re all set!
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              You&apos;ve completed onboarding. Your agent is ready to be
              shipped with confidence.
            </p>
            <Link href={ROUTES.DOCS} className="btn-primary">
              Explore the docs
            </Link>
          </div>
        )}

        {/* Checklist */}
        <div className="space-y-3">
          {CHECKLIST.map((item, index) => {
            const isDone = completed.has(item.id);
            const isActive = activeItem === item.id;

            return (
              <div
                key={item.id}
                className={`card transition-all ${
                  isDone
                    ? "border-emerald-500/30 bg-emerald-950/10 opacity-80"
                    : isActive
                      ? "border-accent/50 bg-accent/5"
                      : "hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Step indicator */}
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mt-0.5 ${
                      isDone
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-surface border border-border text-gray-500"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3
                          className={`font-semibold ${isDone ? "text-emerald-400" : "text-white"}`}
                        >
                          {isDone ? item.completedLabel : item.title}
                        </h3>
                        {!isDone && (
                          <p className="text-sm text-gray-400 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <span className="text-xs text-emerald-500">Done</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleCta(item)}
                              className="btn-primary text-sm py-1.5 px-4"
                            >
                              {item.cta}
                            </button>
                            <button
                              onClick={() => markDone(item.id)}
                              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                              title="Mark as done"
                            >
                              Skip
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick links */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold mb-4">Jump to</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={ROUTES.PLAYGROUND}
              className="card p-4 hover:border-accent/50 transition-all group"
            >
              <div className="text-xl mb-1">▶</div>
              <div className="font-medium text-sm group-hover:text-accent transition-colors">
                Playground
              </div>
              <div className="text-xs text-gray-500">Run a demo check</div>
            </Link>
            <Link
              href={ROUTES.TEMPLATES}
              className="card p-4 hover:border-accent/50 transition-all group"
            >
              <div className="text-xl mb-1">📋</div>
              <div className="font-medium text-sm group-hover:text-accent transition-colors">
                Templates
              </div>
              <div className="text-xs text-gray-500">Start from a baseline</div>
            </Link>
            <Link
              href={ROUTES.DOCS}
              className="card p-4 hover:border-accent/50 transition-all group"
            >
              <div className="text-xl mb-1">📖</div>
              <div className="font-medium text-sm group-hover:text-accent transition-colors">
                Docs
              </div>
              <div className="text-xs text-gray-500">Quickstart guide</div>
            </Link>
            <Link
              href={ROUTES.PRICING}
              className="card p-4 hover:border-accent/50 transition-all group"
            >
              <div className="text-xl mb-1">💡</div>
              <div className="font-medium text-sm group-hover:text-accent transition-colors">
                Pricing
              </div>
              <div className="text-xs text-gray-500">Free forever plan</div>
            </Link>
            <Link
              href={ROUTES.MONITORING}
              className="card p-4 hover:border-accent/50 transition-all group"
            >
              <div className="text-xl mb-1">📡</div>
              <div className="font-medium text-sm group-hover:text-accent transition-colors">
                Monitoring
              </div>
              <div className="text-xs text-gray-500">Agent health & drift</div>
            </Link>
            <Link
              href={ROUTES.SIMULATE}
              className="card p-4 hover:border-accent/50 transition-all group"
            >
              <div className="text-xl mb-1">🧪</div>
              <div className="font-medium text-sm group-hover:text-accent transition-colors">
                Simulate
              </div>
              <div className="text-xs text-gray-500">What-if experiments</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
