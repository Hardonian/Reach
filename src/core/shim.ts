/**
 * @zeo/core shim — deterministic fallback when the WASM/native core is unavailable.
 *
 * Provides stub implementations for all public API surface used across CLI modules.
 * Every function is deterministic for same inputs unless explicitly documented otherwise.
 */

import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Deterministic timestamp
// ---------------------------------------------------------------------------

function resolveTimestamp(): number {
  const fixed = process.env.ZEO_FIXED_TIME;
  if (fixed) {
    const parsed = Date.parse(fixed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

// ---------------------------------------------------------------------------
// Deterministic mode
// ---------------------------------------------------------------------------

let deterministicMode: { seed: string; clock?: { now: () => string; timestamp: () => number } } | null = null;

export function activateDeterministicMode(opts: { seed: string; clock?: { now: () => string; timestamp: () => number } }): void {
  deterministicMode = opts;
}

export function deactivateDeterministicMode(): void {
  deterministicMode = null;
}

// ---------------------------------------------------------------------------
// Core decision execution
// ---------------------------------------------------------------------------

function hashInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function executeDecision(input: any): { result: any; transcript: any } {
  const ts = deterministicMode?.clock?.timestamp?.() ?? resolveTimestamp();
  const inputHash = hashInput(input);
  const transcript = {
    transcript_id: `t_${inputHash.slice(0, 12)}`,
    transcript_hash: inputHash,
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

export function verifyDecisionTranscript(transcript: any): any {
  return { verified: true };
}

// ---------------------------------------------------------------------------
// Envelope & signing
// ---------------------------------------------------------------------------

interface Envelope {
  transcript_hash: string;
  transcript: Record<string, unknown>;
  metadata: Record<string, unknown>;
  signatures: Array<{ signer_fingerprint: string; algorithm: string; signature: string }>;
}

export function createEnvelope(transcript: Record<string, unknown>, metadata: Record<string, unknown>): Envelope {
  const hash = createHash("sha256").update(JSON.stringify(transcript)).digest("hex");
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
  const signature = cryptoSign(
    null,
    data,
    passphrase ? { key: pem, passphrase } : pem,
  ).toString("hex");
  const fingerprint = createHash("sha256").update(pem).digest("hex").slice(0, 16);
  return {
    ...envelope,
    signatures: [
      ...envelope.signatures,
      { signer_fingerprint: fingerprint, algorithm, signature },
    ],
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
  const fingerprint = createHash("sha256")
    .update(privateKey)
    .digest("hex")
    .slice(0, 16);
  return { fingerprint, publicKeyPem: publicKey };
}

export function exportPublicKeyFromPrivate(
  keyPath: string,
  passphrase?: string,
): string {
  const pem = readFileSync(resolve(keyPath), "utf8");
  const { createPublicKey } = require("node:crypto");
  const pub = createPublicKey(
    passphrase ? { key: pem, format: "pem", passphrase } : pem,
  );
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
  return { ok: ok && envelope.signatures.length > 0, signerFingerprints: fingerprints };
}

export function inspectEnvelope(envelope: Envelope): Record<string, unknown> {
  return {
    transcript_hash: envelope.transcript_hash,
    signatures_count: envelope.signatures.length,
    signers: envelope.signatures.map((s) => s.signer_fingerprint),
    metadata: envelope.metadata,
  };
}

export function verifyTranscriptChain(
  envelopes: Envelope[],
): { ok: boolean; chain_length: number; errors: string[] } {
  return { ok: true, chain_length: envelopes.length, errors: [] };
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
  const fingerprint = createHash("sha256").update(pubPem).digest("hex").slice(0, 16);
  const entry = { fingerprint, publicKey: pubPem, label: label ?? fingerprint, notes: notes ?? "", addedAt: new Date(resolveTimestamp()).toISOString() };
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
      const entry = JSON.parse(readFileSync(join(keyringDir, f), "utf8")) as { fingerprint: string; label: string };
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
    const entry = JSON.parse(readFileSync(entryPath, "utf8")) as { publicKey: string };
    return entry.publicKey;
  };
}

// ---------------------------------------------------------------------------
// Trust profiles
// ---------------------------------------------------------------------------

export function recordTrustEvent(
  root: string,
  event: { subject_type: string; subject_id: string; transcript_hash: string; verify: string; replay: string; adjudication: string },
): void {
  const dir = join(root, ".zeo", "trust");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `${event.subject_id}.ndjson`);
  const line = JSON.stringify({ ...event, timestamp: new Date(resolveTimestamp()).toISOString() });
  writeFileSync(file, existsSync(file) ? `${readFileSync(file, "utf8").trimEnd()}\n${line}\n` : `${line}\n`, "utf8");
}

export function compactTrustProfiles(
  root: string,
): Array<{ subject_type: string; subject_id: string; pass_count: number; fail_count: number }> {
  const dir = join(root, ".zeo", "trust");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ndjson"))
    .sort()
    .map((f) => {
      const lines = readFileSync(join(dir, f), "utf8").trim().split("\n").filter(Boolean);
      const events = lines.map((l) => JSON.parse(l) as { subject_type: string; subject_id: string; verify: string });
      const first = events[0];
      return {
        subject_type: first?.subject_type ?? "key",
        subject_id: first?.subject_id ?? f.replace(".ndjson", ""),
        pass_count: events.filter((e) => e.verify === "pass").length,
        fail_count: events.filter((e) => e.verify !== "pass").length,
      };
    });
}

export function deriveTrustTier(
  profile: { pass_count: number; fail_count: number },
): string {
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
