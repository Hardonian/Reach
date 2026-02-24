package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"reach/services/runner/internal/trust"
)

type remoteValidationReport struct {
	ProtocolVersion string         `json:"protocol_version"`
	RequestHash     string         `json:"request_hash"`
	CapsuleHash     string         `json:"capsule_hash"`
	Verify          bool           `json:"verify"`
	Replay          bool           `json:"replay"`
	ToolVersions    map[string]any `json:"tool_versions"`
	Signature       string         `json:"signature"`
}

func runCache(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach cache <status|gc>")
		return 1
	}
	cas, err := trust.NewCAS(trust.DefaultCASRoot())
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "cache init failed:", err)
		return 1
	}
	switch args[0] {
	case "status":
		counts, err := cas.Status()
		if err != nil {
			_, _ = fmt.Fprintln(errOut, "cache status failed:", err)
			return 1
		}
		_ = writeJSON(out, map[string]any{"root": trust.DefaultCASRoot(), "objects": counts, "format_version": trust.CACObjectFormatVersion})
		return 0
	case "gc":
		deleted, err := cas.GC()
		if err != nil {
			_, _ = fmt.Fprintln(errOut, "cache gc failed:", err)
			return 1
		}
		_ = writeJSON(out, map[string]any{"deleted": deleted, "root": trust.DefaultCASRoot()})
		return 0
	default:
		_, _ = fmt.Fprintln(errOut, "usage: reach cache <status|gc>")
		return 1
	}
}

func runMemory(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 || args[0] != "hash" {
		_, _ = fmt.Fprintln(errOut, "usage: reach memory hash <input.json|-> [--store-cas]")
		return 1
	}
	fs := flag.NewFlagSet("memory hash", flag.ContinueOnError)
	storeCAS := fs.Bool("store-cas", false, "Store canonical memory payload in local CAS")
	_ = fs.Parse(args[1:])
	if fs.NArg() < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach memory hash <input.json|-> [--store-cas]")
		return 1
	}
	inputPath := fs.Arg(0)
	payload, err := readInputPayload(inputPath)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "memory input read failed:", err)
		return 1
	}
	canonical, hash, err := trust.CanonicalMemoryHash(payload)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "memory hash failed:", err)
		return 1
	}
	resp := map[string]any{"version": trust.MemoryAnchorFormatVersion, "hash": hash, "canonical": string(canonical)}
	if *storeCAS {
		cas, err := trust.NewCAS(trust.DefaultCASRoot())
		if err != nil {
			_, _ = fmt.Fprintln(errOut, "cache init failed:", err)
			return 1
		}
		k, err := cas.Put(trust.ObjectCanonicalBytes, canonical)
		if err != nil {
			_, _ = fmt.Fprintln(errOut, "cache store failed:", err)
			return 1
		}
		resp["cas_key"] = k
	}
	_ = writeJSON(out, resp)
	return 0
}

func runValidateRemote(args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("validate remote", flag.ContinueOnError)
	url := fs.String("url", "", "Remote validator base URL")
	capsule := fs.String("capsule", "", "Path to capsule JSON")
	timeoutS := fs.Int("timeout", 20, "HTTP timeout seconds")
	_ = fs.Parse(args)
	if *url == "" || *capsule == "" {
		_, _ = fmt.Fprintln(errOut, "usage: reach validate remote --url <...> --capsule <...>")
		return 1
	}
	payload, err := os.ReadFile(*capsule)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "read capsule failed:", err)
		return 1
	}
	if len(payload) > 10*1024*1024 {
		_, _ = fmt.Fprintln(errOut, "capsule exceeds 10MiB limit")
		return 1
	}
	client := &http.Client{Timeout: time.Duration(*timeoutS) * time.Second}
	pkResp, err := client.Get(strings.TrimRight(*url, "/") + "/public-key")
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "fetch public key failed:", err)
		return 1
	}
	defer pkResp.Body.Close()
	var pkPayload struct {
		PublicKey string `json:"public_key"`
	}
	if err := json.NewDecoder(pkResp.Body).Decode(&pkPayload); err != nil {
		_, _ = fmt.Fprintln(errOut, "decode public key failed:", err)
		return 1
	}
	publicKeyBytes, err := base64.StdEncoding.DecodeString(pkPayload.PublicKey)
	if err != nil || len(publicKeyBytes) != ed25519.PublicKeySize {
		_, _ = fmt.Fprintln(errOut, "invalid remote public key")
		return 1
	}
	body, _ := json.Marshal(map[string]any{"protocol_version": trust.RemoteProtocolVersion, "capsule": json.RawMessage(payload)})
	resp, err := client.Post(strings.TrimRight(*url, "/")+"/validate", "application/json", bytes.NewReader(body))
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "remote validate request failed:", err)
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		_, _ = fmt.Fprintf(errOut, "remote validate rejected (%d): %s\n", resp.StatusCode, string(b))
		return 1
	}
	var report remoteValidationReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		_, _ = fmt.Fprintln(errOut, "decode report failed:", err)
		return 1
	}
	sigBytes, err := base64.StdEncoding.DecodeString(report.Signature)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "invalid report signature encoding")
		return 1
	}
	signed := report
	signed.Signature = ""
	canonical := mustJSON(signed)
	if !ed25519.Verify(ed25519.PublicKey(publicKeyBytes), []byte(canonical), sigBytes) {
		_, _ = fmt.Fprintln(errOut, "report signature verification failed")
		return 1
	}
	_ = writeJSON(out, map[string]any{"verified_signature": true, "report": report})
	return 0
}

func readInputPayload(path string) ([]byte, error) {
	if path == "-" {
		return io.ReadAll(os.Stdin)
	}
	clean := filepath.Clean(path)
	return os.ReadFile(clean)
}
