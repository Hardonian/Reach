package main

// proofbundle_cmd.go — Phase X: Proof Bundle CLI
//
// Commands:
//   reachctl proof bundle export <runId> [--output <file>]
//   reachctl proof verify --bundle <file>

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	pb "reach/internal/packkit/proofbundle"
)

// runProofBundle handles 'reach proof bundle <command>'
func runProofBundle(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usageProofBundle(out)
		return 1
	}

	switch args[0] {
	case "export":
		return runProofBundleExport(ctx, dataRoot, args[1:], out, errOut)
	default:
		usageProofBundle(out)
		return 1
	}
}

// runProofBundleExport handles 'reach proof bundle export <runId> [--output <file>]'
func runProofBundleExport(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("proof bundle export", flag.ContinueOnError)
	fs.SetOutput(errOut)
	outputFlag := fs.String("output", "", "Output file path (default: <runId>.reach-proof.json)")
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	if fs.NArg() < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach proof bundle export <runId> [--output <file>] [--json]")
		return 1
	}

	runID := fs.Arg(0)

	// Load run record
	record, err := loadRunRecord(dataRoot, runID)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "run not found: %v\n", err)
		return 1
	}

	// Compute hashes from the run record using existing merkleRoot function
	merkleRootHash := merkleRoot(record.AuditChain)
	fingerprint := stableHash(map[string]any{"event_log": record.EventLog, "run_id": record.RunID})

	// For the proof bundle, we derive the digests from the record
	// In a full implementation, these would come from the execution context
	outputDigest := fingerprint
	policyBytes, _ := json.Marshal(record.Policy)
	policyDigest := stableHash(map[string]any{"policy": string(policyBytes)})
	transcriptDigest := stableHash(map[string]any{"event_log": record.EventLog})

	// Get engine and protocol versions
	engineVersion := "1.0.0" // This would come from the actual engine
	protocolVersion := "1.0.0"

	// Extract input artifact digests from the run record
	var artifactDigests []pb.ArtifactDigest
	// Artifacts not directly in runRecord, using registry snapshot hash as a proxy
	if record.RegistrySnapshotHash != "" {
		artifactDigests = append(artifactDigests, pb.ArtifactDigest{
			Name:    "registry_snapshot",
			Digest:  record.RegistrySnapshotHash,
			Version: "",
		})
	}

	// Create the proof bundle using current timestamp (deterministic export time)
	// Note: For true determinism, this would come from the run record metadata
	createdAt := "2024-01-01T00:00:00Z" // Placeholder - in production, store in run record

	bundle, err := pb.Export(pb.ExportOptions{
		RunID:                runID,
		EngineVersion:        engineVersion,
		ProtocolVersion:      protocolVersion,
		CreatedAt:            createdAt,
		MerkleRoot:           merkleRootHash,
		InputArtifactDigests: artifactDigests,
		OutputDigest:         outputDigest,
		PolicyDigest:         policyDigest,
		TranscriptDigest:     transcriptDigest,
	})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to create proof bundle: %v\n", err)
		return 1
	}

	// Determine output path
	outputPath := *outputFlag
	if outputPath == "" {
		outputPath = runID + ".reach-proof.json"
	}

	// Write the bundle using os.Create
	f, err := os.Create(outputPath)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to create output file: %v\n", err)
		return 1
	}
	defer f.Close()

	if err := pb.Save(bundle, f); err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to write proof bundle: %v\n", err)
		return 1
	}

	if *jsonFlag {
		return writeJSON(out, map[string]any{
			"run_id":      runID,
			"fingerprint": bundle.Fingerprint,
			"merkle_root": bundle.MerkleRoot,
			"output_file": outputPath,
		})
	}

	_, _ = fmt.Fprintf(out, "✓ Exported proof bundle: %s\n", outputPath)
	_, _ = fmt.Fprintf(out, "  Run ID:       %s\n", runID)
	_, _ = fmt.Fprintf(out, "  Fingerprint:  %s\n", bundle.Fingerprint[:16]+"...")
	_, _ = fmt.Fprintf(out, "  Merkle Root:  %s\n", bundle.MerkleRoot[:16]+"...")
	return 0
}

// runProofVerifyBundle handles 'reach proof verify --bundle <file>'
func runProofVerifyBundle(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("proof verify --bundle", flag.ContinueOnError)
	fs.SetOutput(errOut)
	bundleFlag := fs.String("bundle", "", "Path to proof bundle file (.reach-proof.json)")
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	if *bundleFlag == "" {
		_, _ = fmt.Fprintln(errOut, "error: --bundle flag is required")
		_, _ = fmt.Fprintln(errOut, "usage: reach proof verify --bundle <file> [--json]")
		return 1
	}

	// Load the proof bundle
	bundle, err := loadProofBundle(*bundleFlag)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error loading proof bundle: %v\n", err)
		return 1
	}

	// Verify the bundle
	result := pb.Verify(bundle, nil)

	if *jsonFlag {
		return writeJSON(out, map[string]any{
			"valid":     result.Valid,
			"exit_code": result.ExitCode,
			"step":      result.StepName,
			"error":     result.Error,
			"details":   result.Details,
		})
	}

	// Human-readable output
	symbol := "✓"
	status := "VALID"
	if !result.Valid {
		symbol = "✗"
		status = "INVALID"
	}

	_, _ = fmt.Fprintf(out, "%s Proof Bundle Verification: %s\n", symbol, status)
	_, _ = fmt.Fprintf(out, "  Fingerprint: %s\n", bundle.Fingerprint[:16]+"...")
	_, _ = fmt.Fprintf(out, "  Merkle Root: %s\n", bundle.MerkleRoot[:16]+"...")
	_, _ = fmt.Fprintf(out, "  Run ID:      %s\n", bundle.RunID)
	_, _ = fmt.Fprintf(out, "  Version:     %s\n", bundle.Version)

	if !result.Valid {
		_, _ = fmt.Fprintf(errOut, "\n✗ Verification failed at step: %s\n", result.StepName)
		_, _ = fmt.Fprintf(errOut, "  Error: %s\n", result.Error)
		return result.ExitCode
	}

	return 0
}

// loadProofBundle loads a proof bundle from a file.
func loadProofBundle(path string) (*pb.ProofBundle, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read file: %w", err)
	}
	return pb.Parse(data)
}

func usageProofBundle(out io.Writer) {
	_, _ = io.WriteString(out, `usage: reach proof bundle <command> [options]

Commands:
  export <runId>             Export proof bundle for a run

Options:
  --output <file>           Output file path (default: <runId>.reach-proof.json)
  --json                    Output JSON

Examples:
  reach proof bundle export abc123
  reach proof bundle export abc123 --output /tmp/proof.reach-proof.json
`)
}
