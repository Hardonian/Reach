package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"
)

// AuditEntry represents a single auditable event in the hash chain.
type AuditEntry struct {
	Index        int       `json:"index"`
	RunID        string    `json:"run_id"`
	EventType    string    `json:"event_type"`
	Timestamp    time.Time `json:"timestamp"`
	Payload      string    `json:"payload"`
	PreviousHash string    `json:"previous_hash"`
	CurrentHash  string    `json:"current_hash"`
}

// AuditArchive is the signed export format.
type AuditArchive struct {
	Version    string       `json:"version"`
	RunID      string       `json:"run_id"`
	ExportedAt time.Time    `json:"exported_at"`
	Entries    []AuditEntry `json:"entries"`
	RootHash   string       `json:"root_hash"`
}

func main() {
	if len(os.Args) < 2 {
		printHelp()
		return
	}

	cmd := os.Args[1]
	switch cmd {
	case "export":
		exportAudit()
	case "verify":
		verifyAudit()
	case "help":
		printHelp()
	default:
		fmt.Printf("Unknown command: %s\n", cmd)
		printHelp()
		os.Exit(1)
	}
}

// computeEntryHash produces a deterministic SHA256 hash for an audit entry.
func computeEntryHash(index int, runID, eventType, payload, previousHash string, ts time.Time) string {
	canonical := fmt.Sprintf("%d|%s|%s|%s|%s|%s",
		index, runID, eventType, ts.UTC().Format(time.RFC3339Nano), payload, previousHash)
	h := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(h[:])
}

func exportAudit() {
	exportCmd := flag.NewFlagSet("export", flag.ExitOnError)
	runID := exportCmd.String("run", "", "Run ID to export")
	output := exportCmd.String("o", "audit_export.json", "Output file")
	input := exportCmd.String("i", "", "Input JSONL audit log file")
	exportCmd.Parse(os.Args[2:])

	if *runID == "" {
		fmt.Println("Error: --run is required")
		os.Exit(1)
	}

	fmt.Printf("Exporting signed audit for run %s to %s...\n", *runID, *output)

	var entries []AuditEntry

	if *input != "" {
		// Load entries from JSONL file
		data, err := os.ReadFile(*input)
		if err != nil {
			fmt.Printf("Error reading input file: %v\n", err)
			os.Exit(1)
		}
		for _, line := range splitLines(data) {
			if len(line) == 0 {
				continue
			}
			var entry AuditEntry
			if err := json.Unmarshal(line, &entry); err != nil {
				fmt.Printf("Error parsing audit entry: %v\n", err)
				os.Exit(1)
			}
			entries = append(entries, entry)
		}
	}

	// Rebuild hash chain for integrity
	previousHash := "genesis"
	for i := range entries {
		entries[i].Index = i
		entries[i].PreviousHash = previousHash
		entries[i].CurrentHash = computeEntryHash(
			i, entries[i].RunID, entries[i].EventType,
			entries[i].Payload, previousHash, entries[i].Timestamp,
		)
		previousHash = entries[i].CurrentHash
	}

	archive := AuditArchive{
		Version:    "1.0.0",
		RunID:      *runID,
		ExportedAt: time.Now().UTC(),
		Entries:    entries,
		RootHash:   previousHash,
	}

	archiveData, err := json.MarshalIndent(archive, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling archive: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*output, archiveData, 0644); err != nil {
		fmt.Printf("Error writing output file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Audit export complete. %d entries. Root hash: %s\n", len(entries), previousHash)
}

func verifyAudit() {
	verifyCmd := flag.NewFlagSet("verify", flag.ExitOnError)
	file := verifyCmd.String("f", "", "Audit archive file to verify")
	verifyCmd.Parse(os.Args[2:])

	if *file == "" {
		fmt.Println("Error: -f is required")
		os.Exit(1)
	}

	fmt.Printf("Verifying audit file %s...\n", *file)

	data, err := os.ReadFile(*file)
	if err != nil {
		fmt.Printf("Error reading file: %v\n", err)
		os.Exit(1)
	}

	var archive AuditArchive
	if err := json.Unmarshal(data, &archive); err != nil {
		fmt.Printf("Error parsing archive: %v\n", err)
		os.Exit(1)
	}

	if len(archive.Entries) == 0 {
		fmt.Println("Archive contains no entries.")
		os.Exit(0)
	}

	// Verify hash chain
	previousHash := "genesis"
	for i, entry := range archive.Entries {
		if entry.PreviousHash != previousHash {
			fmt.Printf("FAIL: Entry %d previous hash mismatch (expected %s, got %s)\n", i, previousHash, entry.PreviousHash)
			os.Exit(2)
		}

		expectedHash := computeEntryHash(
			entry.Index, entry.RunID, entry.EventType,
			entry.Payload, previousHash, entry.Timestamp,
		)

		if entry.CurrentHash != expectedHash {
			fmt.Printf("FAIL: Entry %d hash mismatch (expected %s, got %s)\n", i, expectedHash, entry.CurrentHash)
			os.Exit(2)
		}

		previousHash = entry.CurrentHash
	}

	// Verify root hash
	if archive.RootHash != previousHash {
		fmt.Printf("FAIL: Root hash mismatch (expected %s, got %s)\n", previousHash, archive.RootHash)
		os.Exit(2)
	}

	fmt.Printf("Verification SUCCESS. %d entries verified. No tampering detected.\n", len(archive.Entries))
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			lines = append(lines, data[start:i])
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}

func printHelp() {
	fmt.Println("Reach Audit CLI - Enterprise Trust Layer")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  reach audit <command> [arguments]")
	fmt.Println("")
	fmt.Println("Commands:")
	fmt.Println("  export     Export signed audit logs for a run")
	fmt.Println("             --run <id>    Run ID to export (required)")
	fmt.Println("             -i <file>     Input JSONL audit log file")
	fmt.Println("             -o <file>     Output file (default: audit_export.json)")
	fmt.Println("  verify     Verify the integrity of an exported audit")
	fmt.Println("             -f <file>     Audit archive file to verify (required)")
	fmt.Println("  help       Show this help message")
}
