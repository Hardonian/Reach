#!/usr/bin/env tsx
/**
 * Report Verifier
 * 
 * Verifies the integrity of a generated demo report.
 */

import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { createHash } from 'crypto'

interface Manifest {
  generatedAt: string
  reachVersion: string
  environment: unknown
  manifest: {
    reportId: string
    schemaVersion: string
    integrityHash: string
  }
}

function computeIntegrityHash(data: unknown): string {
  const str = JSON.stringify(data, Object.keys(data as object).sort())
  return createHash('sha256').update(str).digest('hex').substring(0, 32)
}

function verify(reportDir: string): boolean {
  const resolvedDir = resolve(reportDir)
  
  console.log(`Verifying report: ${resolvedDir}`)
  console.log('')
  
  // Check required files
  const requiredFiles = ['manifest.json', 'timeline.json', 'env.json']
  for (const file of requiredFiles) {
    const path = join(resolvedDir, file)
    if (!existsSync(path)) {
      console.error(`✗ Missing required file: ${file}`)
      return false
    }
    console.log(`✓ Found ${file}`)
  }
  
  // Load manifest
  let manifest: Manifest
  try {
    manifest = JSON.parse(readFileSync(join(resolvedDir, 'manifest.json'), 'utf8'))
  } catch (e) {
    console.error('✗ Failed to parse manifest.json')
    return false
  }
  
  // Load other files for integrity check
  let timeline: unknown
  let env: unknown
  let outputs: Record<string, unknown> = {}
  
  try {
    timeline = JSON.parse(readFileSync(join(resolvedDir, 'timeline.json'), 'utf8'))
    env = JSON.parse(readFileSync(join(resolvedDir, 'env.json'), 'utf8'))
  } catch (e) {
    console.error('✗ Failed to load timeline or env')
    return false
  }
  
  // Load outputs if they exist
  const outputsDir = join(resolvedDir, 'outputs')
  if (existsSync(outputsDir)) {
    const outputFiles = require('fs').readdirSync(outputsDir)
    for (const file of outputFiles) {
      if (file.endsWith('.json')) {
        try {
          outputs[file.replace('.json', '')] = JSON.parse(
            readFileSync(join(outputsDir, file), 'utf8')
          )
        } catch { /* ignore */ }
      }
    }
  }
  
  // Verify integrity hash
  const computedHash = computeIntegrityHash({
    generatedAt: manifest.generatedAt,
    reachVersion: manifest.reachVersion,
    environment: env,
    timeline,
    outputs,
  })
  
  if (computedHash !== manifest.manifest.integrityHash) {
    console.error('✗ Integrity check failed')
    console.error(`  Expected: ${manifest.manifest.integrityHash}`)
    console.error(`  Computed: ${computedHash}`)
    return false
  }
  
  console.log('✓ Integrity hash verified')
  console.log(`  Report ID: ${manifest.manifest.reportId}`)
  console.log(`  Schema: ${manifest.manifest.schemaVersion}`)
  console.log(`  Generated: ${manifest.generatedAt}`)
  console.log(`  Reach Version: ${manifest.reachVersion}`)
  console.log('')
  console.log('✓ Report verification successful')
  
  return true
}

function main(): void {
  const args = process.argv.slice(2)
  const reportDir = args[0]
  
  if (!reportDir) {
    console.error('Usage: verify-report.ts <report-directory>')
    process.exit(2)
  }
  
  const success = verify(reportDir)
  process.exit(success ? 0 : 5)
}

main()
