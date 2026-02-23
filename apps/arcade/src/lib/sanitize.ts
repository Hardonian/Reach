// Keys that suggest sensitive data
const SENSITIVE_KEYS = [
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /auth/i,
  /cred/i,
  /cookie/i,
  /session/i,
];

// Values that look like secrets (e.g. high entropy, specific formats)
// This is a heuristic and should be used in conjunction with key matching
const SENSITIVE_VALUE_REGEX = [
  /sk-[a-zA-Z0-9]{20,}/, // OpenAI-style keys
  /eyJ[a-zA-Z0-9_-]{10,}/, // JWT-like prefix
];

export function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Check for embedded secrets in strings
    for (const regex of SENSITIVE_VALUE_REGEX) {
      if (regex.test(data)) {
        return "[REDACTED_SECRET]";
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item: unknown) => sanitize(item));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((regex) => regex.test(key))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }

  return data;
}

export function sanitizeEvent(event: unknown): unknown {
  // Specific event type handling can be added here
  // For now, deep sanitize the entire payload
  return sanitize(event);
}
