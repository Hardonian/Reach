package trust

import "testing"

func TestCanonicalMemoryHashStableWhitespaceAndOrder(t *testing.T) {
	a := []byte(`{"items":[{"memory_id":"1","type":"prompt","content":"x","metadata":{"b":"2","a":"1"}}],"version":"1"}`)
	b := []byte(`{
	  "version":"1",
	  "items":[{"type":"prompt","memory_id":"1","metadata":{"a":"1","b":"2"},"content":"x"}]
	}`)
	_, ha, err := CanonicalMemoryHash(a)
	if err != nil {
		t.Fatal(err)
	}
	_, hb, err := CanonicalMemoryHash(b)
	if err != nil {
		t.Fatal(err)
	}
	if ha != hb {
		t.Fatalf("expected identical hashes, got %s != %s", ha, hb)
	}
}

func TestCanonicalMemoryHashOrderingChangesHash(t *testing.T) {
	a := []byte(`{"version":"1","items":[{"memory_id":"1","type":"prompt"},{"memory_id":"2","type":"summary"}]}`)
	b := []byte(`{"version":"1","items":[{"memory_id":"2","type":"summary"},{"memory_id":"1","type":"prompt"}]}`)
	_, ha, _ := CanonicalMemoryHash(a)
	_, hb, _ := CanonicalMemoryHash(b)
	if ha == hb {
		t.Fatal("expected different hashes when order changes")
	}
}
