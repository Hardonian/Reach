package main

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"reach/internal/packkit/signing"
)

func main() {
	manifestPath := flag.String("manifest", "", "manifest path")
	privPath := flag.String("key", "", "ed25519 private key path (base64 seed or private key)")
	sigPath := flag.String("out", "", "signature output path (default: manifest.sig beside manifest)")
	keyID := flag.String("key-id", "default", "signing key id")
	flag.Parse()

	if *manifestPath == "" || *privPath == "" {
		fmt.Fprintln(os.Stderr, "manifest and key are required")
		os.Exit(2)
	}
	if *sigPath == "" {
		*sigPath = filepath.Join(filepath.Dir(*manifestPath), "manifest.sig")
	}

	manifestBytes, err := os.ReadFile(*manifestPath)
	must(err)
	privRaw, err := os.ReadFile(*privPath)
	must(err)
	privBytes, err := base64.StdEncoding.DecodeString(trim(privRaw))
	must(err)
	priv, err := signing.NormalizeEd25519PrivateKey(privBytes)
	must(err)

	sig := signing.Signature{KeyID: *keyID, Algorithm: "ed25519", Signature: base64.StdEncoding.EncodeToString(ed25519.Sign(priv, manifestBytes))}
	out, _ := json.MarshalIndent(sig, "", "  ")
	must(os.WriteFile(*sigPath, append(out, '\n'), 0o644))
	fmt.Printf("wrote signature %s\n", *sigPath)
}

func trim(b []byte) string {
	for len(b) > 0 && (b[len(b)-1] == '\n' || b[len(b)-1] == '\r' || b[len(b)-1] == ' ' || b[len(b)-1] == '\t') {
		b = b[:len(b)-1]
	}
	return string(b)
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
