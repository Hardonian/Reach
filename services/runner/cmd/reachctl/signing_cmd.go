package main

// signing_cmd.go — Phase D: Cryptographic Signing CLI
//
// Commands:
//   reachctl sign <runId> [--key-dir <dir>] [--output <dir>]
//   reachctl verify-signature <runId|sigFile> [--json]
//   reachctl signing list
//   reachctl signing info <plugin>
//   reachctl signing sign <plugin> <data>
//   reachctl signing verify <plugin> <data> <signature>
//   reachctl signing keygen [--key-dir <dir>] [--key-id <id>]

import (
	"context"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"

	packkitsigning "reach/internal/packkit/signing"
	signingrunner "reach/services/runner/internal/signing"
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
	kp, err := signingrunner.LoadOrCreateKeyPair(keyDir)
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
	sigPath, err := signingrunner.SaveSignature(sig, outputDir)
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

	sig, verifyErr := signingrunner.VerifyFromFile(sigPath)
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

// runSigningPlugin handles the `reachctl signing` subcommands.
func runSigningPlugin(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usageSigning(out)
		return 1
	}

	switch args[0] {
	case "list":
		return runSigningList(out)
	case "info":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl signing info <plugin>")
			return 1
		}
		return runSigningInfo(args[1], out, errOut)
	case "sign":
		if len(args) < 3 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl signing sign <plugin> <data>")
			return 1
		}
		return runSigningSign(args[1], args[2], out, errOut)
	case "verify":
		if len(args) < 4 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl signing verify <plugin> <data> <signature>")
			return 1
		}
		return runSigningVerify(args[1], args[2], args[3], out, errOut)
	case "keygen":
		return runSigningKeygen(args[1:], dataRoot, out, errOut)
	default:
		usageSigning(out)
		return 1
	}
}

// runSigningList lists all available signing plugins.
func runSigningList(out io.Writer) int {
	plugins := packkitsigning.GlobalRegistry.List()
	// Sort for deterministic output
	sort.Strings(plugins)

	result := map[string]any{
		"plugins": plugins,
	}
	return writeJSON(out, result)
}

// runSigningInfo shows information about a signing plugin.
func runSigningInfo(pluginName string, out io.Writer, errOut io.Writer) int {
	plugin, err := packkitsigning.GlobalRegistry.Get(pluginName)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error: %v\n", err)
		return 1
	}

	// Get algorithms
	algos := plugin.SupportedAlgorithms()
	algoStrs := make([]string, len(algos))
	for i, a := range algos {
		algoStrs[i] = string(a)
	}

	result := map[string]any{
		"name":                  plugin.Name(),
		"supported_algorithms": algoStrs,
	}
	return writeJSON(out, result)
}

// runSigningSign signs data using a plugin.
func runSigningSign(pluginName string, data string, out io.Writer, errOut io.Writer) int {
	plugin, err := packkitsigning.GlobalRegistry.Get(pluginName)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error: %v\n", err)
		return 1
	}

	// Get the algorithm
	algos := plugin.SupportedAlgorithms()
	if len(algos) == 0 {
		_, _ = fmt.Fprintln(errOut, "error: plugin supports no algorithms")
		return 1
	}
	algorithm := string(algos[0])

	// Sign the data
	sig, err := plugin.Sign([]byte(data), algorithm)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "signing error: %v\n", err)
		return 1
	}

	result := map[string]any{
		"plugin":    plugin.Name(),
		"algorithm": algorithm,
		"data":      data,
		"signature": hex.EncodeToString(sig),
	}
	return writeJSON(out, result)
}

// runSigningVerify verifies a signature using a plugin.
func runSigningVerify(pluginName string, data string, signatureHex string, out io.Writer, errOut io.Writer) int {
	plugin, err := packkitsigning.GlobalRegistry.Get(pluginName)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error: %v\n", err)
		return 1
	}

	// Get the algorithm
	algos := plugin.SupportedAlgorithms()
	if len(algos) == 0 {
		_, _ = fmt.Fprintln(errOut, "error: plugin supports no algorithms")
		return 1
	}
	algorithm := string(algos[0])

	// Decode signature
	sig, err := hex.DecodeString(signatureHex)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error: invalid signature hex: %v\n", err)
		return 1
	}

	// Verify
	valid, err := plugin.Verify([]byte(data), sig, algorithm)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "verification error: %v\n", err)
		return 1
	}

	result := map[string]any{
		"plugin":    plugin.Name(),
		"algorithm": algorithm,
		"data":      data,
		"valid":     valid,
	}
	return writeJSON(out, result)
}

// runSigningKeygen generates a new signing key for the file-based signer.
func runSigningKeygen(args []string, dataRoot string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("signing keygen", flag.ContinueOnError)
	fs.SetOutput(errOut)
	keyDirFlag := fs.String("key-dir", "", "Directory to store keys (default: data/.keys)")
	keyIDFlag := fs.String("key-id", "default", "Key ID to generate")
	_ = fs.Parse(args)

	keyDir := *keyDirFlag
	if keyDir == "" {
		keyDir = filepath.Join(dataRoot, ".keys")
	}

	keyID := *keyIDFlag

	// Create the file key signer with the specified key
	_, err := packkitsigning.NewFileKeySigner(map[string]string{
		"keyDir": keyDir,
		"keyId":  keyID,
	})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error generating key: %v\n", err)
		return 1
	}

	// Get the public key
	signer, err := packkitsigning.FileKeySignerFromDir(keyDir)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error loading key: %v\n", err)
		return 1
	}

	result := map[string]any{
		"key_dir":   keyDir,
		"key_id":    keyID,
		"public_key": signer.(*packkitsigning.FileKeySigner).PublicKeyHex(),
	}
	return writeJSON(out, result)
}

func usageSigning(out io.Writer) {
	_, _ = fmt.Fprintln(out, "Usage: reachctl signing <command> [options]")
	_, _ = fmt.Fprintln(out, "")
	_, _ = fmt.Fprintln(out, "Commands:")
	_, _ = fmt.Fprintln(out, "  list              List available signing plugins")
	_, _ = fmt.Fprintln(out, "  info <plugin>    Show information about a plugin")
	_, _ = fmt.Fprintln(out, "  sign <plugin> <data>  Sign data with a plugin")
	_, _ = fmt.Fprintln(out, "  verify <plugin> <data> <signature>  Verify a signature")
	_, _ = fmt.Fprintln(out, "  keygen [--key-dir <dir>] [--key-id <id>]  Generate a new key")
	_, _ = fmt.Fprintln(out, "")
	_, _ = fmt.Fprintln(out, "Plugins:")
	_, _ = fmt.Fprintln(out, "  noop    No-op signer (for testing)")
	_, _ = fmt.Fprintln(out, "  file    File-based signer (reads keys from files)")
}
