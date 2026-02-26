"use client";

import { useCallback, useEffect, useState } from "react";

type OnboardingStatus = "pending" | "in_progress" | "completed" | "skipped";

interface OnboardingStep {
  stepId: string;
  status: OnboardingStatus;
  completedAt?: string;
  data?: Record<string, any>;
}

interface UseOnboardingOptions {
  /** Sync completed steps to server periodically */
  syncInterval?: number;
  /** Persist steps immediately on change */
  immediate?: boolean;
}

export function useOnboarding(options: UseOnboardingOptions = {}) {
  const { syncInterval = 30000, immediate = false } = options;
  
  const [steps, setSteps] = useState<Record<string, OnboardingStep>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pendingSync, setPendingSync] = useState<OnboardingStep[]>([]);

  // Load steps from server on mount
  useEffect(() => {
    loadSteps();
  }, []);

  // Periodic sync for pending changes
  useEffect(() => {
    if (pendingSync.length === 0) return;
    
    const timer = setTimeout(() => {
      syncToServer(pendingSync);
      setPendingSync([]);
    }, syncInterval);

    return () => clearTimeout(timer);
  }, [pendingSync, syncInterval]);

  const loadSteps = async () => {
    try {
      const res = await fetch("/api/v1/onboarding");
      if (res.ok) {
        const data = await res.json();
        const stepMap: Record<string, OnboardingStep> = {};
        for (const step of data.steps || []) {
          stepMap[step.stepId] = step;
        }
        setSteps(stepMap);
      }
    } catch (err) {
      console.error("Failed to load onboarding state:", err);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  const syncToServer = async (stepsToSync: OnboardingStep[]) => {
    try {
      await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: stepsToSync }),
      });
    } catch (err) {
      console.error("Failed to sync onboarding state:", err);
    }
  };

  const updateStep = useCallback(async (
    stepId: string,
    status: OnboardingStatus,
    data?: Record<string, any>
  ) => {
    const step: OnboardingStep = {
      stepId,
      status,
      completedAt: status === "completed" ? new Date().toISOString() : undefined,
      data,
    };

    // Optimistic update
    setSteps(prev => ({ ...prev, [stepId]: step }));

    if (immediate) {
      // Immediate sync for critical steps
      await fetch("/api/v1/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step),
      });
    } else {
      // Queue for batch sync
      setPendingSync(prev => {
        const filtered = prev.filter(s => s.stepId !== stepId);
        return [...filtered, step];
      });
    }
  }, [immediate]);

  const completeStep = useCallback((stepId: string, data?: Record<string, any>) => {
    return updateStep(stepId, "completed", data);
  }, [updateStep]);

  const startStep = useCallback((stepId: string) => {
    return updateStep(stepId, "in_progress");
  }, [updateStep]);

  const skipStep = useCallback((stepId: string, reason?: string) => {
    return updateStep(stepId, "skipped", reason ? { reason } : undefined);
  }, [updateStep]);

  const getStepStatus = useCallback((stepId: string): OnboardingStatus => {
    return steps[stepId]?.status || "pending";
  }, [steps]);

  const isStepComplete = useCallback((stepId: string): boolean => {
    return steps[stepId]?.status === "completed";
  }, [steps]);

  const getCompletionRate = useCallback((): number => {
    const stepList = Object.values(steps);
    if (stepList.length === 0) return 0;
    const completed = stepList.filter(s => s.status === "completed").length;
    return Math.round((completed / stepList.length) * 100);
  }, [steps]);

  const flushPending = useCallback(async () => {
    if (pendingSync.length > 0) {
      await syncToServer(pendingSync);
      setPendingSync([]);
    }
  }, [pendingSync]);

  return {
    steps,
    isLoading,
    hasLoaded,
    pendingCount: pendingSync.length,
    updateStep,
    completeStep,
    startStep,
    skipStep,
    getStepStatus,
    isStepComplete,
    getCompletionRate,
    flushPending,
    reload: loadSteps,
  };
}
