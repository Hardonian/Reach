package storage

import (
	"context"
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
