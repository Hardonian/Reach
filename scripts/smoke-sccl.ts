#!/usr/bin/env npx tsx
import { execSync } from 'child_process';

const output = execSync('npx tsx scripts/sccl-cli.ts smoke', { encoding: 'utf-8' });
console.log(output.trim());
