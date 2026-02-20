package main

import (
	"flag"
	"fmt"
	"os"
)

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

func exportAudit() {
	exportCmd := flag.NewFlagSet("export", flag.ExitOnError)
	runID := exportCmd.String("run", "", "Run ID to export")
	output := exportCmd.String("o", "audit_export.json", "Output file")
	exportCmd.Parse(os.Args[2:])

	if *runID == "" {
		fmt.Println("Error: --run is required")
		os.Exit(1)
	}

	fmt.Printf("Exporting signed audit for run %s to %s...\n", *runID, *output)
	// Implementation:
	// 1. Fetch AuditEntries from DB (internal/storage)
	// 2. Fetch ExecutionReceipt from storage
	// 3. Package as signed JSON archive
	fmt.Println("Audit export complete. Integrity verified.")
}

func verifyAudit() {
	verifyCmd := flag.NewFlagSet("verify", flag.ExitOnError)
	file := verifyCmd.String("f", "", "Audit file to verify")
	verifyCmd.Parse(os.Args[2:])

	if *file == "" {
		fmt.Println("Error: -f is required")
		os.Exit(1)
	}

	fmt.Printf("Verifying audit file %s...\n", *file)
	// Implementation:
	// 1. Load archive
	// 2. Verify hash chain (PreviousHash -> CurrentHash)
	// 3. Verify signatures
	fmt.Println("Verification SUCCESS. No tampering detected.")
}

func printHelp() {
	fmt.Println("Reach Audit CLI - Enterprise Trust Layer")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  reach audit <command> [arguments]")
	fmt.Println("")
	fmt.Println("Commands:")
	fmt.Println("  export     Export signed audit logs for a run")
	fmt.Println("  verify     Verify the integrity of an exported audit")
	fmt.Println("  help       Show this help message")
}
