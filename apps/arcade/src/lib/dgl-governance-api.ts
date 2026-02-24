export interface DglFilters {
  provider?: string;
  branch?: string;
  subsystem?: string;
}

export interface DglResponseData {
  report: Record<string, unknown> | null;
  provider_matrix: Array<Record<string, unknown>>;
  violations: Array<Record<string, unknown>>;
  turbulence_hotspots: Array<Record<string, unknown>>;
}

export function buildDglPayload(
  report: Record<string, unknown> | null,
  providerMatrixRaw: Array<Record<string, unknown>>,
  filters: DglFilters,
): DglResponseData {
  const providerFilter = (filters.provider ?? '').toLowerCase();
  const branchFilter = (filters.branch ?? '').toLowerCase();
  const subsystemFilter = (filters.subsystem ?? '').toLowerCase();

  const provider_matrix = providerMatrixRaw.filter((row) => {
    const provider = String(row.provider ?? '').toLowerCase();
    return providerFilter ? provider.includes(providerFilter) : true;
  });

  const branch = String((report as { branch?: string } | null)?.branch ?? 'unknown').toLowerCase();
  if (branchFilter && !branch.includes(branchFilter)) {
    return {
      report: null,
      provider_matrix,
      violations: [],
      turbulence_hotspots: [],
    };
  }

  const violations = ((report as { violations?: Array<Record<string, unknown>> } | null)?.violations ?? []).filter((v) => {
    if (!subsystemFilter) return true;
    return JSON.stringify(v).toLowerCase().includes(subsystemFilter);
  });

  return {
    report,
    provider_matrix,
    violations,
    turbulence_hotspots: ((report as { turbulence_hotspots?: Array<Record<string, unknown>> } | null)?.turbulence_hotspots ?? []),
  };
}

export function authFailurePayload() {
  return {
    ok: false,
    error: {
      code: 'AUTH_REQUIRED',
      message: 'Authentication required to access divergence governance data.',
    },
  };
}
