package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	maxPackArchiveBytes   int64 = 32 * 1024 * 1024
	maxPackArchiveEntries       = 1024
)

type packCompatibility struct {
	ReachVersionRange  string   `json:"reach_version_range,omitempty"`
	SchemaVersionRange string   `json:"schema_version_range,omitempty"`
	RequiredCaps       []string `json:"required_capabilities,omitempty"`
	DeterministicRules []string `json:"deterministic_constraints,omitempty"`
}

type localRegistryEntry struct {
	Name          string            `json:"name"`
	Version       string            `json:"version"`
	Source        string            `json:"source"`
	SourceType    string            `json:"source_type"`
	PackPath      string            `json:"pack_path"`
	ContentHash   string            `json:"content_hash"`
	InstalledAt   string            `json:"installed_at"`
	Description   string            `json:"description,omitempty"`
	Compatibility packCompatibility `json:"compatibility,omitempty"`
}

type localRegistryIndex struct {
	FormatVersion string               `json:"format_version"`
	Packs         []localRegistryEntry `json:"packs"`
}

type packLock struct {
	FormatVersion string                    `json:"format_version"`
	GeneratedAt   string                    `json:"generated_at"`
	Packs         map[string]packLockRecord `json:"packs"`
}

type packLockRecord struct {
	Version     string `json:"version"`
	ContentHash string `json:"content_hash"`
	Source      string `json:"source"`
}

type rawPackMetadata struct {
	Name          string            `json:"name"`
	Version       string            `json:"version"`
	Description   string            `json:"description"`
	Metadata      map[string]any    `json:"metadata"`
	Compatibility packCompatibility `json:"compatibility"`
}

func runPackRegistry(ctx context.Context, args []string, out, errOut io.Writer) int {
	if len(args) < 1 {
		usagePack(out)
		return 1
	}
	dataRoot := getenv("REACH_DATA_DIR", "data")
	switch args[0] {
	case "search":
		return runPackSearch(dataRoot, args[1:], out, errOut)
	case "add":
		return runPackAdd(ctx, dataRoot, args[1:], out, errOut)
	case "remove":
		return runPackRemove(dataRoot, args[1:], out, errOut)
	case "update":
		return runPackUpdate(ctx, dataRoot, args[1:], out, errOut)
	case "list":
		return runPackList(dataRoot, out, errOut)
	default:
		usagePack(errOut)
		return 1
	}
}

func runPackSearch(dataRoot string, args []string, out, errOut io.Writer) int {
	idx, err := readLocalRegistry(dataRoot)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	query := ""
	if len(args) > 0 {
		query = strings.ToLower(strings.TrimSpace(args[0]))
	}
	result := make([]localRegistryEntry, 0)
	for _, p := range idx.Packs {
		if query == "" || strings.Contains(strings.ToLower(p.Name), query) || strings.Contains(strings.ToLower(p.Description), query) {
			result = append(result, p)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return writeJSON(out, map[string]any{"results": result})
}

func runPackList(dataRoot string, out, errOut io.Writer) int {
	idx, err := readLocalRegistry(dataRoot)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	sort.Slice(idx.Packs, func(i, j int) bool { return idx.Packs[i].Name < idx.Packs[j].Name })
	return writeJSON(out, map[string]any{"packs": idx.Packs})
}

func runPackRemove(dataRoot string, args []string, out, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack remove <name>")
		return 1
	}
	name := args[0]
	idx, err := readLocalRegistry(dataRoot)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	filtered := make([]localRegistryEntry, 0, len(idx.Packs))
	found := false
	for _, p := range idx.Packs {
		if p.Name == name {
			found = true
			continue
		}
		filtered = append(filtered, p)
	}
	if !found {
		_, _ = fmt.Fprintf(errOut, "pack %q not found\n", name)
		return 1
	}
	idx.Packs = filtered
	if err := writeLocalRegistry(dataRoot, idx); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	if err := writeLockfile(dataRoot, idx); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	return writeJSON(out, map[string]any{"removed": name})
}

func runPackUpdate(ctx context.Context, dataRoot string, args []string, out, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack update <name>")
		return 1
	}
	idx, err := readLocalRegistry(dataRoot)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	for _, p := range idx.Packs {
		if p.Name == args[0] {
			return runPackAdd(ctx, dataRoot, []string{p.Source, "--replace"}, out, errOut)
		}
	}
	_, _ = fmt.Fprintf(errOut, "pack %q not found\n", args[0])
	return 1
}

func runPackAdd(ctx context.Context, dataRoot string, args []string, out, errOut io.Writer) int {
	fs := flag.NewFlagSet("pack add", flag.ContinueOnError)
	replace := fs.Bool("replace", false, "replace existing pack")
	_ = fs.Parse(args)
	if fs.NArg() < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack add <local-path|git-url|tar|zip>")
		return 1
	}
	source := strings.TrimSpace(fs.Arg(0))
	resolved, sourceType, cleanup, err := resolvePackSource(ctx, source)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	if cleanup != nil {
		defer cleanup()
	}
	packFile, meta, err := locatePackManifest(resolved)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	if err := enforceCompatibility(meta.Compatibility); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	content, err := os.ReadFile(packFile)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	hash := stableHash(content)
	target := filepath.Join(dataRoot, "packs", meta.Name+".json")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	if err := os.WriteFile(target, content, 0o644); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	idx, err := readLocalRegistry(dataRoot)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	entry := localRegistryEntry{Name: meta.Name, Version: meta.Version, Source: source, SourceType: sourceType, PackPath: target, ContentHash: hash, InstalledAt: time.Now().UTC().Format(time.RFC3339), Description: meta.Description, Compatibility: meta.Compatibility}
	idx.Packs, err = upsertEntry(idx.Packs, entry, *replace)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	if err := writeLocalRegistry(dataRoot, idx); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	if err := writeLockfile(dataRoot, idx); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	return writeJSON(out, map[string]any{"added": meta.Name, "version": meta.Version, "content_hash": hash, "source_type": sourceType, "lockfile": filepath.Join(dataRoot, "registry", "pack.lock.json")})
}

func upsertEntry(entries []localRegistryEntry, entry localRegistryEntry, replace bool) ([]localRegistryEntry, error) {
	out := make([]localRegistryEntry, 0, len(entries)+1)
	replaced := false
	for _, p := range entries {
		if p.Name == entry.Name {
			if !replace {
				return nil, fmt.Errorf("pack %q already exists; use --replace or run reach pack update %s", entry.Name, entry.Name)
			}
			out = append(out, entry)
			replaced = true
			continue
		}
		out = append(out, p)
	}
	if !replaced {
		out = append(out, entry)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func readLocalRegistry(dataRoot string) (localRegistryIndex, error) {
	path := filepath.Join(dataRoot, "registry", "index.json")
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return localRegistryIndex{FormatVersion: "1", Packs: []localRegistryEntry{}}, nil
	}
	if err != nil {
		return localRegistryIndex{}, err
	}
	var idx localRegistryIndex
	if err := json.Unmarshal(b, &idx); err != nil {
		return localRegistryIndex{}, err
	}
	if idx.FormatVersion == "" {
		idx.FormatVersion = "1"
	}
	return idx, nil
}

func writeLocalRegistry(dataRoot string, idx localRegistryIndex) error {
	path := filepath.Join(dataRoot, "registry", "index.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return writeDeterministicJSON(path, idx)
}

func writeLockfile(dataRoot string, idx localRegistryIndex) error {
	packs := map[string]packLockRecord{}
	for _, p := range idx.Packs {
		packs[p.Name] = packLockRecord{Version: p.Version, ContentHash: p.ContentHash, Source: p.Source}
	}
	lock := packLock{FormatVersion: "1", GeneratedAt: time.Now().UTC().Format(time.RFC3339), Packs: packs}
	path := filepath.Join(dataRoot, "registry", "pack.lock.json")
	return writeDeterministicJSON(path, lock)
}

func resolvePackSource(ctx context.Context, source string) (string, string, func(), error) {
	if st, err := os.Stat(source); err == nil {
		if st.IsDir() {
			return source, "path", nil, nil
		}
		lower := strings.ToLower(source)
		if strings.HasSuffix(lower, ".zip") {
			tmp, cleanup, err := extractZip(source)
			return tmp, "zip", cleanup, err
		}
		if strings.HasSuffix(lower, ".tar") || strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz") {
			tmp, cleanup, err := extractTarball(source)
			return tmp, "tar", cleanup, err
		}
		return filepath.Dir(source), "path", nil, nil
	}
	if u, err := url.Parse(source); err == nil && (u.Scheme == "http" || u.Scheme == "https" || u.Scheme == "git" || strings.HasSuffix(source, ".git")) {
		tmp, err := os.MkdirTemp("", "reach-pack-git-*")
		if err != nil {
			return "", "", nil, err
		}
		cmd := exec.CommandContext(ctx, "git", "clone", "--depth", "1", source, tmp)
		if out, err := cmd.CombinedOutput(); err != nil {
			_ = os.RemoveAll(tmp)
			return "", "", nil, fmt.Errorf("git clone failed: %v (%s)", err, strings.TrimSpace(string(out)))
		}
		return tmp, "git", func() { _ = os.RemoveAll(tmp) }, nil
	}
	return "", "", nil, fmt.Errorf("source %q is not a readable path, archive, or git URL", source)
}

func locatePackManifest(root string) (string, rawPackMetadata, error) {
	candidates := []string{filepath.Join(root, "pack.json"), filepath.Join(root, "manifest.json")}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			b, err := os.ReadFile(c)
			if err != nil {
				return "", rawPackMetadata{}, err
			}
			var m rawPackMetadata
			if err := json.Unmarshal(b, &m); err != nil {
				return "", rawPackMetadata{}, fmt.Errorf("invalid pack metadata: %w", err)
			}
			if m.Name == "" {
				if v, ok := m.Metadata["name"].(string); ok {
					m.Name = v
				}
			}
			if m.Version == "" {
				if v, ok := m.Metadata["version"].(string); ok {
					m.Version = v
				}
			}
			if m.Name == "" || m.Version == "" {
				return "", rawPackMetadata{}, fmt.Errorf("pack manifest must include name and version")
			}
			return c, m, nil
		}
	}
	return "", rawPackMetadata{}, fmt.Errorf("no pack manifest found in %s", root)
}

func enforceCompatibility(c packCompatibility) error {
	if c.ReachVersionRange != "" && !versionInRange(engineVersion, c.ReachVersionRange) {
		return fmt.Errorf("pack requires reach version %q but current engine version is %s. Suggested fix: upgrade reachctl or install a compatible pack version", c.ReachVersionRange, engineVersion)
	}
	if c.SchemaVersionRange != "" && !versionInRange(specVersion, c.SchemaVersionRange) {
		return fmt.Errorf("pack requires schema version %q but current schema version is %s. Suggested fix: downgrade pack or upgrade reach schema support", c.SchemaVersionRange, specVersion)
	}
	for _, rule := range c.DeterministicRules {
		r := strings.ToLower(strings.TrimSpace(rule))
		if r == "require_stable_time" || r == "forbid_nondeterministic_apis" {
			continue
		}
	}
	return nil
}

func versionInRange(version, rng string) bool {
	rng = strings.TrimSpace(rng)
	if rng == "" || rng == "*" {
		return true
	}
	parts := strings.Split(rng, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		switch {
		case strings.HasPrefix(p, ">="):
			if compareVersion(version, strings.TrimSpace(strings.TrimPrefix(p, ">="))) < 0 {
				return false
			}
		case strings.HasPrefix(p, "<="):
			if compareVersion(version, strings.TrimSpace(strings.TrimPrefix(p, "<="))) > 0 {
				return false
			}
		case strings.HasPrefix(p, ">"):
			if compareVersion(version, strings.TrimSpace(strings.TrimPrefix(p, ">"))) <= 0 {
				return false
			}
		case strings.HasPrefix(p, "<"):
			if compareVersion(version, strings.TrimSpace(strings.TrimPrefix(p, "<"))) >= 0 {
				return false
			}
		default:
			if compareVersion(version, p) != 0 {
				return false
			}
		}
	}
	return true
}

func compareVersion(a, b string) int {
	pa := strings.Split(a, ".")
	pb := strings.Split(b, ".")
	for len(pa) < 3 {
		pa = append(pa, "0")
	}
	for len(pb) < 3 {
		pb = append(pb, "0")
	}
	for i := 0; i < 3; i++ {
		if pa[i] == pb[i] {
			continue
		}
		if pa[i] > pb[i] {
			return 1
		}
		return -1
	}
	return 0
}

func extractZip(src string) (string, func(), error) {
	r, err := zip.OpenReader(src)
	if err != nil {
		return "", nil, err
	}
	tmp, err := os.MkdirTemp("", "reach-pack-zip-*")
	if err != nil {
		_ = r.Close()
		return "", nil, err
	}
	totalBytes := int64(0)
	entryCount := 0
	for _, f := range r.File {
		cleanName := filepath.Clean(f.Name)
		if strings.HasPrefix(cleanName, "..") || filepath.IsAbs(cleanName) {
			continue
		}
		entryCount++
		if entryCount > maxPackArchiveEntries {
			_ = r.Close()
			_ = os.RemoveAll(tmp)
			return "", nil, fmt.Errorf("archive exceeds file entry limit (%d)", maxPackArchiveEntries)
		}
		target := filepath.Join(tmp, cleanName)
		if !strings.HasPrefix(target, tmp+string(filepath.Separator)) && target != tmp {
			continue
		}
		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(target, 0o755)
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			_ = r.Close()
			_ = os.RemoveAll(tmp)
			return "", nil, err
		}
		rc, err := f.Open()
		if err != nil {
			_ = r.Close()
			_ = os.RemoveAll(tmp)
			return "", nil, err
		}
		limited := io.LimitReader(rc, maxPackArchiveBytes-totalBytes+1)
		data, err := io.ReadAll(limited)
		_ = rc.Close()
		if err != nil {
			_ = r.Close()
			_ = os.RemoveAll(tmp)
			return "", nil, err
		}
		totalBytes += int64(len(data))
		if totalBytes > maxPackArchiveBytes {
			_ = r.Close()
			_ = os.RemoveAll(tmp)
			return "", nil, fmt.Errorf("archive exceeds unpacked size limit (%d bytes)", maxPackArchiveBytes)
		}
		if err := os.WriteFile(target, data, 0o644); err != nil {
			_ = r.Close()
			_ = os.RemoveAll(tmp)
			return "", nil, err
		}
	}
	_ = r.Close()
	return tmp, func() { _ = os.RemoveAll(tmp) }, nil
}

func extractTarball(src string) (string, func(), error) {
	f, err := os.Open(src)
	if err != nil {
		return "", nil, err
	}
	defer f.Close()
	var tr *tar.Reader
	if strings.HasSuffix(strings.ToLower(src), ".gz") || strings.HasSuffix(strings.ToLower(src), ".tgz") {
		gr, err := gzip.NewReader(f)
		if err != nil {
			return "", nil, err
		}
		defer gr.Close()
		tr = tar.NewReader(gr)
	} else {
		tr = tar.NewReader(f)
	}
	tmp, err := os.MkdirTemp("", "reach-pack-tar-*")
	if err != nil {
		return "", nil, err
	}
	totalBytes := int64(0)
	entryCount := 0
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			_ = os.RemoveAll(tmp)
			return "", nil, err
		}
		cleanName := filepath.Clean(hdr.Name)
		if strings.HasPrefix(cleanName, "..") || filepath.IsAbs(cleanName) {
			continue
		}
		entryCount++
		if entryCount > maxPackArchiveEntries {
			_ = os.RemoveAll(tmp)
			return "", nil, fmt.Errorf("archive exceeds file entry limit (%d)", maxPackArchiveEntries)
		}
		target := filepath.Join(tmp, cleanName)
		if !strings.HasPrefix(target, tmp+string(filepath.Separator)) && target != tmp {
			continue
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			_ = os.MkdirAll(target, 0o755)
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				_ = os.RemoveAll(tmp)
				return "", nil, err
			}
			data, err := io.ReadAll(io.LimitReader(tr, maxPackArchiveBytes-totalBytes+1))
			if err != nil {
				_ = os.RemoveAll(tmp)
				return "", nil, err
			}
			totalBytes += int64(len(data))
			if totalBytes > maxPackArchiveBytes {
				_ = os.RemoveAll(tmp)
				return "", nil, fmt.Errorf("archive exceeds unpacked size limit (%d bytes)", maxPackArchiveBytes)
			}
			if err := os.WriteFile(target, data, 0o644); err != nil {
				_ = os.RemoveAll(tmp)
				return "", nil, err
			}
		}
	}
	return tmp, func() { _ = os.RemoveAll(tmp) }, nil
}

func readPackLock(dataRoot string) (packLock, error) {
	path := filepath.Join(dataRoot, "registry", "pack.lock.json")
	b, err := os.ReadFile(path)
	if err != nil {
		return packLock{}, err
	}
	var lock packLock
	if err := json.Unmarshal(b, &lock); err != nil {
		return packLock{}, err
	}
	return lock, nil
}

func scanPackNonDeterministicAPIs(packPath string) ([]string, error) {
	forbidden := []string{"time.Now(", "Date.now(", "Math.random(", "crypto.randomUUID(", "rand.Int("}
	hits := []string{}
	err := filepath.WalkDir(packPath, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		ext := strings.ToLower(filepath.Ext(path))
		switch ext {
		case ".go", ".js", ".ts", ".py", ".sh":
		default:
			return nil
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		content := string(b)
		for _, token := range forbidden {
			if strings.Contains(content, token) {
				hits = append(hits, fmt.Sprintf("%s contains %q", path, token))
			}
		}
		return nil
	})
	return hits, err
}
