import { safeDefault, ViewModelResponse } from "./types";

export type SystemMode = "normal" | "degraded" | "maintenance";

export interface SystemStatus {
  mode: SystemMode;
  queuePaused: boolean;
  circuitBreakerOpen: boolean;
  rateLimitActive: boolean;
  concurrencyCap: number;
  lastHealthCheck: string;
  message?: string;
}

/**
 * Returns the current system status.
 * In the absence of a backend, returns safe defaults (normal mode).
 */
export const getSystemStatus = async (): Promise<
  ViewModelResponse<SystemStatus>
> => {
  return safeDefault({
    mode: "normal",
    queuePaused: false,
    circuitBreakerOpen: false,
    rateLimitActive: false,
    concurrencyCap: 50,
    lastHealthCheck: new Date().toISOString(),
  });
};
