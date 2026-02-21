import { safeDefault, ViewModelResponse } from './types';

export interface HealthData {
  uptime: string;
  uptimeTrend: string;
  queueDepth: number;
  queueTrend: string;
  failureRate: string;
  failureTrend: string;
}

export const getHealthData = async (): Promise<ViewModelResponse<HealthData>> => {
  return safeDefault({
    uptime: '99.98%',
    uptimeTrend: '0.01%',
    queueDepth: 424,
    queueTrend: '12%',
    failureRate: '2.1%',
    failureTrend: '0.5%',
  });
};
