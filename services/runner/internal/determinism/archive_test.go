package determinism

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestCreateTarGz(t *testing.T) {
	files := map[string][]byte{
		"file1.txt": []byte("content1"),
		"file2.txt": []byte("content2"),
		"dir/file3.txt": []byte("content3"),
	}

	var buf bytes.Buffer
	hash1, err := CreateTarGz(&buf, files, DefaultArchiveOptions())
	if err != nil {
		t.Fatalf("CreateTarGz failed: %v", err)
	}

	if hash1 == "" {
		t.Error("expected non-empty hash")
	}

	// Create again - should produce same hash (deterministic)
	var buf2 bytes.Buffer
	hash2, err := CreateTarGz(&buf2, files, DefaultArchiveOptions())
	if err != nil {
		t.Fatalf("CreateTarGz failed: %v", err)
	}

	if hash1 != hash2 {
		t.Errorf("hashes should be deterministic: %s vs %s", hash1, hash2)
	}

	// Different order should produce same hash
	files2 := map[string][]byte{
		"dir/file3.txt": []byte("content3"),
		"file1.txt":     []byte("content1"),
		"file2.txt":     []byte("content2"),
	}

	var buf3 bytes.Buffer
	hash3, err := CreateTarGz(&buf3, files2, DefaultArchiveOptions())
	if err != nil {
		t.Fatalf("CreateTarGz failed: %v", err)
	}

	if hash1 != hash3 {
		t.Errorf("hashes should be independent of file order: %s vs %s", hash1, hash3)
	}
}

func TestCreateZip(t *testing.T) {
	files := map[string][]byte{
		"file1.txt":     []byte("content1"),
		"file2.txt":     []byte("content2"),
		"dir/file3.txt": []byte("content3"),
	}

	var buf bytes.Buffer
	hash1, err := CreateZip(&buf, files, DefaultArchiveOptions())
	if err != nil {
		t.Fatalf("CreateZip failed: %v", err)
	}

	if hash1 == "" {
		t.Error("expected non-empty hash")
	}

	// Create again - should produce same hash (deterministic)
	var buf2 bytes.Buffer
	hash2, err := CreateZip(&buf2, files, DefaultArchiveOptions())
	if err != nil {
		t.Fatalf("CreateZip failed: %v", err)
	}

	if hash1 != hash2 {
		t.Errorf("hashes should be deterministic: %s vs %s", hash1, hash2)
	}
}

func TestHashFiles(t *testing.T) {
	files := map[string][]byte{
		"file1.txt": []byte("content1"),
		"file2.txt": []byte("content2"),
	}

	hash1 := HashFiles(files)

	// Same files, different order
	files2 := map[string][]byte{
		"file2.txt": []byte("content2"),
		"file1.txt": []byte("content1"),
	}

	hash2 := HashFiles(files2)

	if hash1 != hash2 {
		t.Errorf("hashes should be independent of file order: %s vs %s", hash1, hash2)
	}

	// Different content
	files3 := map[string][]byte{
		"file1.txt": []byte("different"),
		"file2.txt": []byte("content2"),
	}

	hash3 := HashFiles(files3)

	if hash1 == hash3 {
		t.Error("hashes should differ for different content")
	}
}

func TestArchiveFromDir(t *testing.T) {
	tmpDir := t.TempDir()

	// Create test files
	if err := os.WriteFile(filepath.Join(tmpDir, "file1.txt"), []byte("content1"), 0644); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	subDir := filepath.Join(tmpDir, "subdir")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("failed to create subdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(subDir, "file2.txt"), []byte("content2"), 0644); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	files, err := ArchiveFromDir(tmpDir, DefaultArchiveOptions())
	if err != nil {
		t.Fatalf("ArchiveFromDir failed: %v", err)
	}

	if len(files) != 2 {
		t.Errorf("expected 2 files, got: %d", len(files))
	}

	if string(files["file1.txt"]) != "content1" {
		t.Error("file1.txt content mismatch")
	}

	if string(files["subdir/file2.txt"]) != "content2" {
		t.Error("subdir/file2.txt content mismatch")
	}
}

func TestVerifyArchive(t *testing.T) {
	files := map[string][]byte{
		"file1.txt": []byte("content1"),
	}

	var buf bytes.Buffer
	_, err := CreateTarGz(&buf, files, DefaultArchiveOptions())
	if err != nil {
		t.Fatalf("CreateTarGz failed: %v", err)
	}

	// Save the archive data
	archiveData := buf.Bytes()

	// Verify with correct hash - compute hash of the archive data
	h := sha256.New()
	h.Write(archiveData)
	expectedHash := hex.EncodeToString(h.Sum(nil))

	valid, err := VerifyArchive(bytes.NewReader(archiveData), expectedHash)
	if err != nil {
		t.Fatalf("VerifyArchive failed: %v", err)
	}
	if !valid {
		t.Error("archive should be valid")
	}

	// Verify with wrong hash
	valid, err = VerifyArchive(bytes.NewReader(archiveData), "wronghash")
	if err != nil {
		t.Fatalf("VerifyArchive failed: %v", err)
	}
	if valid {
		t.Error("archive should be invalid with wrong hash")
	}
}

func TestHashWriter(t *testing.T) {
	var buf bytes.Buffer
	hw := NewHashWriter(&buf)

	data := []byte("hello world")
	n, err := hw.Write(data)
	if err != nil {
		t.Fatalf("Write failed: %v", err)
	}
	if n != len(data) {
		t.Errorf("expected %d bytes written, got: %d", len(data), n)
	}

	hash := hw.Sum()
	if hash == "" {
		t.Error("expected non-empty hash")
	}

	// Verify content was written
	if buf.String() != "hello world" {
		t.Error("content mismatch")
	}
}

func TestDeterministicFileInfo(t *testing.T) {
	fi := DeterministicFileInfo("test.txt", 100, 0644)

	if fi.Name() != "test.txt" {
		t.Errorf("expected name=test.txt, got: %s", fi.Name())
	}
	if fi.Size() != 100 {
		t.Errorf("expected size=100, got: %d", fi.Size())
	}
	if fi.Mode() != 0644 {
		t.Errorf("expected mode=0644, got: %o", fi.Mode())
	}
	if fi.ModTime() != FixedMTime {
		t.Error("expected fixed modification time")
	}
	if fi.IsDir() {
		t.Error("expected not a directory")
	}
}

func TestZipTime(t *testing.T) {
	tm := FixedMTime
	zt := zipTime(tm)

	// Just verify it doesn't panic and returns something
	if zt.msDate == 0 && zt.msTime == 0 {
		t.Error("expected non-zero zip time")
	}
}
