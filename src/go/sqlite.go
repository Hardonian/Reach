package storage

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// StorageDriver defines the interface for blob and metadata storage.
type StorageDriver interface {
	Write(ctx context.Context, key string, data []byte) error
	Read(ctx context.Context, key string) ([]byte, error)
	List(ctx context.Context, prefix string) ([]string, error)
	Close() error
}

// SqliteDriver implements StorageDriver using SQLite for metadata and filesystem for blobs.
type SqliteDriver struct {
	db       *sql.DB
	blobRoot string
}

// NewSqliteDriver creates a new driver instance.
func NewSqliteDriver(dataRoot string) (*SqliteDriver, error) {
	if err := os.MkdirAll(dataRoot, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data root: %w", err)
	}

	blobRoot := filepath.Join(dataRoot, "blobs")
	if err := os.MkdirAll(blobRoot, 0755); err != nil {
		return nil, fmt.Errorf("failed to create blob root: %w", err)
	}

	dbPath := filepath.Join(dataRoot, "reach.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for better concurrency
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}

	s := &SqliteDriver{
		db:       db,
		blobRoot: blobRoot,
	}

	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

func (s *SqliteDriver) initSchema() error {
	query := `
	CREATE TABLE IF NOT EXISTS artifacts (
		key TEXT PRIMARY KEY,
		path TEXT NOT NULL,
		size INTEGER NOT NULL,
		created_at DATETIME NOT NULL,
		content_hash TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_artifacts_key ON artifacts(key);
	`
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to init schema: %w", err)
	}
	return nil
}

func (s *SqliteDriver) Write(ctx context.Context, key string, data []byte) error {
	cleanKey := filepath.Clean(key)
	if strings.Contains(cleanKey, "..") || strings.HasPrefix(cleanKey, "/") || strings.HasPrefix(cleanKey, "\\") {
		return fmt.Errorf("invalid key: %s", key)
	}

	fullPath := filepath.Join(s.blobRoot, cleanKey)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return fmt.Errorf("failed to create blob directory: %w", err)
	}

	if err := os.WriteFile(fullPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write blob: %w", err)
	}

	query := `
	INSERT INTO artifacts (key, path, size, created_at)
	VALUES (?, ?, ?, ?)
	ON CONFLICT(key) DO UPDATE SET
		path = excluded.path,
		size = excluded.size,
		created_at = excluded.created_at;
	`
	_, err := s.db.ExecContext(ctx, query, key, fullPath, len(data), time.Now())
	if err != nil {
		return fmt.Errorf("failed to update metadata: %w", err)
	}

	return nil
}

func (s *SqliteDriver) Read(ctx context.Context, key string) ([]byte, error) {
	var path string
	query := `SELECT path FROM artifacts WHERE key = ?`
	err := s.db.QueryRowContext(ctx, query, key).Scan(&path)
	if err == sql.ErrNoRows {
		return nil, os.ErrNotExist
	}
	if err != nil {
		return nil, fmt.Errorf("metadata query failed: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read blob: %w", err)
	}
	return data, nil
}

func (s *SqliteDriver) List(ctx context.Context, prefix string) ([]string, error) {
	query := `SELECT key FROM artifacts WHERE key LIKE ? ORDER BY key ASC`
	rows, err := s.db.QueryContext(ctx, query, prefix+"%")
	if err != nil {
		return nil, fmt.Errorf("list query failed: %w", err)
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, nil
}

func (s *SqliteDriver) Close() error {
	return s.db.Close()
}
