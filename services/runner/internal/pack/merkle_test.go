package pack

import (
	"encoding/hex"
	"testing"
)

func TestNewMerkleTree(t *testing.T) {
	// Test with valid data
	data := [][]byte{
		[]byte("leaf1"),
		[]byte("leaf2"),
		[]byte("leaf3"),
		[]byte("leaf4"),
	}

	mt, err := NewMerkleTree(data)
	if err != nil {
		t.Fatalf("failed to create Merkle tree: %v", err)
	}

	if mt.Root == nil {
		t.Error("expected non-nil root")
	}

	if len(mt.RootHash()) == 0 {
		t.Error("expected non-empty root hash")
	}

	if len(mt.Leaves) != 4 {
		t.Errorf("expected 4 leaves, got %d", len(mt.Leaves))
	}

	// Test with empty data
	_, err = NewMerkleTree([][]byte{})
	if err == nil {
		t.Error("expected error for empty data")
	}
}

func TestNewMerkleTreeFromHashes(t *testing.T) {
	hashes := [][]byte{
		makeHash("hash1"),
		makeHash("hash2"),
		makeHash("hash3"),
	}

	mt, err := NewMerkleTreeFromHashes(hashes)
	if err != nil {
		t.Fatalf("failed to create tree from hashes: %v", err)
	}

	if len(mt.Leaves) != 3 {
		t.Errorf("expected 3 leaves, got %d", len(mt.Leaves))
	}

	// Verify leaf hashes are copied
	for i, leaf := range mt.Leaves {
		if hex.EncodeToString(leaf.Hash) != hex.EncodeToString(hashes[i]) {
			t.Errorf("leaf %d hash mismatch", i)
		}
	}
}

func TestMerkleTree_OddNumberOfLeaves(t *testing.T) {
	// Test with odd number of leaves (3)
	data := [][]byte{
		[]byte("leaf1"),
		[]byte("leaf2"),
		[]byte("leaf3"),
	}

	mt, err := NewMerkleTree(data)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}

	if len(mt.Leaves) != 3 {
		t.Errorf("expected 3 leaves, got %d", len(mt.Leaves))
	}

	// Tree should still have a valid root
	if mt.Root == nil {
		t.Error("expected non-nil root for odd leaf count")
	}
}

func TestMerkleTree_SingleLeaf(t *testing.T) {
	data := [][]byte{[]byte("single")}

	mt, err := NewMerkleTree(data)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}

	if len(mt.Leaves) != 1 {
		t.Errorf("expected 1 leaf, got %d", len(mt.Leaves))
	}

	// Root should be the leaf itself
	if mt.Root != mt.Leaves[0] {
		t.Error("expected root to be the single leaf")
	}
}

func TestMerkleProof(t *testing.T) {
	data := [][]byte{
		[]byte("leaf0"),
		[]byte("leaf1"),
		[]byte("leaf2"),
		[]byte("leaf3"),
	}

	mt, err := NewMerkleTree(data)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}

	// Get proof for each leaf
	for i := range data {
		proof, err := mt.GetProof(i)
		if err != nil {
			t.Fatalf("failed to get proof for leaf %d: %v", i, err)
		}

		if proof.Index != i {
			t.Errorf("proof index mismatch: expected %d, got %d", i, proof.Index)
		}

		// Verify proof
		if !VerifyProof(proof, mt.RootHash()) {
			t.Errorf("proof verification failed for leaf %d", i)
		}

		// Verify with hex
		if !VerifyProofHex(proof, mt.RootHashHex()) {
			t.Errorf("proof hex verification failed for leaf %d", i)
		}
	}
}

func TestMerkleProof_OutOfRange(t *testing.T) {
	data := [][]byte{
		[]byte("leaf1"),
		[]byte("leaf2"),
	}

	mt, _ := NewMerkleTree(data)

	_, err := mt.GetProof(-1)
	if err == nil {
		t.Error("expected error for negative index")
	}

	_, err = mt.GetProof(2)
	if err == nil {
		t.Error("expected error for out of range index")
	}

	_, err = mt.GetProof(10)
	if err == nil {
		t.Error("expected error for out of range index")
	}
}

func TestVerifyProof_Invalid(t *testing.T) {
	data := [][]byte{
		[]byte("leaf1"),
		[]byte("leaf2"),
		[]byte("leaf3"),
		[]byte("leaf4"),
	}

	mt, _ := NewMerkleTree(data)
	proof, _ := mt.GetProof(0)

	// Tamper with the proof
	proof.LeafHash = makeHash("tampered")

	if VerifyProof(proof, mt.RootHash()) {
		t.Error("expected verification to fail with tampered proof")
	}
}

func TestContentAddressedStore(t *testing.T) {
	store := NewContentAddressedStore()

	// Test store and retrieve
	data := []byte("test data")
	addr := store.Store(data)

	if addr == "" {
		t.Error("expected non-empty address")
	}

	retrieved, ok := store.Retrieve(addr)
	if !ok {
		t.Error("expected to retrieve data")
	}

	if string(retrieved) != string(data) {
		t.Error("retrieved data mismatch")
	}

	// Test retrieve non-existent
	_, ok = store.Retrieve("nonexistent")
	if ok {
		t.Error("expected false for non-existent address")
	}
}

func TestContentAddressedStore_StoreBatch(t *testing.T) {
	store := NewContentAddressedStore()

	items := [][]byte{
		[]byte("item1"),
		[]byte("item2"),
		[]byte("item3"),
	}

	root, err := store.StoreBatch(items)
	if err != nil {
		t.Fatalf("failed to store batch: %v", err)
	}

	if root == "" {
		t.Error("expected non-empty root")
	}

	// Verify each item can be retrieved
	for _, item := range items {
		addr := store.Store(item)
		_, ok := store.Retrieve(addr)
		if !ok {
			t.Error("expected to retrieve batch item")
		}
	}
}

func TestComputePackIntegrity(t *testing.T) {
	manifest := &PackManifest{
		Metadata: Metadata{
			ID:          "test-pack",
			Version:     "1.0.0",
			Name:        "Test Pack",
			Description: "A test pack",
		},
		SpecVersion:         "1.0",
		DeclaredTools:       []string{"tool1", "tool2"},
		DeclaredPermissions: []string{"perm1"},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{{ID: "n1", Type: "Action"}},
			Edges: []Edge{},
		},
		Deterministic: true,
	}

	graphData := []byte(`{"nodes":[{"id":"n1","type":"Action"}]}`)

	integrity, err := ComputePackIntegrity(manifest, graphData)
	if err != nil {
		t.Fatalf("failed to compute integrity: %v", err)
	}

	if integrity.PackID != "test-pack" {
		t.Errorf("expected PackID 'test-pack', got %s", integrity.PackID)
	}

	if integrity.MerkleRoot == "" {
		t.Error("expected non-empty MerkleRoot")
	}

	if integrity.Tree == nil {
		t.Error("expected non-nil Tree")
	}
}

func TestMerkleTree_Consistency(t *testing.T) {
	// Same data should produce same root
	data1 := [][]byte{[]byte("a"), []byte("b"), []byte("c")}
	data2 := [][]byte{[]byte("a"), []byte("b"), []byte("c")}

	mt1, _ := NewMerkleTree(data1)
	mt2, _ := NewMerkleTree(data2)

	if mt1.RootHashHex() != mt2.RootHashHex() {
		t.Error("same data should produce same root hash")
	}

	// Different data should produce different root
	data3 := [][]byte{[]byte("a"), []byte("b"), []byte("d")}
	mt3, _ := NewMerkleTree(data3)

	if mt1.RootHashHex() == mt3.RootHashHex() {
		t.Error("different data should produce different root hash")
	}
}

func TestMerkleProofJSON(t *testing.T) {
	data := [][]byte{
		[]byte("leaf1"),
		[]byte("leaf2"),
	}

	mt, _ := NewMerkleTree(data)
	proof, _ := mt.GetProof(0)

	jsonProof := proof.ToJSON()

	if jsonProof.Index != 0 {
		t.Errorf("expected index 0, got %d", jsonProof.Index)
	}

	if jsonProof.LeafHash == "" {
		t.Error("expected non-empty LeafHash")
	}

	if len(jsonProof.ProofPath) == 0 {
		t.Error("expected non-empty ProofPath")
	}
}

func TestMerkleTreeJSON(t *testing.T) {
	data := [][]byte{
		[]byte("leaf1"),
		[]byte("leaf2"),
	}

	mt, _ := NewMerkleTree(data)

	// Without leaves
	json := mt.ToJSON(false)
	if json.RootHash == "" {
		t.Error("expected non-empty RootHash")
	}
	if json.LeafCount != 2 {
		t.Errorf("expected LeafCount 2, got %d", json.LeafCount)
	}
	if len(json.LeafHashes) != 0 {
		t.Error("expected no LeafHashes when includeLeaves=false")
	}

	// With leaves
	json = mt.ToJSON(true)
	if len(json.LeafHashes) != 2 {
		t.Errorf("expected 2 LeafHashes, got %d", len(json.LeafHashes))
	}
}

// Helper function to create a simple hash
func makeHash(s string) []byte {
	h := make([]byte, 32)
	copy(h, []byte(s))
	return h
}

func BenchmarkMerkleTreeCreation(b *testing.B) {
	// Create test data
	data := make([][]byte, 1000)
	for i := 0; i < 1000; i++ {
		data[i] = []byte(string(rune('a' + i%26)))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := NewMerkleTree(data)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkMerkleProofGeneration(b *testing.B) {
	data := make([][]byte, 1000)
	for i := 0; i < 1000; i++ {
		data[i] = []byte(string(rune('a' + i%26)))
	}

	mt, _ := NewMerkleTree(data)
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := mt.GetProof(i % 1000)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkMerkleProofVerification(b *testing.B) {
	data := make([][]byte, 1000)
	for i := 0; i < 1000; i++ {
		data[i] = []byte(string(rune('a' + i%26)))
	}

	mt, _ := NewMerkleTree(data)
	proof, _ := mt.GetProof(0)
	root := mt.RootHash()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if !VerifyProof(proof, root) {
			b.Fatal("verification failed")
		}
	}
}
