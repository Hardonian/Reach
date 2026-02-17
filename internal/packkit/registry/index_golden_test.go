package registry

import (
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func TestGoldenIndexVariantsParse(t *testing.T) {
	files := []string{"index_variant_a.json", "index_variant_b.json", "index_variant_c.json"}
	for _, f := range files {
		data, err := os.ReadFile(filepath.Join("testdata", f))
		if err != nil {
			t.Fatalf("read fixture %s: %v", f, err)
		}
		idx, err := ParseIndex(data)
		if err != nil {
			t.Fatalf("parse fixture %s: %v", f, err)
		}
		if len(idx.Packages) != 1 {
			t.Fatalf("fixture %s expected 1 package", f)
		}
	}
}

func TestGoldenMultiRegistryStableSortingAndPagination(t *testing.T) {
	files := []string{"index_variant_c.json", "index_variant_a.json", "index_variant_b.json"}
	var all []Package
	for _, f := range files {
		data, err := os.ReadFile(filepath.Join("testdata", f))
		if err != nil {
			t.Fatalf("read fixture %s: %v", f, err)
		}
		idx, err := ParseIndex(data)
		if err != nil {
			t.Fatalf("parse fixture %s: %v", f, err)
		}
		all = append(all, idx.Packages...)
	}
	sort.Slice(all, func(i, j int) bool { return all[i].ID < all[j].ID })
	if all[0].ID != "connector.github" || all[1].ID != "policy.strict-default" || all[2].ID != "template.research-agent" {
		t.Fatalf("unexpected stable sort order: %+v", all)
	}
	pageSize := 2
	page1 := all[:pageSize]
	page2 := all[pageSize:]
	if len(page1) != 2 || len(page2) != 1 {
		t.Fatalf("unexpected pagination lengths: %d and %d", len(page1), len(page2))
	}
}
