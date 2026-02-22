/**
 * Parser for 'reach doctor' CLI output.
 *
 * This utility ensures that downstream consumers (VS Code extension, CI gates,
 * drift guards) can reliably parse the human-readable output of the doctor command.
 */

export interface DoctorCheck {
  category: string;
  status: 'OK' | 'FAIL' | 'WARN';
  label: string;
}

export interface DoctorReport {
  brand: string;
  version: string;
  checks: DoctorCheck[];
  raw: string;
}

export const parseDoctorOutput = (stdout: string): DoctorReport => {
  const lines = stdout.split('\n');
  const report: DoctorReport = { brand: 'Reach', version: 'unknown', checks: [], raw: stdout };
  let currentCategory = 'General';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Version & Brand detection (Supports Reach and ReadyLayer)
    const versionMatch = trimmed.match(/^(Reach|ReadyLayer) v(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      report.brand = versionMatch[1];
      report.version = versionMatch[2];
      continue;
    }

    // Category detection (lines ending in :)
    if (trimmed.endsWith(':') && !trimmed.includes('[')) {
      currentCategory = trimmed.replace(':', '');
      continue;
    }

    // Check detection: [OK], [FAIL], [WARN]
    const statusMatch = trimmed.match(/^\[(OK|FAIL|WARN)\]\s+(.+)/);
    if (statusMatch) {
      report.checks.push({
        category: currentCategory,
        status: statusMatch[1] as 'OK' | 'FAIL' | 'WARN',
        label: statusMatch[2]
      });
    }
  }

  return report;
};