package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSQLiteStore_CRUD(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "storage-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.sqlite")
	s, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	ctx := context.Background()
	tenant := "test-tenant"
	runID := "run-1"

	// 1. Create Run
	run := RunRecord{
		ID:           runID,
		TenantID:     tenant,
		Status:       "pending",
		Capabilities: []string{"test:cap"},
		CreatedAt:    time.Now().UTC(),
		PackCID:      "cid-123",
	}
	if err := s.CreateRun(ctx, run); err != nil {
		t.Fatalf("failed to create run: %v", err)
	}

	// 2. Get Run
	got, err := s.GetRun(ctx, tenant, runID)
	if err != nil {
		t.Fatalf("failed to get run: %v", err)
	}
	if got.ID != runID || got.PackCID != "cid-123" {
		t.Errorf("expected run %s, got %s", runID, got.ID)
	}

	// 3. Append Event
	event := EventRecord{
		RunID:     runID,
		Type:      "test.event",
		Payload:   []byte(`{"foo":"bar"}`),
		CreatedAt: time.Now().UTC(),
	}
	if _, err := s.AppendEvent(ctx, event); err != nil {
		t.Fatalf("failed to append event: %v", err)
	}

	// 4. List Events
	events, err := s.ListEvents(ctx, tenant, runID, 0)
	if err != nil {
		t.Fatalf("failed to list events: %v", err)
	}
	if len(events) != 1 {
		t.Errorf("expected 1 event, got %d", len(events))
	}

	// 5. Append Audit
	audit := AuditRecord{
		TenantID:  tenant,
		RunID:     runID,
		Type:      "test.audit",
		Payload:   []byte(`{"audited":true}`),
		CreatedAt: time.Now().UTC(),
	}
	if err := s.AppendAudit(ctx, audit); err != nil {
		t.Fatalf("failed to append audit: %v", err)
	}

	// 6. List Audit
	audits, err := s.ListAudit(ctx, tenant, runID)
	if err != nil {
		t.Fatalf("failed to list audit: %v", err)
	}
	if len(audits) != 1 {
		t.Errorf("expected 1 audit, got %d", len(audits))
	}
}

func TestSQLiteStore_Ping(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "storage-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.sqlite")
	s, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	if err := s.Ping(context.Background()); err != nil {
		t.Errorf("ping failed: %v", err)
	}
}
