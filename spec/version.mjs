/**
 * Reach Protocol Version Utilities
 *
 * Provides spec version checking and compatibility validation.
 */

/**
 * Current protocol spec version
 */
export const CURRENT_SPEC_VERSION = "1.0.0";

/**
 * Minimum supported spec version (for backward compatibility)
 */
export const MIN_SPEC_VERSION = "1.0.0";

/**
 * Parse a SemVer version string into components
 * @param {string} version - SemVer string (e.g., "1.2.3")
 * @returns {{major: number, minor: number, patch: number}}
 */
export function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected MAJOR.MINOR.PATCH`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two version strings
 * @param {string} a - First version
 * @param {string} b - Second version
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

/**
 * Check if a spec version is supported
 * @param {string} specVersion - The spec version to check
 * @returns {{supported: boolean, error?: string, warning?: string}}
 */
export function checkSpecVersion(specVersion) {
  if (!specVersion) {
    return {
      supported: false,
      error: "MISSING_SPEC_VERSION",
      message: "specVersion is required",
    };
  }

  try {
    parseVersion(specVersion);
  } catch (error) {
    return {
      supported: false,
      error: "INVALID_SPEC_VERSION",
      message: `Invalid specVersion format: ${specVersion}`,
    };
  }

  const current = parseVersion(CURRENT_SPEC_VERSION);
  const target = parseVersion(specVersion);

  // Major version mismatch = breaking change
  if (target.major !== current.major) {
    return {
      supported: false,
      error: "SPEC_VERSION_MISMATCH",
      message: `Spec version ${specVersion} is not compatible with current version ${CURRENT_SPEC_VERSION}. Major version mismatch.`,
      currentVersion: CURRENT_SPEC_VERSION,
      targetVersion: specVersion,
    };
  }

  // Check minimum version
  if (compareVersions(specVersion, MIN_SPEC_VERSION) < 0) {
    return {
      supported: false,
      error: "SPEC_VERSION_TOO_OLD",
      message: `Spec version ${specVersion} is below minimum supported version ${MIN_SPEC_VERSION}`,
      minVersion: MIN_SPEC_VERSION,
    };
  }

  // Future minor version = may have warnings
  if (target.minor > current.minor) {
    return {
      supported: true,
      warning: "NEWER_SPEC_VERSION",
      message: `Spec version ${specVersion} is newer than current ${CURRENT_SPEC_VERSION}. Some features may not be supported.`,
      currentVersion: CURRENT_SPEC_VERSION,
      targetVersion: specVersion,
    };
  }

  return { supported: true };
}

/**
 * Validate a pack's spec version
 * @param {Object} pack - The pack to validate
 * @returns {{valid: boolean, error?: Object}}
 */
export function validatePackSpecVersion(pack) {
  if (!pack.specVersion) {
    return {
      valid: false,
      error: {
        code: "PACK_MISSING_SPEC_VERSION",
        message: "Pack is missing required specVersion field",
        recoverable: false,
      },
    };
  }

  const check = checkSpecVersion(pack.specVersion);

  if (!check.supported) {
    return {
      valid: false,
      error: {
        code: `PACK_${check.error}`,
        message: check.message,
        details: {
          packSpecVersion: pack.specVersion,
          currentSpecVersion: CURRENT_SPEC_VERSION,
        },
        recoverable: false,
      },
    };
  }

  if (check.warning) {
    return {
      valid: true,
      warning: {
        code: check.warning,
        message: check.message,
      },
    };
  }

  return { valid: true };
}

/**
 * Validate a run's spec version
 * @param {Object} run - The run to validate
 * @returns {{valid: boolean, error?: Object}}
 */
export function validateRunSpecVersion(run) {
  if (!run.specVersion) {
    return {
      valid: false,
      error: {
        code: "RUN_MISSING_SPEC_VERSION",
        message: "Run is missing required specVersion field",
        recoverable: false,
      },
    };
  }

  const check = checkSpecVersion(run.specVersion);

  if (!check.supported) {
    return {
      valid: false,
      error: {
        code: `RUN_${check.error}`,
        message: check.message,
        details: {
          runSpecVersion: run.specVersion,
          currentSpecVersion: CURRENT_SPEC_VERSION,
        },
        recoverable: false,
      },
    };
  }

  return { valid: true };
}

/**
 * Get version metadata for runtime
 * @returns {Object}
 */
export function getVersionMetadata() {
  return {
    specVersion: CURRENT_SPEC_VERSION,
    minSpecVersion: MIN_SPEC_VERSION,
    backwardCompatible: true,
    deprecationNotices: [],
  };
}

/**
 * Format version error for CLI output
 * @param {Object} error - Version error object
 * @returns {string}
 */
export function formatVersionError(error) {
  let output = `Error: ${error.code}\n`;
  output += `  ${error.message}\n`;
  if (error.details) {
    for (const [key, value] of Object.entries(error.details)) {
      output += `  ${key}: ${value}\n`;
    }
  }
  return output;
}
