package storage

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestSqliteDriver(t *testing.T) {
	// Use t.TempDir() for automatic cleanup
	tmpDir := t.TempDir()

	// Initialize driver
	driver, err := NewSqliteDriver(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create driver: %v", err)
	}
	defer driver.Close()

	ctx := context.Background()
	key := "test-blob-1"
	data := []byte("reach-deterministic-content")

	// 1. Test Write
	if err := driver.Write(ctx, key, data); err != nil {
		t.Fatalf("Write failed: %v", err)
	}

	// 2. Verify Blob Storage (Implementation Detail)
	// Ensure the blob was actually written to the filesystem
	blobPath := filepath.Join(tmpDir, "blobs", key)
	if _, err := os.Stat(blobPath); os.IsNotExist(err) {
		t.Errorf("Blob file not found at %s", blobPath)
	}

	// 3. Test Read
	readData, err := driver.Read(ctx, key)
	if err != nil {
		t.Fatalf("Read failed: %v", err)
	}
	if string(readData) != string(data) {
		t.Errorf("Read mismatch: got %s, want %s", string(readData), string(data))
	}

	// 4. Test List
	keys, err := driver.List(ctx, "")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(keys) != 1 || keys[0] != key {
		t.Errorf("List mismatch: got %v, want [%s]", keys, key)
	}

	// 5. Test Update
	newData := []byte("updated-content")
	if err := driver.Write(ctx, key, newData); err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	readData, err = driver.Read(ctx, key)
	if err != nil {
		t.Fatalf("Read after update failed: %v", err)
	}
	if string(readData) != string(newData) {
		t.Errorf("Read after update mismatch: got %s, want %s", string(readData), string(newData))
	}

	// 6. Test Non-Existent Read
	if _, err := driver.Read(ctx, "non-existent"); err != os.ErrNotExist {
		t.Errorf("Expected os.ErrNotExist, got %v", err)
	}
}

func TestSqliteDriverWriteRespectsCanceledContext(t *testing.T) {
	driver, err := NewSqliteDriver(t.TempDir())
	if err != nil {
		t.Fatalf("Failed to create driver: %v", err)
	}
	defer driver.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err = driver.Write(ctx, "cancelled-key", []byte("payload"))
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestSqliteDriverRecoversAfterInterruptedMetadataUpdate(t *testing.T) {
	tmpDir := t.TempDir()
	driver, err := NewSqliteDriver(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create driver: %v", err)
	}

	if err := driver.Write(context.Background(), "run-1", []byte("v1")); err != nil {
		t.Fatalf("initial write failed: %v", err)
	}

	if _, err := driver.db.Exec(`UPDATE artifacts SET path = '/tmp/does-not-exist' WHERE key = 'run-1'`); err != nil {
		t.Fatalf("failed to corrupt metadata in test: %v", err)
	}

	if _, err := driver.Read(context.Background(), "run-1"); err == nil {
		t.Fatalf("expected read error for corrupted metadata")
	}

	if err := driver.Write(context.Background(), "run-1", []byte("v2")); err != nil {
		t.Fatalf("rewrite failed after corruption: %v", err)
	}

	data, err := driver.Read(context.Background(), "run-1")
	if err != nil {
		t.Fatalf("read failed after recovery rewrite: %v", err)
	}
	if string(data) != "v2" {
		t.Fatalf("unexpected recovered data: %q", string(data))
	}

	if err := driver.Close(); err != nil {
		t.Fatalf("close failed: %v", err)
	}

	reopened, err := NewSqliteDriver(tmpDir)
	if err != nil {
		t.Fatalf("reopen failed: %v", err)
	}
	defer reopened.Close()

	data, err = reopened.Read(context.Background(), "run-1")
	if err != nil {
		t.Fatalf("reopened read failed: %v", err)
	}
	if string(data) != "v2" {
		t.Fatalf("unexpected reopened data: %q", string(data))
	}
}

func TestSqliteDriverListCanceledContext(t *testing.T) {
	driver, err := NewSqliteDriver(t.TempDir())
	if err != nil {
		t.Fatalf("Failed to create driver: %v", err)
	}
	defer driver.Close()

	for i := 0; i < 10; i++ {
		if err := driver.Write(context.Background(), "batch/item", []byte("v")); err != nil {
			t.Fatalf("write failed: %v", err)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err = driver.List(ctx, "batch/")
	if err == nil {
		t.Fatal("expected list cancellation error")
	}
	if !errors.Is(err, context.Canceled) && !errors.Is(err, sql.ErrConnDone) {
		t.Fatalf("expected context cancellation-style error, got %v", err)
	}
}
