package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"sort"

	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/policy"
	"reach/services/runner/internal/storage"
)

type auditTrail struct {
	Sequence      uint64   `json:"sequence"`
	EventType     string   `json:"event_type"`
	RunID         string   `json:"run_id"`
	PackID        string   `json:"pack_id"`
	PackVersion   string   `json:"pack_version"`
	PackHash      string   `json:"pack_hash"`
	PolicyVersion string   `json:"policy_version"`
	Decision      string   `json:"decision"`
	Reasons       []string `json:"reasons"`
}

func main() {
	dbPath := flag.String("db", "data/runner.sqlite", "path to runner sqlite database")
	tenantID := flag.String("tenant", "", "tenant id")
	runID := flag.String("run", "", "run id")
	flag.Parse()
	if *tenantID == "" || *runID == "" {
		log.Fatal("usage: runner-audit-inspector --tenant <tenant> --run <run-id> [--db path]")
	}
	db, err := storage.NewSQLiteStore(*dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	store := jobs.NewStore(db)
	events, err := store.EventHistory(context.Background(), *tenantID, *runID, 0)
	if err != nil {
		log.Fatal(err)
	}
	var entries []auditTrail
	for _, evt := range events {
		if evt.Type != "audit.trail" {
			continue
		}
		var body auditTrail
		if err := json.Unmarshal(evt.Payload, &body); err != nil {
			log.Fatalf("invalid audit.trail payload id=%d: %v", evt.ID, err)
		}
		entries = append(entries, body)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Sequence < entries[j].Sequence })
	last := uint64(0)
	for _, entry := range entries {
		if entry.Sequence <= last {
			log.Fatalf("non-monotonic sequence at %d", entry.Sequence)
		}
		last = entry.Sequence
		fmt.Printf("%06d %s pack=%s@%s decision=%s reasons=%v\n", entry.Sequence, entry.EventType, entry.PackID, entry.PackVersion, entry.Decision, entry.Reasons)
		if entry.EventType == "pack.denied" || entry.EventType == "pack.admitted" {
			res := policy.Evaluate(policy.Input{Pack: policy.ExecutionPack{ID: entry.PackID, Version: entry.PackVersion, Hash: entry.PackHash, Signed: entry.PackHash != ""}, Policy: policy.OrgPolicy{Version: entry.PolicyVersion}})
			if entry.EventType == "pack.admitted" && !res.Allowed {
				log.Fatalf("deterministic validation failed for pack admission %s@%s", entry.PackID, entry.PackVersion)
			}
		}
	}
}
