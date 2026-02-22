import { execSync } from 'node:child_process';
import { parseDoctorOutput } from './parser';
import * as path from 'node:path';

/**
 * Validates the 'reach doctor' CLI output using the TypeScript parser.
 * This ensures that the CLI output remains machine-readable and healthy.
 */
async function main() {
  try {
    console.log('🏥 Running reach doctor (Go)...');
    console.log('🏥 Running reach doctor (Go) with --json...');
    
    // Execute the Go module in the current directory
    const stdout = execSync('go run .', { 
      cwd: __dirname, 
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'inherit'] // Capture stdout, let stderr flow
    });
    let stdout = '';
    try {
      // Execute the Go module in the current directory
      stdout = execSync('go run . --json', { 
        cwd: __dirname, 
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'inherit'] // Capture stdout, let stderr flow
      });
    } catch (e: any) {
      // If exit code is 1 (failures found), stdout is still populated
      if (e.stdout) {
        stdout = e.stdout.toString();
      } else {
        throw e;
      }
    }

    console.log('📝 Parsing output...');
    const report = parseDoctorOutput(stdout);
    console.log('📝 Parsing JSON output...');
    const report = JSON.parse(stdout);

    console.log(`✅ Detected Brand: ${report.brand}`);
    console.log(`✅ Detected Version: ${report.version}`);
    console.log(`📊 Checks Found: ${report.checks.length}`);
    console.log(`✅ Detected Version: ${report.version || 'unknown'}`);
    console.log(`📊 Checks Found: ${report.checks?.length ?? 0}`);

    const failures = report.checks.filter(c => c.status === 'FAIL');
    if (failures.length > 0) {
    // Verify required checks exist
    const requiredChecks = [
      'git installed', 'go installed', 'docker installed', 'node version',
      'npm installed', 'make installed', 'python3 installed', 'cargo (rust) installed',
      'protoc installed', 'jq installed', 'curl installed'
    ];
    const foundCheckNames = report.checks.map((c: any) => c.name.toLowerCase());
    const missingChecks = requiredChecks.filter(req => !foundCheckNames.some((name: string) => name.includes(req)));
    if (missingChecks.length > 0) {
      console.error('❌ Missing expected checks:', missingChecks);
      process.exit(1);
    }

    if (report.failures > 0) {
      console.error('❌ Doctor checks failed:');
      failures.forEach(f => console.error(`   [${f.category}] ${f.label}`));
      const failures = report.checks.filter((c: any) => c.status === 'FAIL');
      failures.forEach((f: any) => console.error(`   [${f.name}] ${f.detail || ''}`));
      process.exit(1);
    }

    console.log('✨ All checks passed.');
    console.log('✨ All checks passed and required probes found.');
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

main();