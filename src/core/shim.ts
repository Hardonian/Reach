import { loadConfig } from "../core/env.js";
import { hashString } from "../determinism/index.js";
/**
 * @zeo/core shim — deterministic fallback when the WASM/native core is unavailable.
 *
 * Provides stub implementations for all public API surface used across CLI modules.
 * Every function is deterministic for same inputs unless explicitly documented otherwise.
 */

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../determinism/canonicalJson.js";

// ---------------------------------------------------------------------------
// Hash version constant
// ---------------------------------------------------------------------------

/**
 * Canonical hash version identifier.
 * Encodes: algorithm (sha256), serialization (cjson = canonical JSON with sorted keys), schema version.
 * This MUST be bumped whenever the hash input set, algorithm, or serialization format changes.
 */
export const HASH_VERSION = "sha256-cjson-v1" as const;

// ---------------------------------------------------------------------------
// Deterministic timestamp
// ---------------------------------------------------------------------------

function resolveTimestamp(): number {
  const fixed = loadConfig().ZEO_FIXED_TIME;
  if (fixed) {
    const parsed = Date.parse(fixed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

// ---------------------------------------------------------------------------
// Deterministic mode
// ---------------------------------------------------------------------------

let deterministicMode: {
  seed: string;
  clock?: { now: () => string; timestamp: () => number };
} | null = null;

export function activateDeterministicMode(opts: {
  seed: string;
  clock?: { now: () => string; timestamp: () => number };
}): void {
  deterministicMode = opts;
}

export function deactivateDeterministicMode(): void {
  deterministicMode = null;
}

// ---------------------------------------------------------------------------
// Core decision execution
// ---------------------------------------------------------------------------

function hashInput(input: any): string {
  // Hash only decision-stable fields; exclude logicalTimestamp and opts
  // which change between runs but don't alter the decision outcome.
  const stablePayload = {
    spec: input?.spec,
    evidence: input?.evidence,
    dependsOn: input?.dependsOn,
    informs: input?.informs,
  };
  // Use canonicalJson for deterministic key ordering at all nesting levels.
  // Raw JSON.stringify relies on insertion order which is implementation-defined.
  return hashString(canonicalJson(stablePayload));
}

export function executeDecision(input: any): { result: any; transcript: any } {
  const ts = deterministicMode?.clock?.timestamp?.() ?? resolveTimestamp();
  const inputHash = hashInput(input);
  const transcript = {
    transcript_id: `t_${inputHash.slice(0, 12)}`,
    transcript_hash: inputHash,
    hashVersion: HASH_VERSION,
    inputs: input,
    timestamp: ts,
    depends_on: input?.dependsOn ?? [],
    informs: input?.informs ?? [],
    analysis: {
      flip_distances: [] as Array<{ action: string; distance: string }>,
    },
    plan: {
      stop_conditions: ["All high-severity findings resolved", "Evidence completeness >= 90%"],
    },
  };
  const result = {
    evaluations: [] as Array<{ lens: string; robustActions: string[] }>,
    nextBestEvidence: [] as Array<{ prompt: string }>,
  };
  return { result, transcript };
}

export function verifyDecisionTranscript(_transcript: any): any {
  return { verified: true };
}

// ---------------------------------------------------------------------------
// Envelope & signing
// ---------------------------------------------------------------------------

interface Envelope {
  transcript_hash: string;
  transcript: Record<string, unknown>;
  metadata: Record<string, unknown>;
  signatures: Array<{
    signer_fingerprint: string;
    algorithm: string;
    signature: string;
  }>;
}

export function createEnvelope(
  transcript: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Envelope {
  const hash = hashString(canonicalJson(transcript));
  return {
    transcript_hash: hash,
    transcript,
    metadata,
    signatures: [],
  };
}

export function signEnvelopeWithEd25519(
  envelope: Envelope,
  keyPath: string,
  algorithm: string,
  passphrase?: string,
): Envelope {
  const pem = readFileSync(resolve(keyPath), "utf8");
  const data = Buffer.from(envelope.transcript_hash, "utf8");
  const { sign: cryptoSign } = require("node:crypto");
  const signature = cryptoSign(null, data, passphrase ? { key: pem, passphrase } : pem).toString(
    "hex",
  );
  const fingerprint = hashString(pem).slice(0, 16);
  return {
    ...envelope,
    signatures: [...envelope.signatures, { signer_fingerprint: fingerprint, algorithm, signature }],
  };
}

// ---------------------------------------------------------------------------
// Ed25519 key management
// ---------------------------------------------------------------------------

export function generateEd25519Keypair(
  keyPath: string,
  passphrase?: string,
): { fingerprint: string; publicKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: passphrase
      ? { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase }
      : { type: "pkcs8", format: "pem" },
  });
  writeFileSync(resolve(keyPath), privateKey, "utf8");
  const fingerprint = hashString(privateKey).slice(0, 16);
  return { fingerprint, publicKeyPem: publicKey };
}

export function exportPublicKeyFromPrivate(keyPath: string, passphrase?: string): string {
  const pem = readFileSync(resolve(keyPath), "utf8");
  const { createPublicKey } = require("node:crypto");
  const pub = createPublicKey(passphrase ? { key: pem, format: "pem", passphrase } : pem);
  return pub.export({ type: "spki", format: "pem" }) as string;
}

// ---------------------------------------------------------------------------
// Envelope file I/O
// ---------------------------------------------------------------------------

export function loadEnvelopeFromFile(filePath: string): Envelope {
  return JSON.parse(readFileSync(resolve(filePath), "utf8")) as Envelope;
}

export function envelopeFilesInDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".envelope.json"))
    .sort()
    .map((f) => join(dir, f));
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export function verifyEnvelope(
  envelope: Envelope,
  pubKeyResolver: (() => string) | string,
): { ok: boolean; signerFingerprints: string[] } {
  const pubPem = typeof pubKeyResolver === "function" ? pubKeyResolver() : pubKeyResolver;
  const fingerprints = envelope.signatures.map((s) => s.signer_fingerprint);
  const ok = envelope.signatures.every((sig) => {
    try {
      const { verify: cryptoVerify } = require("node:crypto");
      const data = Buffer.from(envelope.transcript_hash, "utf8");
      return cryptoVerify(null, data, pubPem, Buffer.from(sig.signature, "hex"));
    } catch {
      return false;
    }
  });
  return {
    ok: ok && envelope.signatures.length > 0,
    signerFingerprints: fingerprints,
  };
}

export function inspectEnvelope(envelope: Envelope): Record<string, unknown> {
  return {
    transcript_hash: envelope.transcript_hash,
    signatures_count: envelope.signatures.length,
    signers: envelope.signatures.map((s) => s.signer_fingerprint),
    metadata: envelope.metadata,
  };
}

export function verifyTranscriptChain(envelopes: Envelope[]): {
  ok: boolean;
  chain_length: number;
  errors: string[];
} {
  if (envelopes.length === 0) {
    return { ok: true, chain_length: 0, errors: [] };
  }

  const errors: string[] = [];
  const knownHashes = new Set<string>();

  for (let i = 0; i < envelopes.length; i++) {
    const env = envelopes[i];

    // Verify the transcript_hash matches the actual transcript content
    const computedHash = hashString(canonicalJson(env.transcript));
    if (computedHash !== env.transcript_hash) {
      errors.push(
        `Envelope ${i}: transcript_hash mismatch (expected ${computedHash}, got ${env.transcript_hash})`,
      );
    }

    // Verify depends_on references exist in prior envelopes
    const dependsOn = (env.transcript as Record<string, unknown>)?.depends_on;
    if (Array.isArray(dependsOn)) {
      for (const dep of dependsOn) {
        if (typeof dep === "string" && dep.length > 0 && !knownHashes.has(dep)) {
          errors.push(
            `Envelope ${i}: depends_on hash "${dep.slice(0, 12)}..." not found in prior chain`,
          );
        }
      }
    }

    knownHashes.add(env.transcript_hash);
  }

  return {
    ok: errors.length === 0,
    chain_length: envelopes.length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Keyring
// ---------------------------------------------------------------------------

export function addPublicKeyToKeyring(
  keyringDir: string,
  pubPem: string,
  label?: string,
  notes?: string,
): { fingerprint: string; label: string } {
  if (!existsSync(keyringDir)) mkdirSync(keyringDir, { recursive: true });
  const fingerprint = hashString(pubPem).slice(0, 16);
  const entry = {
    fingerprint,
    publicKey: pubPem,
    label: label ?? fingerprint,
    notes: notes ?? "",
    addedAt: new Date(resolveTimestamp()).toISOString(),
  };
  writeFileSync(join(keyringDir, `${fingerprint}.json`), JSON.stringify(entry, null, 2), "utf8");
  return { fingerprint, label: entry.label };
}

export function listKeyringEntries(
  keyringDir: string,
): Array<{ fingerprint: string; label: string }> {
  if (!existsSync(keyringDir)) return [];
  return readdirSync(keyringDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const entry = JSON.parse(readFileSync(join(keyringDir, f), "utf8")) as {
        fingerprint: string;
        label: string;
      };
      return { fingerprint: entry.fingerprint, label: entry.label };
    });
}

export function revokeKeyringEntry(
  keyringDir: string,
  fingerprint: string,
): { revoked: boolean; fingerprint: string } {
  const entryPath = join(keyringDir, `${fingerprint}.json`);
  if (!existsSync(entryPath)) return { revoked: false, fingerprint };
  const entry = JSON.parse(readFileSync(entryPath, "utf8")) as Record<string, unknown>;
  entry.revoked = true;
  writeFileSync(entryPath, JSON.stringify(entry, null, 2), "utf8");
  return { revoked: true, fingerprint };
}

export function keyringResolver(keyringDir: string): () => string {
  return () => {
    const entries = listKeyringEntries(keyringDir);
    if (entries.length === 0) throw new Error("No keys in keyring");
    const first = entries[0];
    const entryPath = join(keyringDir, `${first.fingerprint}.json`);
    const entry = JSON.parse(readFileSync(entryPath, "utf8")) as {
      publicKey: string;
    };
    return entry.publicKey;
  };
}

// ---------------------------------------------------------------------------
// Trust profiles
// ---------------------------------------------------------------------------

export function recordTrustEvent(
  root: string,
  event: {
    subject_type: string;
    subject_id: string;
    transcript_hash: string;
    verify: string;
    replay: string;
    adjudication: string;
  },
): void {
  const dir = join(root, ".zeo", "trust");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `${event.subject_id}.ndjson`);
  const line = JSON.stringify({
    ...event,
    timestamp: new Date(resolveTimestamp()).toISOString(),
  });
  writeFileSync(
    file,
    existsSync(file) ? `${readFileSync(file, "utf8").trimEnd()}\n${line}\n` : `${line}\n`,
    "utf8",
  );
}

export function compactTrustProfiles(root: string): Array<{
  subject_type: string;
  subject_id: string;
  pass_count: number;
  fail_count: number;
}> {
  const dir = join(root, ".zeo", "trust");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ndjson"))
    .sort()
    .map((f) => {
      const lines = readFileSync(join(dir, f), "utf8").trim().split("\n").filter(Boolean);
      const events = lines.map(
        (l) =>
          JSON.parse(l) as {
            subject_type: string;
            subject_id: string;
            verify: string;
          },
      );
      const first = events[0];
      return {
        subject_type: first?.subject_type ?? "key",
        subject_id: first?.subject_id ?? f.replace(".ndjson", ""),
        pass_count: events.filter((e) => e.verify === "pass").length,
        fail_count: events.filter((e) => e.verify !== "pass").length,
      };
    });
}

export function deriveTrustTier(profile: { pass_count: number; fail_count: number }): string {
  if (profile.fail_count > 0) return "untrusted";
  if (profile.pass_count >= 10) return "established";
  if (profile.pass_count >= 3) return "provisional";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Migration stubs
// ---------------------------------------------------------------------------

export function migrateTranscript(content: unknown, _version: string): unknown {
  return content;
}

export function migrateEnvelope(content: unknown, _version: string): unknown {
  return content;
}
