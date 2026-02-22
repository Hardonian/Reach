package main

import (
	"fmt"
	"os"
	"runtime"
)

func main() {
	// 1. Identity
	// In a real build, this would be injected via ldflags
	fmt.Println("Reach v0.3.1")

	// 2. System Checks
	fmt.Println("System:")
	fmt.Printf("  [OK] OS: %s/%s\n", runtime.GOOS, runtime.GOARCH)
	fmt.Printf("  [OK] Shell: %s\n", os.Getenv("SHELL"))

	// 3. Configuration Checks
	fmt.Println("Configuration:")
	// Check for .env in the root (assuming tools/doctor is 2 levels deep from root)
	if _, err := os.Stat("../../.env"); err == nil {
		fmt.Println("  [OK] .env file found")
	} else if os.IsNotExist(err) {
		fmt.Println("  [WARN] .env file missing in root (using defaults)")
	} else {
		fmt.Printf("  [FAIL] Error checking .env: %v\n", err)
	}
}
