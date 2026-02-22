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
    
    // Execute the Go module in the current directory
    const stdout = execSync('go run .', { 
      cwd: __dirname, 
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'inherit'] // Capture stdout, let stderr flow
    });

    console.log('📝 Parsing output...');
    const report = parseDoctorOutput(stdout);

    console.log(`✅ Detected Brand: ${report.brand}`);
    console.log(`✅ Detected Version: ${report.version}`);
    console.log(`📊 Checks Found: ${report.checks.length}`);

    const failures = report.checks.filter(c => c.status === 'FAIL');
    if (failures.length > 0) {
      console.error('❌ Doctor checks failed:');
      failures.forEach(f => console.error(`   [${f.category}] ${f.label}`));
      process.exit(1);
    }

    console.log('✨ All checks passed.');
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

main();