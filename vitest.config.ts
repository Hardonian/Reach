import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@zeo/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@zeo/contracts': path.resolve(
        __dirname,
        './packages/contracts/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.git', '.github'],
    // sccl.test.ts and gate.test.ts share the on-disk state under
    // dgl/sccl/ (leases.json, run-records). Cross-file parallelism let one
    // file's beforeEach unlink the other's fixture mid-run, so the
    // duplicate-lease assertion flaked red in CI (passed alone, failed in
    // the full suite). Serial file execution makes the suite deterministic.
    fileParallelism: false,
  },
});
