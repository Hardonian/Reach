package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"reach/services/runner/internal/signing"
)

type packSignatureBlock struct {
	Algorithm     string `json:"algorithm"`
	PublicKey     string `json:"public_key"`
	SignatureHex  string `json:"signature_hex"`
	Fingerprint   string `json:"fingerprint"`
	SignedPayload string `json:"signed_payload"`
}

type signedPackManifest struct {
	Name              string              `json:"name"`
	Version           string              `json:"version"`
	Author            string              `json:"author"`
	ReachVersionRange string              `json:"reach_version_range"`
	SchemaRange       string              `json:"schema_version_range"`
	HashVersionRange  string              `json:"hash_version_range"`
	ContentHash       string              `json:"content_hash"`
	Signature         *packSignatureBlock `json:"signature,omitempty"`
}

func runPackSign(args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("pack sign", flag.ContinueOnError)
	keyDir := fs.String("key-dir", filepath.Join("data", "keys"), "directory containing reach_signing.key")
	_ = fs.Parse(args)
	if fs.NArg() < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack sign <path-to-pack>")
		return 1
	}
	packPath := fs.Arg(0)
	manifestPath := filepath.Join(packPath, "pack.json")
	payload, err := os.ReadFile(manifestPath)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "pack sign failed: %v\n", err)
		return 1
	}

	packMeta, err := loadPackMeta(payload)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "pack sign failed: %v\n", err)
		return 1
	}

	contentHash := stableHash(payload)
	sig, kp, err := signPayload(*keyDir, packMeta.Name+"@"+packMeta.Version, contentHash)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "pack sign failed: %v\n", err)
		return 1
	}

	outManifest := signedPackManifest{
		Name:              packMeta.Name,
		Version:           packMeta.Version,
		Author:            packMeta.Author,
		ReachVersionRange: packMeta.ReachVersionRange,
		SchemaRange:       packMeta.SchemaVersionRange,
		HashVersionRange:  packMeta.HashVersionRange,
		ContentHash:       contentHash,
		Signature: &packSignatureBlock{
			Algorithm:     string(sig.Algorithm),
			PublicKey:     sig.PublicKey,
			SignatureHex:  sig.SignatureHex,
			Fingerprint:   stableHash(sig.PublicKey),
			SignedPayload: sig.RunID + ":" + sig.ProofHash,
		},
	}
	outPath := filepath.Join(packPath, "pack.manifest.json")
	if err := writeDeterministicJSON(outPath, outManifest); err != nil {
		_, _ = fmt.Fprintf(errOut, "pack sign failed: %v\n", err)
		return 1
	}

	return writeJSON(out, map[string]any{"manifest": outPath, "key_fingerprint": stableHash(kp.PublicKey), "content_hash": contentHash})
}

func runPackVerifySignature(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack verify-signature <path-to-pack>")
		return 1
	}
	strict := strings.EqualFold(strings.TrimSpace(os.Getenv("REACH_REQUIRE_PACK_SIGNATURE")), "1")
	manifestPath := filepath.Join(args[0], "pack.manifest.json")
	var m signedPackManifest
	b, err := os.ReadFile(manifestPath)
	if err != nil {
		if strict {
			_, _ = fmt.Fprintf(errOut, "pack verify-signature failed: signature is required but manifest is missing (%v)\n", err)
			return 1
		}
		_, _ = fmt.Fprintln(out, "warning: unsigned pack (manifest missing). Set REACH_REQUIRE_PACK_SIGNATURE=1 to enforce signatures.")
		return 0
	}
	if err := json.Unmarshal(b, &m); err != nil {
		_, _ = fmt.Fprintf(errOut, "pack verify-signature failed: invalid manifest: %v\n", err)
		return 1
	}
	if m.Signature == nil {
		if strict {
			_, _ = fmt.Fprintln(errOut, "pack verify-signature failed: signature is required but not present")
			return 1
		}
		_, _ = fmt.Fprintln(out, "warning: unsigned pack. Set REACH_REQUIRE_PACK_SIGNATURE=1 to enforce signatures.")
		return 0
	}

	packJSON, err := os.ReadFile(filepath.Join(args[0], "pack.json"))
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "pack verify-signature failed: %v\n", err)
		return 1
	}
	computedHash := stableHash(packJSON)
	if computedHash != m.ContentHash {
		_, _ = fmt.Fprintf(errOut, "pack verify-signature failed: content hash mismatch (expected %s, got %s)\n", m.ContentHash, computedHash)
		return 1
	}

	sig := &signing.Signature{RunID: m.Name + "@" + m.Version, ProofHash: m.ContentHash, Algorithm: signing.Algorithm(m.Signature.Algorithm), PublicKey: m.Signature.PublicKey, SignatureHex: m.Signature.SignatureHex, SignedAt: "0000-00-00T00:00:00Z"}
	if err := signing.Verify(sig); err != nil {
		_, _ = fmt.Fprintf(errOut, "pack verify-signature failed: %v\n", err)
		return 1
	}
	return writeJSON(out, map[string]any{"verified": true, "content_hash": computedHash, "key_fingerprint": stableHash(m.Signature.PublicKey)})
}

func runCapsuleSign(args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("capsule sign", flag.ContinueOnError)
	keyDir := fs.String("key-dir", filepath.Join("data", "keys"), "directory containing reach_signing.key")
	_ = fs.Parse(args)
	if fs.NArg() < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach capsule sign <capsule-file>")
		return 1
	}
	path := fs.Arg(0)
	cap, err := readCapsule(path)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "capsule sign failed: %v\n", err)
		return 1
	}
	transcriptHash := stableHash(cap.EventLog)
	lockHash := stableHash(cap.Lock)
	proofHash := stableHash(map[string]any{"run_fingerprint": cap.Manifest.RunFingerprint, "transcript_hash": transcriptHash, "pack_lock_hash": lockHash, "schema_version": cap.Manifest.SpecVersion, "hash_version": "sha256-v1"})
	sig, _, err := signPayload(*keyDir, cap.Manifest.RunID, proofHash)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "capsule sign failed: %v\n", err)
		return 1
	}
	if cap.Evidence.AuditChain == nil {
		cap.Evidence.AuditChain = []string{}
	}
	cap.Evidence.AuditChain = append(cap.Evidence.AuditChain, "capsule-signature:"+sig.SignatureHex)
	if cap.Manifest.TrustScores == nil {
		cap.Manifest.TrustScores = map[string]float64{}
	}
	cap.Manifest.TrustScores["capsule_signed"] = 1
	cap.Manifest.TrustScores["pack_lock_hash"] = 1
	cap.Manifest.TrustScores["transcript_hash"] = 1
	if cap.Manifest.Policy == nil {
		cap.Manifest.Policy = map[string]any{}
	}
	cap.Manifest.Policy["capsule_signature"] = map[string]any{"algorithm": sig.Algorithm, "public_key": sig.PublicKey, "signature_hex": sig.SignatureHex, "proof_hash": proofHash, "transcript_hash": transcriptHash, "pack_lock_hash": lockHash, "hash_version": "sha256-v1", "schema_version": cap.Manifest.SpecVersion}
	if err := writeDeterministicJSON(path, cap); err != nil {
		_, _ = fmt.Fprintf(errOut, "capsule sign failed: %v\n", err)
		return 1
	}
	return writeJSON(out, map[string]any{"signed": path, "proof_hash": proofHash})
}

func runCapsuleVerifySignature(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach capsule verify-signature <capsule-file>")
		return 1
	}
	cap, err := readCapsule(args[0])
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "capsule verify-signature failed: %v\n", err)
		return 1
	}
	sigBlock, ok := cap.Manifest.Policy["capsule_signature"].(map[string]any)
	if !ok {
		_, _ = fmt.Fprintln(errOut, "capsule verify-signature failed: missing capsule_signature block")
		return 1
	}
	transcriptHash := stableHash(cap.EventLog)
	lockHash := stableHash(cap.Lock)
	if fmt.Sprint(sigBlock["transcript_hash"]) != transcriptHash {
		_, _ = fmt.Fprintln(errOut, "capsule verify-signature failed: transcript hash mismatch")
		return 1
	}
	if fmt.Sprint(sigBlock["pack_lock_hash"]) != lockHash {
		_, _ = fmt.Fprintln(errOut, "capsule verify-signature failed: pack lock hash mismatch")
		return 1
	}
	if fmt.Sprint(sigBlock["schema_version"]) != cap.Manifest.SpecVersion || fmt.Sprint(sigBlock["hash_version"]) != "sha256-v1" {
		_, _ = fmt.Fprintln(errOut, "capsule verify-signature failed: schema/hash version mismatch")
		return 1
	}
	sig := &signing.Signature{RunID: cap.Manifest.RunID, ProofHash: fmt.Sprint(sigBlock["proof_hash"]), Algorithm: signing.Algorithm(fmt.Sprint(sigBlock["algorithm"])), PublicKey: fmt.Sprint(sigBlock["public_key"]), SignatureHex: fmt.Sprint(sigBlock["signature_hex"])}
	if err := signing.Verify(sig); err != nil {
		_, _ = fmt.Fprintf(errOut, "capsule verify-signature failed: %v\n", err)
		return 1
	}
	return writeJSON(out, map[string]any{"verified": true, "run_id": cap.Manifest.RunID, "proof_hash": sig.ProofHash})
}

type packMeta struct {
	Name               string
	Version            string
	Author             string
	ReachVersionRange  string
	SchemaVersionRange string
	HashVersionRange   string
}

func loadPackMeta(payload []byte) (packMeta, error) {
	var raw map[string]any
	if err := json.Unmarshal(payload, &raw); err != nil {
		return packMeta{}, err
	}
	meta := packMeta{
		Name:               strings.TrimSpace(fmt.Sprint(raw["name"])),
		Version:            strings.TrimSpace(fmt.Sprint(raw["version"])),
		Author:             strings.TrimSpace(fmt.Sprint(raw["author"])),
		ReachVersionRange:  strings.TrimSpace(fmt.Sprint(raw["reach_version_range"])),
		SchemaVersionRange: strings.TrimSpace(fmt.Sprint(raw["schema_version_range"])),
		HashVersionRange:   strings.TrimSpace(fmt.Sprint(raw["hash_version_range"])),
	}
	if md, ok := raw["metadata"].(map[string]any); ok {
		if meta.Name == "" {
			meta.Name = strings.TrimSpace(fmt.Sprint(md["name"]))
		}
		if meta.Version == "" {
			meta.Version = strings.TrimSpace(fmt.Sprint(md["version"]))
		}
		if meta.Author == "" {
			meta.Author = strings.TrimSpace(fmt.Sprint(md["author"]))
		}
	}
	if meta.Name == "" || meta.Version == "" {
		return packMeta{}, errors.New("pack.json missing name/version")
	}
	if meta.Author == "" {
		meta.Author = "unknown"
	}
	if meta.ReachVersionRange == "" {
		meta.ReachVersionRange = ">=0.0.0"
	}
	if meta.SchemaVersionRange == "" {
		meta.SchemaVersionRange = ">=1.0.0"
	}
	if meta.HashVersionRange == "" {
		meta.HashVersionRange = "sha256-v1"
	}
	return meta, nil
}

func signPayload(keyDir, runID, proofHash string) (*signing.Signature, *signing.KeyPair, error) {
	kp, err := signing.LoadOrCreateKeyPair(keyDir)
	if err != nil {
		return nil, nil, err
	}
	sig, err := kp.Sign(runID, proofHash)
	if err != nil {
		return nil, nil, err
	}
	return sig, kp, nil
}

type publicPackIndex struct {
	FormatVersion string                 `json:"format_version"`
	Packs         []publicPackIndexEntry `json:"packs"`
}

type publicPackIndexEntry struct {
	Name                    string   `json:"name"`
	Description             string   `json:"description,omitempty"`
	Tags                    []string `json:"tags,omitempty"`
	LatestVersion           string   `json:"latest_version"`
	Versions                []string `json:"versions"`
	ContentHashes           []string `json:"content_hashes"`
	SignatureKeyFingerprint string   `json:"signature_key_fingerprint,omitempty"`
	Rating                  float64  `json:"rating,omitempty"`
	Downloads               int      `json:"downloads,omitempty"`
}

func runPackIndex(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack index <build|validate> ...")
		return 1
	}
	switch args[0] {
	case "build":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reach pack index build <packs-dir> [--output <file>]")
			return 1
		}
		packsDir := args[1]
		outPath := filepath.Join(packsDir, "index.json")
		for i := 2; i < len(args); i++ {
			if args[i] == "--output" && i+1 < len(args) {
				outPath = args[i+1]
				i++
			}
		}
		entries, err := os.ReadDir(packsDir)
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "pack index build failed: %v\n", err)
			return 1
		}
		idx := publicPackIndex{FormatVersion: "1.0.0", Packs: []publicPackIndexEntry{}}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			pp := filepath.Join(packsDir, e.Name())
			mbytes, err := os.ReadFile(filepath.Join(pp, "pack.json"))
			if err != nil {
				continue
			}
			meta, err := loadPackMeta(mbytes)
			if err != nil {
				continue
			}
			h := stableHash(mbytes)
			tags := []string{}
			var raw map[string]any
			_ = json.Unmarshal(mbytes, &raw)
			if arr, ok := raw["tags"].([]any); ok {
				for _, t := range arr {
					tags = append(tags, fmt.Sprint(t))
				}
			}
			desc := strings.TrimSpace(fmt.Sprint(raw["description"]))
			rating := 0.0
			if v, ok := raw["rating"].(float64); ok {
				rating = v
			}
			dls := 0
			if v, ok := raw["downloads"].(float64); ok {
				dls = int(v)
			}
			fingerprint := ""
			if b, err := os.ReadFile(filepath.Join(pp, "pack.manifest.json")); err == nil {
				var sm signedPackManifest
				if json.Unmarshal(b, &sm) == nil && sm.Signature != nil {
					fingerprint = sm.Signature.Fingerprint
				}
			}
			idx.Packs = append(idx.Packs, publicPackIndexEntry{Name: meta.Name, Description: desc, Tags: tags, LatestVersion: meta.Version, Versions: []string{meta.Version}, ContentHashes: []string{h}, SignatureKeyFingerprint: fingerprint, Rating: rating, Downloads: dls})
		}
		sort.Slice(idx.Packs, func(i, j int) bool { return idx.Packs[i].Name < idx.Packs[j].Name })
		if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
			_, _ = fmt.Fprintf(errOut, "pack index build failed: %v\n", err)
			return 1
		}
		if err := writeDeterministicJSON(outPath, idx); err != nil {
			_, _ = fmt.Fprintf(errOut, "pack index build failed: %v\n", err)
			return 1
		}
		return writeJSON(out, map[string]any{"index": outPath, "pack_count": len(idx.Packs)})
	case "validate":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reach pack index validate <index.json>")
			return 1
		}
		b, err := os.ReadFile(args[1])
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "pack index validate failed: %v\n", err)
			return 1
		}
		var idx publicPackIndex
		if err := json.Unmarshal(b, &idx); err != nil {
			_, _ = fmt.Fprintf(errOut, "pack index validate failed: invalid json: %v\n", err)
			return 1
		}
		for _, p := range idx.Packs {
			if p.Name == "" || p.LatestVersion == "" || len(p.Versions) == 0 || len(p.ContentHashes) == 0 {
				_, _ = fmt.Fprintf(errOut, "pack index validate failed: invalid entry for %q\n", p.Name)
				return 1
			}
		}
		return writeJSON(out, map[string]any{"valid": true, "pack_count": len(idx.Packs)})
	default:
		_, _ = fmt.Fprintln(errOut, "usage: reach pack index <build|validate> ...")
		return 1
	}
}

func runPackInfo(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack info <name>")
		return 1
	}
	name := args[0]
	idx, err := readLocalRegistry(getenv("REACH_DATA_DIR", "data"))
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	for _, p := range idx.Packs {
		if p.Name == name {
			info := map[string]any{"name": p.Name, "version": p.Version, "compatibility": map[string]any{"reach": p.Compatibility.ReachVersionRange, "schema": p.Compatibility.SchemaVersionRange, "hash_version": "sha256-v1"}, "signature_fingerprint": "", "risk_flags": []string{}}
			if b, err := os.ReadFile(filepath.Join(filepath.Dir(p.PackPath), p.Name, "pack.manifest.json")); err == nil {
				var sm signedPackManifest
				if json.Unmarshal(b, &sm) == nil && sm.Signature != nil {
					info["signature_fingerprint"] = sm.Signature.Fingerprint
				}
			}
			if info["signature_fingerprint"] == "" {
				info["risk_flags"] = []string{"unsigned-pack"}
			}
			return writeJSON(out, info)
		}
	}
	_, _ = fmt.Fprintf(errOut, "pack %q not found\n", name)
	return 1
}
