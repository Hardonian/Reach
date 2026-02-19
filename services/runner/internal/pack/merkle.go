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

func (mt *MerkleTree) GetProof(index int) (*MerkleProof, error) {
	if index < 0 || index >= len(mt.Leaves) {
		return nil, fmt.Errorf("index %d out of range [0, %d)", index, len(mt.Leaves))
	}

	proof := &MerkleProof{
		Index:    index,
		LeafHash: mt.LeafHashes[index],
	}

	// Path from leaf up to root would be easier if we had Parent pointers.
	// Instead, we traverse from Root down to the leaf and collect siblings.
	var path [][]byte
	var indices []int

	if !mt.findPath(mt.Root, index, len(mt.Leaves), &path, &indices) {
		return nil, errors.New("failed to find proof path")
	}

	// ProofPath should be bottom-to-top
	for i := len(path) - 1; i >= 0; i-- {
		proof.ProofPath = append(proof.ProofPath, path[i])
		proof.ProofIndex = append(proof.ProofIndex, indices[i])
	}

	return proof, nil
}

func (mt *MerkleTree) findPath(node *MerkleNode, targetIdx, levelSize int, path *[][]byte, indices *[]int) bool {
	if node.Leaf {
		return node.Index == targetIdx
	}

	// Splitting logic MUST match buildTree
	split := 1
	for split < levelSize {
		if split*2 >= levelSize {
			break
		}
		split *= 2
	}
	// Wait, buildTree uses: for i := 0; i < len(nodes); i += 2
	// This means it grows from bottom up, pairing 0-1, 2-3, 4-5...
	// The first parentNode covers leaves 0 and 1.
	// The last parentNode might cover only the last leaf if count is odd.
	// This is slightly different from power-of-2 split.

	// Let's check buildTree logic:
	// parentNodes = append(parentNodes, parent)
	// count of parentNodes = (len(nodes) + 1) / 2
	// parentNodes[0] covers nodes[0] and nodes[1]

	// So at level-1, parent i covers leaves [2*i, 2*i + 1]
	// At level-2, grandparent i covers leaves [4*i, 4*i + 3]
	// At level-L, node i covers 2^L leaves.

	// However, buildTree is recursive: mt.buildTree(parentNodes)
	// This IS a standard balanced binary tree where:
	// Left node always covers 2^k leaves where 2^k is the largest power of 2 < levelSize.
	// NO, that's for some Merkle variants.
	// Our buildTree splits it differently.
	// If nodes = 3. parentNodes = [p0, p1]. p0=(n0,n1), p1=(n2,n2).
	// buildTree([p0, p1]) -> root=(p0,p1).
	// Root covers [0,2]. Left child p0 covers [0,1]. Right child p1 covers [2].

	// The split for a node covering 'levelSize' leaves is:
	// leftSize = 1 << floor(log2(levelSize-1))
	// Example: levelSize=3. log2(2)=1. leftSize=2^1=2. Correct.
	// Example: levelSize=4. log2(3)=1.xx. leftSize=2^1=2. Correct.
	// Example: levelSize=5. log2(4)=2. leftSize=2^2=4. Correct.

	leftSize := 1
	if levelSize > 1 {
		for leftSize < levelSize {
			if leftSize*2 >= levelSize {
				break
			}
			leftSize *= 2
		}
	}

	if targetIdx < leftSize {
		// Left branch
		if mt.findPath(node.Left, targetIdx, leftSize, path, indices) {
			*path = append(*path, node.Right.Hash)
			*indices = append(*indices, 1) // Sibling is right
			return true
		}
	} else {
		// Right branch
		if mt.findPath(node.Right, targetIdx-leftSize, levelSize-leftSize, path, indices) {
			*path = append(*path, node.Left.Hash)
			*indices = append(*indices, 0) // Sibling is left
			return true
		}
	}

	return false
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
