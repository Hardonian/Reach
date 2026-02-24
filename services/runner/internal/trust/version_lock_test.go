package trust

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestEventsSchemaHashLock(t *testing.T) {
	path := filepath.Join("..", "..", "..", "..", "protocol", "schemas", "events.schema.json")
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read schema: %v", err)
	}
	sum := sha256.Sum256(b)
	if hex.EncodeToString(sum[:]) != EventsSchemaHashLock {
		t.Fatalf("events schema changed; bump trust version constants and update lock hash")
	}
}
