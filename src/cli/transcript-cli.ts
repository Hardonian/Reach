// @ts-nocheck
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { codePointCompare } from "../determinism/deterministicCompare.js";

interface TranscriptSecurityModule {
  addPublicKeyToKeyring: typeof import("@zeo/core").addPublicKeyToKeyring;
  compactTrustProfiles: typeof import("@zeo/core").compactTrustProfiles;
  createEnvelope: typeof import("@zeo/core").createEnvelope;
  deriveTrustTier: typeof import("@zeo/core").deriveTrustTier;
  envelopeFilesInDir: typeof import("@zeo/core").envelopeFilesInDir;
  exportPublicKeyFromPrivate: typeof import("@zeo/core").exportPublicKeyFromPrivate;
  generateEd25519Keypair: typeof import("@zeo/core").generateEd25519Keypair;
  inspectEnvelope: typeof import("@zeo/core").inspectEnvelope;
  keyringResolver: typeof import("@zeo/core").keyringResolver;
  listKeyringEntries: typeof import("@zeo/core").listKeyringEntries;
  loadEnvelopeFromFile: typeof import("@zeo/core").loadEnvelopeFromFile;
  recordTrustEvent: typeof import("@zeo/core").recordTrustEvent;
  revokeKeyringEntry: typeof import("@zeo/core").revokeKeyringEntry;
  signEnvelopeWithEd25519: typeof import("@zeo/core").signEnvelopeWithEd25519;
  verifyEnvelope: typeof import("@zeo/core").verifyEnvelope;
  verifyTranscriptChain: typeof import("@zeo/core").verifyTranscriptChain;
  migrateTranscript: typeof import("@zeo/core").migrateTranscript;
  migrateEnvelope: typeof import("@zeo/core").migrateEnvelope;
}

type ConditionalObjection = {
  signer: string;
  condition: string;
  statement: string;
};

async function loadTranscriptSecurity(): Promise<TranscriptSecurityModule> {
  const fallback = new URL("../../../packages/core/src/transcript-security.js", import.meta.url)
    .href;
  try {
    return (await import(fallback)) as TranscriptSecurityModule;
  } catch {
    return (await import("@zeo/core")) as TranscriptSecurityModule;
  }
}

function value(argv: string[], flag: string): string | null {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? (argv[idx + 1] ?? null) : null;
}

function qrAscii(payload: string): string {
  const chars = [...payload];
  const size = 21;
  const bits = chars.map((c, i) => (c.charCodeAt(0) + i) % 2);
  const rows: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let row = "";
    for (let x = 0; x < size; x += 1) {
      const bit = bits[(x + y * size) % bits.length] ?? 0;
      row += bit ? "██" : "  ";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

function readObjections(envelope: Record<string, unknown>): ConditionalObjection[] {
  const metadata = envelope.metadata as Record<string, unknown>;
  const value = metadata?.conditional_objections;
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    signer: String((entry as Record<string, unknown>).signer ?? "unknown"),
    condition: String((entry as Record<string, unknown>).condition ?? ""),
    statement: String((entry as Record<string, unknown>).statement ?? ""),
  }));
}

export function parseTranscriptArgs(argv: string[]): string[] {
  return argv;
}

export async function runTranscriptCommand(argv: string[]): Promise<number> {
  const [entity, action] = argv;
  try {
    const mod = await loadTranscriptSecurity();
    const {
      addPublicKeyToKeyring,
      compactTrustProfiles,
      createEnvelope,
      deriveTrustTier,
      envelopeFilesInDir,
      exportPublicKeyFromPrivate,
      generateEd25519Keypair,
      inspectEnvelope,
      keyringResolver,
      listKeyringEntries,
      loadEnvelopeFromFile,
      recordTrustEvent,
      revokeKeyringEntry,
      signEnvelopeWithEd25519,
      verifyEnvelope,
      verifyTranscriptChain,
      migrateTranscript,
      migrateEnvelope,
    } = mod;

    if (entity === "transcript" && action === "migrate") {
      const input = argv[2];
      const type = argv[3]; // "transcript" or "envelope"
      const version = argv[4] ?? "1.0.0";

      if (!input || !type)
        throw new Error(
          "Usage: zeo transcript migrate <file.json> <type:transcript|envelope> [version]",
        );

      const content = JSON.parse(readFileSync(resolve(input), "utf8"));
      let migrated;
      if (type === "transcript") {
        migrated = migrateTranscript(content, version);
      } else if (type === "envelope") {
        migrated = migrateEnvelope(content, version === "1.0.0" ? "1" : version);
      } else {
        throw new Error("Type must be transcript or envelope");
      }

      process.stdout.write(`${JSON.stringify(migrated, null, 2)}\n`);
      return 0;
    }

    if (entity === "keygen") {
      const keyPath = value(argv, "--out") ?? join(process.cwd(), ".zeo", "keys", "id_ed25519.pem");
      const passphrase = value(argv, "--passphrase");
      mkdirSync(resolve(keyPath, ".."), { recursive: true });
      const key = generateEd25519Keypair(keyPath, passphrase ?? undefined);
      process.stdout.write(
        `${JSON.stringify({ key_path: keyPath, fingerprint: key.fingerprint, public_key: key.publicKeyPem }, null, 2)}\n`,
      );
      return 0;
    }

    if (entity === "key" && action === "export") {
      const keyPath = value(argv, "--key");
      if (!keyPath) throw new Error("--key is required");
      const publicKey = exportPublicKeyFromPrivate(
        keyPath,
        value(argv, "--passphrase") ?? undefined,
      );
      process.stdout.write(`${publicKey.trim()}\n`);
      return 0;
    }

    if (entity === "transcript" && action === "sign") {
      const input = argv[2];
      const keyPath = value(argv, "--key");
      const out = value(argv, "--out");
      if (!input || !keyPath || !out)
        throw new Error(
          "Usage: zeo transcript sign <transcript.json> --key <path> --out <envelope.json>",
        );
      const transcript = JSON.parse(readFileSync(resolve(input), "utf8")) as Record<
        string,
        unknown
      >;
      const envelope = signEnvelopeWithEd25519(
        createEnvelope(transcript, { created_by: "zeo-cli" }),
        keyPath,
        "zeo.transcript.signature.v1",
        value(argv, "--passphrase") ?? undefined,
      );
      writeFileSync(resolve(out), `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
      process.stdout.write(
        `${JSON.stringify({ out, transcript_hash: envelope.transcript_hash, signatures: envelope.signatures.length }, null, 2)}\n`,
      );
      return 0;
    }

    if (entity === "transcript" && action === "countersign") {
      const input = argv[2];
      const out = value(argv, "--out") ?? input;
      const signer = value(argv, "--signer");
      const condition = value(argv, "--if");
      const statement = value(argv, "--statement") ?? "I disagree unless condition holds.";
      if (!input || !signer || !condition)
        throw new Error(
          "Usage: zeo transcript countersign <envelope.json> --signer <id> --if <condition>",
        );
      const envelope = loadEnvelopeFromFile(input) as unknown as Record<string, unknown>;
      const metadata = (envelope.metadata as Record<string, unknown> | undefined) ?? {};
      const objections = readObjections(envelope);
      objections.push({ signer, condition, statement });
      metadata.conditional_objections = objections.sort(
        (a, b) => codePointCompare(a.signer, b.signer) || codePointCompare(a.condition, b.condition),
      );
      envelope.metadata = metadata;
      writeFileSync(resolve(out), `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
      process.stdout.write(`${JSON.stringify({ out, objections: objections.length }, null, 2)}\n`);
      return 0;
    }

    if (entity === "transcript" && action === "disagreements") {
      const input = argv[2];
      if (!input) throw new Error("Usage: zeo transcript disagreements <envelope.json>");
      const envelope = loadEnvelopeFromFile(input) as unknown as Record<string, unknown>;
      process.stdout.write(
        `${JSON.stringify({ transcript_hash: envelope.transcript_hash, disagreements: readObjections(envelope) }, null, 2)}\n`,
      );
      return 0;
    }

    if (entity === "transcript" && action === "consensus") {
      const input = argv[2];
      if (!input) throw new Error("Usage: zeo transcript consensus <envelope.json>");
      const envelope = loadEnvelopeFromFile(input) as unknown as Record<string, unknown>;
      const disagreements = readObjections(envelope);
      const summary = {
        transcript_hash: envelope.transcript_hash,
        signatures: Array.isArray(envelope.signatures) ? envelope.signatures.length : 0,
        disagreements: disagreements.length,
        structural_consensus: disagreements.length === 0 ? "full" : "conditional",
      };
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return 0;
    }

    if (entity === "transcript" && action === "verify") {
      const input = argv[2];
      if (!input)
        throw new Error(
          "Usage: zeo transcript verify <envelope.json> [--pubkey <path> | --keyring <dir>]",
        );
      const envelope = loadEnvelopeFromFile(input);
      const pubkeyPath = value(argv, "--pubkey");
      const keyring = value(argv, "--keyring") ?? join(process.cwd(), ".zeo", "keyring");
      const verify = verifyEnvelope(
        envelope,
        pubkeyPath
          ? () => readFileSync(resolve(pubkeyPath), "utf8")
          : keyringResolver(resolve(keyring)),
      );
      process.stdout.write(`${JSON.stringify(verify, null, 2)}\n`);
      return verify.ok ? 0 : 1;
    }

    if (entity === "transcript" && action === "inspect") {
      const input = argv[2];
      if (!input) throw new Error("Usage: zeo transcript inspect <envelope.json>");
      process.stdout.write(
        `${JSON.stringify(inspectEnvelope(loadEnvelopeFromFile(input)), null, 2)}\n`,
      );
      return 0;
    }

    if (entity === "transcript" && action === "chain" && argv[2] === "verify") {
      const dir = argv[3];
      if (!dir) throw new Error("Usage: zeo transcript chain verify <dir>");
      const envelopes = envelopeFilesInDir(resolve(dir)).map(loadEnvelopeFromFile);
      const result = verifyTranscriptChain(envelopes);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    }

    if (entity === "transcript" && action === "qr") {
      const input = argv[2];
      if (!input) throw new Error("Usage: zeo transcript qr <envelope.json>");
      const envelope = loadEnvelopeFromFile(input);
      const payload = JSON.stringify({
        transcript_hash: envelope.transcript_hash,
        envelope_hash: envelope.transcript_hash,
        envelope_file: resolve(input),
      });
      process.stdout.write(`${JSON.stringify({ payload, qr_ascii: qrAscii(payload) }, null, 2)}\n`);
      return 0;
    }

    if (entity === "transcript" && action === "qr-verify") {
      const payloadFile = argv[2];
      if (!payloadFile) throw new Error("Usage: zeo transcript qr-verify <payload.json>");
      const payload = JSON.parse(readFileSync(resolve(payloadFile), "utf8")) as Record<
        string,
        unknown
      >;
      const envelopePath = String(payload.envelope_file ?? "");
      if (!envelopePath) throw new Error("Missing envelope_file in payload");
      if (!readFileSync(resolve(envelopePath), "utf8"))
        throw new Error("Envelope file not found for offline verification");
      const envelope = loadEnvelopeFromFile(envelopePath);
      const ok = envelope.transcript_hash === payload.transcript_hash;
      process.stdout.write(
        `${JSON.stringify({ ok, reason: ok ? "offline verification passed" : "transcript hash mismatch" }, null, 2)}\n`,
      );
      return ok ? 0 : 1;
    }

    if (entity === "keys" && action === "add") {
      const pubPath = argv[2];
      const keyringDir = value(argv, "--keyring") ?? join(process.cwd(), ".zeo", "keyring");
      if (!pubPath) throw new Error("Usage: zeo keys add <pubkey>");
      const entry = addPublicKeyToKeyring(
        resolve(keyringDir),
        readFileSync(resolve(pubPath), "utf8"),
        value(argv, "--label") ?? undefined,
        value(argv, "--notes") ?? undefined,
      );
      process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
      return 0;
    }

    if (entity === "keys" && action === "list") {
      const keyringDir = value(argv, "--keyring") ?? join(process.cwd(), ".zeo", "keyring");
      process.stdout.write(`${JSON.stringify(listKeyringEntries(resolve(keyringDir)), null, 2)}\n`);
      return 0;
    }

    if (entity === "keys" && action === "revoke") {
      const fingerprint = argv[2];
      const keyringDir = value(argv, "--keyring") ?? join(process.cwd(), ".zeo", "keyring");
      if (!fingerprint) throw new Error("Usage: zeo keys revoke <fingerprint>");
      process.stdout.write(
        `${JSON.stringify(revokeKeyringEntry(resolve(keyringDir), fingerprint), null, 2)}\n`,
      );
      return 0;
    }

    if (entity === "trust" && action === "record") {
      const envPath = value(argv, "--from");
      if (!envPath) throw new Error("Usage: zeo trust record --from <envelope.json>");
      const root = process.cwd();
      const keyringDir = value(argv, "--keyring") ?? join(root, ".zeo", "keyring");
      const envelope = loadEnvelopeFromFile(envPath);
      const verify = verifyEnvelope(envelope, keyringResolver(resolve(keyringDir)));
      for (const fingerprint of verify.signerFingerprints) {
        recordTrustEvent(root, {
          subject_type: "key",
          subject_id: fingerprint,
          transcript_hash: envelope.transcript_hash,
          verify: verify.ok ? "pass" : "fail",
          replay: "pass",
          adjudication: "modified",
        });
      }
      const profiles = compactTrustProfiles(root);
      process.stdout.write(`${JSON.stringify(profiles, null, 2)}\n`);
      return verify.ok ? 0 : 1;
    }

    if (entity === "trust" && action === "show") {
      const subject = argv[2];
      if (!subject) throw new Error("Usage: zeo trust show <subject_type:subject_id>");
      const profiles = compactTrustProfiles(process.cwd());
      const match = profiles.find((p) => `${p.subject_type}:${p.subject_id}` === subject);
      if (!match) throw new Error(`Subject not found: ${subject}`);
      process.stdout.write(
        `${JSON.stringify({ ...match, tier: deriveTrustTier(match) }, null, 2)}\n`,
      );
      return 0;
    }

    if (entity === "trust" && action === "list") {
      const profiles = compactTrustProfiles(process.cwd()).map((p) => ({
        ...p,
        tier: deriveTrustTier(p),
      }));
      process.stdout.write(`${JSON.stringify(profiles, null, 2)}\n`);
      return 0;
    }

    if (entity === "trust" && action === "compact") {
      process.stdout.write(`${JSON.stringify(compactTrustProfiles(process.cwd()), null, 2)}\n`);
      return 0;
    }

    if (entity === "trust" && action === "reset") {
      rmSync(join(process.cwd(), ".zeo", "trust"), {
        recursive: true,
        force: true,
      });
      process.stdout.write('{"ok":true}\n');
      return 0;
    }

    printHelp();
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${JSON.stringify({ error: { code: "ZEO_TRANSCRIPT_FAILED", message } })}\n`,
    );
    return 1;
  }
}

function printHelp(): void {
  process.stdout.write(`Zeo transcript/key/trust commands\n`);
}
