package main

import (
	"fmt"
	"log"
	"os"

	"reach/services/policy-engine/internal/policies"
)

func main() {
	root := os.Getenv("POLICY_BUNDLE_ROOT")
	if root == "" {
		root = "policies"
	}
	bundles, err := policies.LoadBundles(root)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("loaded %d policy bundles\n", len(bundles))
}
