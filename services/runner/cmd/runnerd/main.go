package main

import (
	"log"
	"net/http"
	"os"

	"reach/services/runner/internal/api"
	"reach/services/runner/internal/jobs"
)

func main() {
	addr := os.Getenv("RUNNER_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	auditDir := os.Getenv("RUNNER_AUDIT_DIR")
	if auditDir == "" {
		auditDir = ".runner-audit"
	}

	server := api.NewServer(jobs.NewStore(jobs.NewFileAuditLogger(auditDir)))
	log.Printf("runner listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}
