package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewSQLiteStore(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	if store.db == nil {
		t.Error("expected db to be initialized")
	}
}

func TestCreateAndGetRun(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()
	rec := RunRecord{
		ID:           "run-123",
		TenantID:     "tenant-456",
		Status:       "pending",
		Capabilities: []string{"tool-a", "tool-b"},
		CreatedAt:    time.Now(),
	}

	if err := store.CreateRun(ctx, rec); err != nil {
		t.Fatalf("CreateRun failed: %v", err)
	}

	got, err := store.GetRun(ctx, rec.TenantID, rec.ID)
	if err != nil {
		t.Fatalf("GetRun failed: %v", err)
	}

	if got.ID != rec.ID {
		t.Errorf("expected ID %s, got %s", rec.ID, got.ID)
	}
	if got.TenantID != rec.TenantID {
		t.Errorf("expected TenantID %s, got %s", rec.TenantID, got.TenantID)
	}
	if got.Status != rec.Status {
		t.Errorf("expected Status %s, got %s", rec.Status, got.Status)
	}
	if len(got.Capabilities) != 2 {
		t.Errorf("expected 2 capabilities, got %d", len(got.Capabilities))
	}
}

func TestGetRunNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()
	_, err = store.GetRun(ctx, "nonexistent", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestAppendAndListEvents(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Create a run first
	runRec := RunRecord{
		ID:        "run-events",
		TenantID:  "tenant-1",
		Status:    "active",
		CreatedAt: time.Now(),
	}
	if err := store.CreateRun(ctx, runRec); err != nil {
		t.Fatalf("CreateRun failed: %v", err)
	}

	// Append events
	events := []EventRecord{
		{RunID: "run-events", Type: "start", Payload: []byte(`{"msg":"started"}`), CreatedAt: time.Now()},
		{RunID: "run-events", Type: "step", Payload: []byte(`{"step":1}`), CreatedAt: time.Now()},
		{RunID: "run-events", Type: "complete", Payload: []byte(`{"done":true}`), CreatedAt: time.Now()},
	}

	var lastID int64
	for _, e := range events {
		id, err := store.AppendEvent(ctx, e)
		if err != nil {
			t.Fatalf("AppendEvent failed: %v", err)
		}
		if id <= lastID {
			t.Error("expected event ID to increase")
		}
		lastID = id
	}

	// List events
	list, err := store.ListEvents(ctx, "tenant-1", "run-events", 0)
	if err != nil {
		t.Fatalf("ListEvents failed: %v", err)
	}

	if len(list) != 3 {
		t.Errorf("expected 3 events, got %d", len(list))
	}

	// Test after ID filtering
	listAfter, err := store.ListEvents(ctx, "tenant-1", "run-events", lastID-1)
	if err != nil {
		t.Fatalf("ListEvents after ID failed: %v", err)
	}

	if len(listAfter) != 1 {
		t.Errorf("expected 1 event after filtering, got %d", len(listAfter))
	}
}

func TestAppendAndListAudit(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Create a run first
	runRec := RunRecord{
		ID:        "run-audit",
		TenantID:  "tenant-1",
		Status:    "active",
		CreatedAt: time.Now(),
	}
	if err := store.CreateRun(ctx, runRec); err != nil {
		t.Fatalf("CreateRun failed: %v", err)
	}

	// Append audit records
	audits := []AuditRecord{
		{TenantID: "tenant-1", RunID: "run-audit", Type: "policy_check", Payload: []byte(`{"allowed":true}`), CreatedAt: time.Now()},
		{TenantID: "tenant-1", RunID: "run-audit", Type: "tool_call", Payload: []byte(`{"tool":"exec"}`), CreatedAt: time.Now()},
	}

	for _, a := range audits {
		if err := store.AppendAudit(ctx, a); err != nil {
			t.Fatalf("AppendAudit failed: %v", err)
		}
	}

	// List audit records
	list, err := store.ListAudit(ctx, "tenant-1", "run-audit")
	if err != nil {
		t.Fatalf("ListAudit failed: %v", err)
	}

	if len(list) != 2 {
		t.Errorf("expected 2 audit records, got %d", len(list))
	}
}

func TestSessionStore(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Put session
	session := SessionRecord{
		ID:        "session-123",
		TenantID:  "tenant-1",
		UserID:    "user-456",
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(time.Hour),
	}

	if err := store.PutSession(ctx, session); err != nil {
		t.Fatalf("PutSession failed: %v", err)
	}

	// Get session
	got, err := store.GetSession(ctx, session.ID)
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}

	if got.ID != session.ID {
		t.Errorf("expected ID %s, got %s", session.ID, got.ID)
	}
	if got.TenantID != session.TenantID {
		t.Errorf("expected TenantID %s, got %s", session.TenantID, got.TenantID)
	}
	if got.UserID != session.UserID {
		t.Errorf("expected UserID %s, got %s", session.UserID, got.UserID)
	}

	// Delete session
	if err := store.DeleteSession(ctx, session.ID); err != nil {
		t.Fatalf("DeleteSession failed: %v", err)
	}

	// Verify deleted
	_, err = store.GetSession(ctx, session.ID)
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestJobStore(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Enqueue job
	job := JobRecord{
		ID:             "job-123",
		TenantID:       "tenant-1",
		SessionID:      "session-1",
		RunID:          "run-1",
		AgentID:        "agent-1",
		NodeID:         "node-1",
		Type:           "test-job",
		PayloadJSON:    `{"key":"value"}`,
		IdempotencyKey: "idem-key-1",
		Priority:       10,
		Attempts:       0,
		MaxAttempts:    3,
		Status:         "queued",
		NextRunAt:      time.Now(),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := store.EnqueueJob(ctx, job); err != nil {
		t.Fatalf("EnqueueJob failed: %v", err)
	}

	// Get job by idempotency key
	got, err := store.GetJobByIdempotency(ctx, job.TenantID, job.IdempotencyKey)
	if err != nil {
		t.Fatalf("GetJobByIdempotency failed: %v", err)
	}

	if got.ID != job.ID {
		t.Errorf("expected ID %s, got %s", job.ID, got.ID)
	}
	if got.Status != job.Status {
		t.Errorf("expected Status %s, got %s", job.Status, got.Status)
	}
}

func TestNodeStore(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Upsert node
	node := NodeRecord{
		ID:               "node-123",
		TenantID:         "tenant-1",
		Type:             "executor",
		CapabilitiesJSON: `["docker","python"]`,
		Status:           "active",
		TagsJSON:         `{"region":"us-east"}`,
		LatencyMS:        50,
		LoadScore:        10,
		LastHeartbeatAt:  time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := store.UpsertNode(ctx, node); err != nil {
		t.Fatalf("UpsertNode failed: %v", err)
	}

	// List nodes
	nodes, err := store.ListNodes(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("ListNodes failed: %v", err)
	}

	if len(nodes) != 1 {
		t.Errorf("expected 1 node, got %d", len(nodes))
	}

	if nodes[0].ID != node.ID {
		t.Errorf("expected ID %s, got %s", node.ID, nodes[0].ID)
	}

	// Update node
	node.LoadScore = 50
	if err := store.UpsertNode(ctx, node); err != nil {
		t.Fatalf("UpsertNode update failed: %v", err)
	}

	nodes, _ = store.ListNodes(ctx, "tenant-1")
	if nodes[0].LoadScore != 50 {
		t.Errorf("expected LoadScore 50, got %d", nodes[0].LoadScore)
	}
}

func TestJobLeaseAndComplete(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Enqueue job
	job := JobRecord{
		ID:             "job-lease-1",
		TenantID:       "tenant-1",
		SessionID:      "session-1",
		RunID:          "run-1",
		AgentID:        "agent-1",
		NodeID:         "node-1",
		Type:           "test-job",
		PayloadJSON:    `{}`,
		IdempotencyKey: "idem-lease-1",
		Priority:       10,
		Attempts:       0,
		MaxAttempts:    3,
		Status:         "queued",
		NextRunAt:      time.Now(),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := store.EnqueueJob(ctx, job); err != nil {
		t.Fatalf("EnqueueJob failed: %v", err)
	}

	// Lease ready jobs
	leaseToken := "lease-token-1"
	leased, err := store.LeaseReadyJobs(ctx, time.Now(), 10, leaseToken, time.Minute)
	if err != nil {
		t.Fatalf("LeaseReadyJobs failed: %v", err)
	}

	if len(leased) != 1 {
		t.Errorf("expected 1 leased job, got %d", len(leased))
	}

	if leased[0].Status != "leased" {
		t.Errorf("expected status 'leased', got %s", leased[0].Status)
	}

	// Complete job
	if err := store.CompleteJob(ctx, job.ID, leaseToken, `{"result":"success"}`, time.Now()); err != nil {
		t.Fatalf("CompleteJob failed: %v", err)
	}

	// Verify completed
	completed, err := store.GetJobByIdempotency(ctx, job.TenantID, job.IdempotencyKey)
	if err != nil {
		t.Fatalf("GetJobByIdempotency failed: %v", err)
	}

	if completed.Status != "completed" {
		t.Errorf("expected status 'completed', got %s", completed.Status)
	}
}

func TestJobFailAndRetry(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Enqueue job with limited retries
	job := JobRecord{
		ID:             "job-fail-1",
		TenantID:       "tenant-1",
		SessionID:      "session-1",
		RunID:          "run-1",
		AgentID:        "agent-1",
		NodeID:         "node-1",
		Type:           "test-job",
		PayloadJSON:    `{}`,
		IdempotencyKey: "idem-fail-1",
		Priority:       10,
		Attempts:       0,
		MaxAttempts:    2,
		Status:         "queued",
		NextRunAt:      time.Now(),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := store.EnqueueJob(ctx, job); err != nil {
		t.Fatalf("EnqueueJob failed: %v", err)
	}

	// Lease job
	leaseToken := "lease-token-fail"
	leased, _ := store.LeaseReadyJobs(ctx, time.Now(), 10, leaseToken, time.Minute)
	if len(leased) != 1 {
		t.Fatalf("expected 1 leased job")
	}

	// Fail job (not dead letter yet)
	retryAt := time.Now().Add(time.Minute)
	if err := store.FailJob(ctx, job.ID, leaseToken, "temporary error", retryAt, false); err != nil {
		t.Fatalf("FailJob failed: %v", err)
	}

	// Verify retry_wait status
	failed, _ := store.GetJobByIdempotency(ctx, job.TenantID, job.IdempotencyKey)
	if failed.Status != "retry_wait" {
		t.Errorf("expected status 'retry_wait', got %s", failed.Status)
	}
	if failed.Attempts != 1 {
		t.Errorf("expected Attempts 1, got %d", failed.Attempts)
	}

	// Lease again and fail with dead letter
	leased, _ = store.LeaseReadyJobs(ctx, retryAt.Add(time.Second), 10, leaseToken+"2", time.Minute)
	if len(leased) != 1 {
		t.Fatalf("expected 1 leased job on retry")
	}

	// Fail as dead letter
	if err := store.FailJob(ctx, job.ID, leaseToken+"2", "fatal error", retryAt, true); err != nil {
		t.Fatalf("FailJob (dead) failed: %v", err)
	}

	// Verify dead_letter status
	dead, _ := store.GetJobByIdempotency(ctx, job.TenantID, job.IdempotencyKey)
	if dead.Status != "dead_letter" {
		t.Errorf("expected status 'dead_letter', got %s", dead.Status)
	}
}

func TestMigrate(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}
	defer store.Close()

	// Migration should have run automatically during NewSQLiteStore
	// Verify schema exists by doing operations
	ctx := context.Background()
	runRec := RunRecord{
		ID:        "run-migrate",
		TenantID:  "tenant-1",
		Status:    "active",
		CreatedAt: time.Now(),
	}
	if err := store.CreateRun(ctx, runRec); err != nil {
		t.Fatalf("CreateRun after migrate failed: %v", err)
	}
}

func TestMigrateExistingDB(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "existing.db")

	// Create initial database
	store1, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore (first) failed: %v", err)
	}

	// Insert some data
	ctx := context.Background()
	store1.CreateRun(ctx, RunRecord{ID: "test", TenantID: "t", Status: "active", CreatedAt: time.Now()})
	store1.Close()

	// Reopen - should not fail on existing migrations
	store2, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore (second) failed: %v", err)
	}
	defer store2.Close()

	// Verify data still exists
	got, err := store2.GetRun(ctx, "t", "test")
	if err != nil {
		t.Fatalf("GetRun after reopen failed: %v", err)
	}
	if got.ID != "test" {
		t.Errorf("expected ID 'test', got %s", got.ID)
	}
}

func TestClose(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore failed: %v", err)
	}

	if err := store.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	// File should exist
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Error("expected database file to exist after close")
	}
}

func BenchmarkCreateRun(b *testing.B) {
	tmpDir := b.TempDir()
	dbPath := filepath.Join(tmpDir, "bench.db")

	store, _ := NewSQLiteStore(dbPath)
	defer store.Close()

	ctx := context.Background()
	rec := RunRecord{
		ID:        "run-bench",
		TenantID:  "tenant-1",
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec.ID = fmt.Sprintf("run-%d", i)
		store.CreateRun(ctx, rec)
	}
}

// Helper
