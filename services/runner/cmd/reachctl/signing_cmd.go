package main

// signing_cmd.go — Phase D: Cryptographic Signing CLI
//
// Commands:
//   reachctl sign <runId> [--key-dir <dir>] [--output <dir>]
//   reachctl verify-signature <runId|sigFile> [--json]

import (
	"context"
	"flag"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"reach/services/runner/internal/signing"
)

// runSign implements `reachctl sign <runId>`.
func runSign(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("sign", flag.ContinueOnError)
	fs.SetOutput(errOut)
	keyDirFlag := fs.String("key-dir", "", "Directory containing signing keys (default: data/.keys)")
	outputFlag := fs.String("output", "", "Directory to write signature file (default: data/signatures)")
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reachctl sign <runId> [--key-dir <dir>] [--output <dir>] [--json]")
		return 1
	}
	runID := remaining[0]

	// Resolve key directory
	keyDir := *keyDirFlag
	if keyDir == "" {
		keyDir = filepath.Join(dataRoot, ".keys")
	}

	// Load or create keypair
	kp, err := signing.LoadOrCreateKeyPair(keyDir)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error loading signing key: %v\n", err)
		return 1
	}

	// Load run record to get its proof hash
	rec, err := loadRunRecord(dataRoot, runID)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "run not found: %v\n", err)
		return 1
	}

	// Compute proof hash (canonical, deterministic)
	proofHash := stableHash(map[string]any{"event_log": rec.EventLog, "run_id": rec.RunID})

	// Sign
	sig, err := kp.Sign(runID, proofHash)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "signing failed: %v\n", err)
		return 1
	}

	// Save signature
	outputDir := *outputFlag
	if outputDir == "" {
		outputDir = filepath.Join(dataRoot, "signatures")
	}
	sigPath, err := signing.SaveSignature(sig, outputDir)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to save signature: %v\n", err)
		return 1
	}

	result := map[string]any{
		"run_id":         sig.RunID,
		"proof_hash":     sig.ProofHash,
		"algorithm":      sig.Algorithm,
		"public_key":     sig.PublicKey,
		"signature_hex":  sig.SignatureHex[:16] + "...", // truncated — never expose full sig in non-JSON mode
		"signed_at":      sig.SignedAt,
		"signature_file": sigPath,
	}

	if *jsonFlag {
		// JSON output includes the full signature
		result["signature_hex"] = sig.SignatureHex
		return writeJSON(out, result)
	}

	_, _ = fmt.Fprintf(out, "✓ Signed run: %s\n", runID)
	_, _ = fmt.Fprintf(out, "  Proof hash:   %s\n", proofHash[:16]+"...")
	_, _ = fmt.Fprintf(out, "  Algorithm:    %s\n", sig.Algorithm)
	_, _ = fmt.Fprintf(out, "  Public key:   %s...\n", sig.PublicKey[:16])
	_, _ = fmt.Fprintf(out, "  Signature:    %s (full in .sig.json)\n", sig.SignatureHex[:16]+"...")
	_, _ = fmt.Fprintf(out, "  Saved to:     %s\n", sigPath)
	return 0
}

// runVerifySignature implements `reachctl verify-signature <runId|sigFile>`.
func runVerifySignature(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("verify-signature", flag.ContinueOnError)
	fs.SetOutput(errOut)
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reachctl verify-signature <runId|sigFile> [--json]")
		return 1
	}
	target := remaining[0]

	// Accept either a run ID or a path to a .sig.json file
	var sigPath string
	if strings.HasSuffix(target, ".sig.json") || strings.Contains(target, string(filepath.Separator)) {
		sigPath = target
	} else {
		// Look up by run ID
		sigPath = filepath.Join(dataRoot, "signatures", target+".sig.json")
	}

	sig, verifyErr := signing.VerifyFromFile(sigPath)
	if sig == nil {
		_, _ = fmt.Fprintf(errOut, "error: %v\n", verifyErr)
		return 1
	}

	valid := verifyErr == nil
	result := map[string]any{
		"run_id":     sig.RunID,
		"proof_hash": sig.ProofHash,
		"algorithm":  sig.Algorithm,
		"public_key": sig.PublicKey,
		"valid":      valid,
		"signed_at":  sig.SignedAt,
	}
	if !valid {
		result["error"] = verifyErr.Error()
	}

	if *jsonFlag {
		return writeJSON(out, result)
	}

	symbol := "✓"
	status := "VALID"
	if !valid {
		symbol = "✗"
		status = "INVALID"
	}
	_, _ = fmt.Fprintf(out, "%s Signature Verification: %s\n", symbol, status)
	_, _ = fmt.Fprintf(out, "  Run:        %s\n", sig.RunID)
	_, _ = fmt.Fprintf(out, "  Proof hash: %s\n", sig.ProofHash[:16]+"...")
	_, _ = fmt.Fprintf(out, "  Algorithm:  %s\n", sig.Algorithm)
	_, _ = fmt.Fprintf(out, "  Public key: %s...\n", sig.PublicKey[:16])
	if !valid {
		_, _ = fmt.Fprintf(errOut, "  Error: %v\n", verifyErr)
		return 1
	}
	return 0
}
