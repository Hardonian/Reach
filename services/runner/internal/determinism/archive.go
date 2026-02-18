package determinism

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// FixedMTime is the fixed modification time used for deterministic archives.
// This is the Unix epoch (1970-01-01 00:00:00 UTC) for reproducibility.
var FixedMTime = time.Unix(0, 0).UTC()

// ArchiveOptions configures archive creation.
type ArchiveOptions struct {
	// Compression level for gzip (0-9, -1 for default)
	CompressionLevel int
	// FixedTime overrides the modification time (zero value uses FixedMTime)
	FixedTime time.Time
}

// DefaultArchiveOptions returns sensible defaults for deterministic archives.
func DefaultArchiveOptions() ArchiveOptions {
	return ArchiveOptions{
		CompressionLevel: -1, // Default
		FixedTime:        FixedMTime,
	}
}

// CreateTarGz creates a deterministic gzip-compressed tar archive.
// Files are added in sorted order with fixed modification times.
func CreateTarGz(w io.Writer, files map[string][]byte, opts ArchiveOptions) (string, error) {
	if opts.FixedTime.IsZero() {
		opts.FixedTime = FixedMTime
	}

	// Sort filenames for deterministic ordering
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sort.Strings(names)

	// Create hash for verification
	h := sha256.New()
	gw := gzip.NewWriter(io.MultiWriter(w, h))
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	for _, name := range names {
		data := files[name]

		hdr := &tar.Header{
			Name:     name,
			Size:     int64(len(data)),
			Mode:     0644,
			ModTime:  opts.FixedTime,
			AccessTime: opts.FixedTime,
			ChangeTime: opts.FixedTime,
			Typeflag: tar.TypeReg,
			Uid:      0,
			Gid:      0,
			Uname:    "",
			Gname:    "",
		}

		if err := tw.WriteHeader(hdr); err != nil {
			return "", fmt.Errorf("writing tar header for %s: %w", name, err)
		}

		// Write to both tar and hash
		if _, err := io.Copy(tw, io.TeeReader(bytes.NewReader(data), h)); err != nil {
			return "", fmt.Errorf("writing tar content for %s: %w", name, err)
		}
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

// CreateZip creates a deterministic zip archive.
// Files are added in sorted order with fixed modification times.
func CreateZip(w io.Writer, files map[string][]byte, opts ArchiveOptions) (string, error) {
	if opts.FixedTime.IsZero() {
		opts.FixedTime = FixedMTime
	}

	// Sort filenames for deterministic ordering
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sort.Strings(names)

	// Create a buffer to capture the archive for hashing
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	// Convert time to MS-DOS format for zip
	dosTime := zipTime(opts.FixedTime)

	for _, name := range names {
		data := files[name]

		hdr := &zip.FileHeader{
			Name:   name,
			Method: zip.Deflate,
			Modified: opts.FixedTime,
		}
		// Set MS-DOS time fields for compatibility
		hdr.ModifiedTime = dosTime.msTime
		hdr.ModifiedDate = dosTime.msDate

		// Ensure deterministic flags
		hdr.Flags = 0
		hdr.CreatorVersion = 0
		hdr.ReaderVersion = 20 // 2.0
		hdr.ExternalAttrs = 0644 << 16

		w, err := zw.CreateHeader(hdr)
		if err != nil {
			return "", fmt.Errorf("creating zip header for %s: %w", name, err)
		}

		if _, err := w.Write(data); err != nil {
			return "", fmt.Errorf("writing zip content for %s: %w", name, err)
		}
	}

	if err := zw.Close(); err != nil {
		return "", fmt.Errorf("closing zip writer: %w", err)
	}

	// Write to output and compute hash
	h := sha256.New()
	if _, err := io.Copy(io.MultiWriter(w, h), &buf); err != nil {
		return "", fmt.Errorf("writing zip output: %w", err)
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

// msDosTime converts a time.Time to MS-DOS date/time format.
type msDosTime struct {
	msDate uint16
	msTime uint16
}

func zipTime(t time.Time) msDosTime {
	t = t.UTC()
	return msDosTime{
		msDate: uint16(t.Day() + int(t.Month())<<5 + (t.Year()-1980)<<9),
		msTime: uint16(t.Second()/2 + t.Minute()<<5 + t.Hour()<<11),
	}
}

// HashFiles computes a deterministic hash of a set of files.
// Files are processed in sorted order.
func HashFiles(files map[string][]byte) string {
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sort.Strings(names)

	h := sha256.New()
	for _, name := range names {
		h.Write([]byte(name))
		h.Write([]byte{0})
		h.Write(files[name])
		h.Write([]byte{0})
	}

	return hex.EncodeToString(h.Sum(nil))
}

// ArchiveFromDir creates a deterministic archive from a directory.
func ArchiveFromDir(dir string, opts ArchiveOptions) (map[string][]byte, error) {
	files := make(map[string][]byte)

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}

		// Normalize path separators for cross-platform consistency
		relPath = filepath.ToSlash(relPath)

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading %s: %w", path, err)
		}

		files[relPath] = data
		return nil
	})

	if err != nil {
		return nil, err
	}

	return files, nil
}

// VerifyArchive verifies that an archive matches an expected hash.
func VerifyArchive(r io.Reader, expectedHash string) (bool, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return false, err
	}

	actualHash := hex.EncodeToString(h.Sum(nil))
	return actualHash == expectedHash, nil
}

// HashWriter wraps a writer and computes a hash.
type HashWriter struct {
	w   io.Writer
	h   hash.Hash
}

// NewHashWriter creates a new HashWriter.
func NewHashWriter(w io.Writer) *HashWriter {
	return &HashWriter{
		w: w,
		h: sha256.New(),
	}
}

// Write implements io.Writer.
func (hw *HashWriter) Write(p []byte) (n int, err error) {
	hw.h.Write(p)
	return hw.w.Write(p)
}

// Sum returns the hex-encoded hash.
func (hw *HashWriter) Sum() string {
	return hex.EncodeToString(hw.h.Sum(nil))
}

// DeterministicFileInfo returns deterministic file info for archive entries.
func DeterministicFileInfo(name string, size int64, mode os.FileMode) os.FileInfo {
	return &deterministicFileInfo{
		name:    name,
		size:    size,
		mode:    mode,
		modTime: FixedMTime,
	}
}

type deterministicFileInfo struct {
	name    string
	size    int64
	mode    os.FileMode
	modTime time.Time
}

func (fi *deterministicFileInfo) Name() string       { return fi.name }
func (fi *deterministicFileInfo) Size() int64        { return fi.size }
func (fi *deterministicFileInfo) Mode() os.FileMode  { return fi.mode }
func (fi *deterministicFileInfo) ModTime() time.Time { return fi.modTime }
func (fi *deterministicFileInfo) IsDir() bool        { return fi.mode.IsDir() }
func (fi *deterministicFileInfo) Sys() interface{}   { return nil }
