/**
 * Export Postprocessor Plugin
 * 
 * Transforms export bundles with additional processing.
 * Deterministic: same bundle input → same output.
 */

function postprocessBundle(bundle, options = {}) {
  const format = options.format || 'standard'
  
  switch (format) {
    case 'minimal':
      return createMinimalBundle(bundle)
    case 'verbose':
      return createVerboseBundle(bundle)
    case 'hashes-only':
      return createHashesOnlyBundle(bundle)
    default:
      return createStandardBundle(bundle)
  }
}

function createStandardBundle(bundle) {
  return {
    ...bundle,
    metadata: {
      ...(bundle.metadata || {}),
      postprocessed: true,
      processorVersion: '0.1.0',
    }
  }
}

function createMinimalBundle(bundle) {
  // Deterministic: include only essential fields
  return {
    id: bundle.id,
    hash: bundle.hash,
    timestamp: bundle.timestamp,
    metadata: {
      format: 'minimal',
      postprocessed: true,
    }
  }
}

function createVerboseBundle(bundle) {
  // Deterministic: include all fields sorted
  return {
    ...sortKeys(bundle),
    metadata: {
      ...(bundle.metadata || {}),
      format: 'verbose',
      postprocessed: true,
      processorVersion: '0.1.0',
      fieldCount: Object.keys(bundle).length,
    }
  }
}

function createHashesOnlyBundle(bundle) {
  // Deterministic: extract only hash-related fields
  const hashes = {}
  
  for (const [key, value] of Object.entries(bundle)) {
    if (key.toLowerCase().includes('hash') || 
        (typeof value === 'string' && value.length === 64)) {
      hashes[key] = value
    }
  }
  
  // Deterministic: sort keys
  return {
    id: bundle.id,
    hashes: sortKeys(hashes),
    metadata: {
      format: 'hashes-only',
      postprocessed: true,
    }
  }
}

function sortKeys(obj) {
  // Deterministic: recursively sort object keys
  if (Array.isArray(obj)) {
    return obj.map(sortKeys)
  }
  if (obj && typeof obj === 'object') {
    const sorted = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key])
    }
    return sorted
  }
  return obj
}

module.exports = {
  name: 'export-postprocessor',
  version: '0.1.0',
  
  register(hooks) {
    hooks.registerRenderer('export', postprocessBundle)
  }
}
