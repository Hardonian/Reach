import { describe, it, expect } from 'vitest';
import { parseDoctorOutput } from './parser';

describe('Doctor Output Parser', () => {
  it('parses standard healthy output', () => {
    const output = `
Reach v0.3.1
System:
  [OK] OS: darwin/arm64
  [OK] Shell: /bin/zsh
Dependencies:
  [OK] Go 1.22.7
  [OK] Node 20.5.0
`;
    const report = parseDoctorOutput(output);
    expect(report.brand).toBe('Reach');
    expect(report.version).toBe('0.3.1');
    expect(report.checks).toHaveLength(4);
    expect(report.checks[0]).toEqual({
      category: 'System',
      status: 'OK',
      label: 'OS: darwin/arm64'
    });
  });

  it('handles ReadyLayer brand rebranding', () => {
    const output = `
ReadyLayer v1.0.0
Core:
  [OK] Determinism Engine
`;
    const report = parseDoctorOutput(output);
    expect(report.brand).toBe('ReadyLayer');
    expect(report.version).toBe('1.0.0');
  });

  it('detects failures and warnings', () => {
    const output = `
Reach v0.3.1
Network:
  [FAIL] Registry unreachable (503)
  [WARN] Latency high (150ms)
`;
    const report = parseDoctorOutput(output);
    expect(report.checks[0].status).toBe('FAIL');
    expect(report.checks[0].label).toContain('Registry unreachable');
    expect(report.checks[1].status).toBe('WARN');
  });
});