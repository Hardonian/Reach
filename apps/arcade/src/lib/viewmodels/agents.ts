import { safeDefault, ViewModelResponse } from "./types";

export interface AgentRun {
  traceId: string;
  agentName: string;
  repo: string;
  runtime: string;
  status: "Running" | "Stalled" | "Error" | "Completed";
}

export interface AgentData {
  activeRuns: AgentRun[];
}

export const getAgentData = async (): Promise<ViewModelResponse<AgentData>> => {
  return safeDefault({
    activeRuns: [
      {
        traceId: "Trace-8f92",
        agentName: "DataScraper-01",
        repo: "repo/settler",
        runtime: "02m 34s",
        status: "Running",
      },
      {
        traceId: "Trace-9a21",
        agentName: "CodeRefactor-X",
        repo: "repo/reach",
        runtime: "05m 12s",
        status: "Stalled",
      },
      {
        traceId: "Trace-7b44",
        agentName: "Indexer-V2",
        repo: "repo/aias",
        runtime: "00m 45s",
        status: "Running",
      },
      {
        traceId: "Trace-3c19",
        agentName: "SecurityScan-09",
        repo: "repo/reach",
        runtime: "01m 15s",
        status: "Running",
      },
      {
        traceId: "Trace-5d88",
        agentName: "QABot-Alpha",
        repo: "repo/zeo",
        runtime: "08m 20s",
        status: "Error",
      },
      {
        traceId: "Trace-2e11",
        agentName: "Deploy-Prod-01",
        repo: "repo/zeo",
        runtime: "12m 05s",
        status: "Running",
      },
    ],
  });
};
