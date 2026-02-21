export interface ViewModelResponse<T> {
  data: T;
  error?: { message: string };
  degraded: boolean;
  lastUpdated?: string;
}

export const safeDefault = <T>(data: T): ViewModelResponse<T> => ({
  data,
  degraded: true,
  lastUpdated: new Date().toISOString(),
});
