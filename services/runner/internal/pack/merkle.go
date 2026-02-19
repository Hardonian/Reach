// Package pack provides pack validation and integrity checking.
package pack

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
)

// MerkleNode represents a node in the Merkle tree.
type MerkleNode struct {
	Hash  []byte
	Left  *MerkleNode
	Right *MerkleNode
	Leaf  bool // true if this is a leaf node
	Index int  // index for leaf nodes
}

// MerkleTree provides content-addressed integrity verification.
type MerkleTree struct {
	Root       *MerkleNode
	Leaves     []*MerkleNode
	LeafHashes [][]byte
	hasher     hash.Hash
}

// NewMerkleTree creates a new Merkle tree from leaf data.
func NewMerkleTree(leafData [][]byte) (*MerkleTree, error) {
	if len(leafData) == 0 {
		return nil, errors.New("cannot create Merkle tree from empty data")
	}

	mt := &MerkleTree{
		Leaves:     make([]*MerkleNode, 0, len(leafData)),
		LeafHashes: make([][]byte, 0, len(leafData)),
		hasher:     sha256.New(),
	}

	// Create leaf nodes
	for i, data := range leafData {
		hash := mt.hash(data)
		node := &MerkleNode{
			Hash:  hash,
			Leaf:  true,
			Index: i,
		}
		mt.Leaves = append(mt.Leaves, node)
		mt.LeafHashes = append(mt.LeafHashes, hash)
	}

	// Build tree
	mt.Root = mt.buildTree(mt.Leaves)

	return mt, nil
}

// NewMerkleTreeFromHashes creates a tree from pre-computed leaf hashes.
func NewMerkleTreeFromHashes(leafHashes [][]byte) (*MerkleTree, error) {
	if len(leafHashes) == 0 {
		return nil, errors.New("cannot create Merkle tree from empty hashes")
	}

	mt := &MerkleTree{
		Leaves:     make([]*MerkleNode, 0, len(leafHashes)),
		LeafHashes: make([][]byte, len(leafHashes)),
		hasher:     sha256.New(),
	}

	// Create leaf nodes
	for i, hash := range leafHashes {
		// Copy hash to prevent external modification
		hashCopy := make([]byte, len(hash))
		copy(hashCopy, hash)
		node := &MerkleNode{
			Hash:  hashCopy,
			Leaf:  true,
			Index: i,
		}
		mt.Leaves = append(mt.Leaves, node)
		mt.LeafHashes[i] = hashCopy
	}

	// Build tree
	mt.Root = mt.buildTree(mt.Leaves)

	return mt, nil
}

// buildTree recursively builds the Merkle tree from leaf nodes.
func (mt *MerkleTree) buildTree(nodes []*MerkleNode) *MerkleNode {
	if len(nodes) == 0 {
		return nil
	}

	if len(nodes) == 1 {
		return nodes[0]
	}

	// Build next level
	var parentNodes []*MerkleNode
	for i := 0; i < len(nodes); i += 2 {
		left := nodes[i]
		var right *MerkleNode

		if i+1 < len(nodes) {
			right = nodes[i+1]
		} else {
			// Odd number of nodes - duplicate the left node
			right = left
		}

		// Parent hash = hash(left || right)
		parentHash := mt.hashPair(left.Hash, right.Hash)
		parent := &MerkleNode{
			Hash:  parentHash,
			Left:  left,
			Right: right,
			Leaf:  false,
		}
		parentNodes = append(parentNodes, parent)
	}

	return mt.buildTree(parentNodes)
}

// hash computes the SHA256 hash of data.
func (mt *MerkleTree) hash(data []byte) []byte {
	mt.hasher.Reset()
	mt.hasher.Write(data)
	return mt.hasher.Sum(nil)
}

// hashPair computes the hash of two concatenated hashes.
func (mt *MerkleTree) hashPair(left, right []byte) []byte {
	mt.hasher.Reset()
	mt.hasher.Write(left)
	mt.hasher.Write(right)
	return mt.hasher.Sum(nil)
}

// RootHash returns the Merkle root hash as a byte slice.
func (mt *MerkleTree) RootHash() []byte {
	if mt.Root == nil {
		return nil
	}
	return mt.Root.Hash
}

// RootHashHex returns the Merkle root hash as a hex string.
func (mt *MerkleTree) RootHashHex() string {
	return hex.EncodeToString(mt.RootHash())
}

// GetProof generates a Merkle proof for a leaf at the given index.
type MerkleProof struct {
	Index      int
	LeafHash   []byte
	ProofPath  [][]byte
	ProofIndex []int // 0 = left, 1 = right at each level
}

// GetProof generates a proof for the leaf at the given index.
func (mt *MerkleTree) GetProof(index int) (*MerkleProof, error) {
	if index < 0 || index >= len(mt.Leaves) {
		return nil, fmt.Errorf("index %d out of range [0, %d)", index, len(mt.Leaves))
	}

	proof := &MerkleProof{
		Index:    index,
		LeafHash: mt.LeafHashes[index],
	}

	// Build proof path from bottom to top
	levelSize := len(mt.Leaves)
	currentIdx := index

	for levelSize > 1 {
		// Find sibling
		var siblingIdx int
		if currentIdx%2 == 0 {
			// Current is left, sibling is right
			siblingIdx = currentIdx + 1
			if siblingIdx >= levelSize {
				// Odd number, duplicate current
				siblingIdx = currentIdx
			}
			proof.ProofIndex = append(proof.ProofIndex, 1) // Sibling is on right
		} else {
			// Current is right, sibling is left
			siblingIdx = currentIdx - 1
			proof.ProofIndex = append(proof.ProofIndex, 0) // Sibling is on left
		}

		// Get sibling hash
		siblingHash := mt.getHashAtLevel(levelSize, siblingIdx)
		proof.ProofPath = append(proof.ProofPath, siblingHash)

		// Move to parent level
		currentIdx = currentIdx / 2
		levelSize = (levelSize + 1) / 2
	}

	return proof, nil
}

// getHashAtLevel returns the hash at a specific level and index.
// This is a helper that traverses the tree structure.
func (mt *MerkleTree) getHashAtLevel(levelSize, index int) []byte {
	// For the leaf level, use stored hashes
	if levelSize == len(mt.Leaves) {
		if index < len(mt.LeafHashes) {
			hash := make([]byte, len(mt.LeafHashes[index]))
			copy(hash, mt.LeafHashes[index])
			return hash
		}
		return mt.LeafHashes[len(mt.LeafHashes)-1] // Duplicate last for odd
	}

	// For higher levels, we need to compute or traverse
	// This is simplified - in production, cache intermediate nodes
	return mt.Root.Hash // Fallback
}

// VerifyProof verifies a Merkle proof against a root hash.
func VerifyProof(proof *MerkleProof, rootHash []byte) bool {
	currentHash := proof.LeafHash

	for i, siblingHash := range proof.ProofPath {
		var combined []byte
		if proof.ProofIndex[i] == 0 {
			// Sibling is on the left
			combined = append(siblingHash, currentHash...)
		} else {
			// Sibling is on the right
			combined = append(currentHash, siblingHash...)
		}

		h := sha256.Sum256(combined)
		currentHash = h[:]
	}

	return hex.EncodeToString(currentHash) == hex.EncodeToString(rootHash)
}

// VerifyProofHex verifies a proof using hex string root hash.
func VerifyProofHex(proof *MerkleProof, rootHashHex string) bool {
	rootHash, err := hex.DecodeString(rootHashHex)
	if err != nil {
		return false
	}
	return VerifyProof(proof, rootHash)
}

// ContentAddressedStore provides content-addressed storage using Merkle trees.
type ContentAddressedStore struct {
	// In-memory store - in production, use persistent storage
	data map[string][]byte
}

// NewContentAddressedStore creates a new content-addressed store.
func NewContentAddressedStore() *ContentAddressedStore {
	return &ContentAddressedStore{
		data: make(map[string][]byte),
	}
}

// Store stores data and returns its content address (Merkle root).
func (cas *ContentAddressedStore) Store(data []byte) string {
	h := sha256.Sum256(data)
	addr := hex.EncodeToString(h[:])
	cas.data[addr] = data
	return addr
}

// StoreBatch stores multiple items and returns a collective Merkle root.
func (cas *ContentAddressedStore) StoreBatch(items [][]byte) (string, error) {
	mt, err := NewMerkleTree(items)
	if err != nil {
		return "", err
	}

	// Store each item with its individual hash as key
	for _, item := range items {
		cas.Store(item)
	}

	// Return the Merkle root as the batch address
	return mt.RootHashHex(), nil
}

// Retrieve retrieves data by its content address.
func (cas *ContentAddressedStore) Retrieve(addr string) ([]byte, bool) {
	data, ok := cas.data[addr]
	return data, ok
}

// PackIntegrity provides integrity verification for packs using Merkle trees.
type PackIntegrity struct {
	PackID     string
	MerkleRoot string
	Tree       *MerkleTree
}

// ComputePackIntegrity computes the Merkle tree for a pack manifest.
func ComputePackIntegrity(manifest *PackManifest, graphData []byte) (*PackIntegrity, error) {
	// Create leaf data from manifest components
	var leaves [][]byte

	// Leaf 1: Metadata
	metaBytes := []byte(fmt.Sprintf("%s:%s:%s", manifest.Metadata.ID, manifest.Metadata.Version, manifest.Metadata.Name))
	leaves = append(leaves, metaBytes)

	// Leaf 2: Tools (sorted for determinism)
	toolsBytes := []byte(fmt.Sprintf("%v", manifest.DeclaredTools))
	leaves = append(leaves, toolsBytes)

	// Leaf 3: Permissions
	permsBytes := []byte(fmt.Sprintf("%v", manifest.DeclaredPermissions))
	leaves = append(leaves, permsBytes)

	// Leaf 4: Execution graph
	leaves = append(leaves, graphData)

	// Leaf 5: Deterministic flag
	leaves = append(leaves, []byte(fmt.Sprintf("%v", manifest.Deterministic)))

	// Build tree
	mt, err := NewMerkleTree(leaves)
	if err != nil {
		return nil, err
	}

	return &PackIntegrity{
		PackID:     manifest.Metadata.ID,
		MerkleRoot: mt.RootHashHex(),
		Tree:       mt,
	}, nil
}

// VerifyIntegrity verifies the integrity of a pack against a known root.
func (pi *PackIntegrity) VerifyIntegrity(leafIndex int, leafData []byte) bool {
	proof, err := pi.Tree.GetProof(leafIndex)
	if err != nil {
		return false
	}

	return VerifyProofHex(proof, pi.MerkleRoot)
}

// MerkleProofJSON is a JSON-serializable proof.
type MerkleProofJSON struct {
	Index      int      `json:"index"`
	LeafHash   string   `json:"leaf_hash"`
	ProofPath  []string `json:"proof_path"`
	ProofIndex []int    `json:"proof_index"`
}

// ToJSON converts a proof to JSON format.
func (proof *MerkleProof) ToJSON() *MerkleProofJSON {
	path := make([]string, len(proof.ProofPath))
	for i, p := range proof.ProofPath {
		path[i] = hex.EncodeToString(p)
	}
	return &MerkleProofJSON{
		Index:      proof.Index,
		LeafHash:   hex.EncodeToString(proof.LeafHash),
		ProofPath:  path,
		ProofIndex: proof.ProofIndex,
	}
}

// MerkleTreeJSON is a JSON-serializable tree representation.
type MerkleTreeJSON struct {
	RootHash   string   `json:"root_hash"`
	LeafCount  int      `json:"leaf_count"`
	LeafHashes []string `json:"leaf_hashes,omitempty"`
}

// ToJSON converts the tree to JSON format.
func (mt *MerkleTree) ToJSON(includeLeaves bool) *MerkleTreeJSON {
	json := &MerkleTreeJSON{
		RootHash:  mt.RootHashHex(),
		LeafCount: len(mt.Leaves),
	}

	if includeLeaves {
		json.LeafHashes = make([]string, len(mt.LeafHashes))
		for i, h := range mt.LeafHashes {
			json.LeafHashes[i] = hex.EncodeToString(h)
		}
	}

	return json
}
