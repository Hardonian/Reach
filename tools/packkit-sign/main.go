package main

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"reach/internal/packkit/signing"
)

func main() {
	mode := flag.String("mode", "verify", "sign|verify")
	manifestPath := flag.String("manifest", "", "manifest path")
	sigPath := flag.String("sig", "", "signature path")
	keyID := flag.String("key-id", "dev", "key id")
	privPath := flag.String("private-key", "", "base64 private key path (sign mode)")
	trustedPath := flag.String("trusted-keys", "", "trusted keys json path")
	flag.Parse()

	manifestBytes, err := os.ReadFile(*manifestPath)
	must(err)

	switch *mode {
	case "sign":
		privRaw, err := os.ReadFile(*privPath)
		must(err)
		privBytes, err := base64.StdEncoding.DecodeString(string(trim(privRaw)))
		must(err)
		sig := signing.Signature{KeyID: *keyID, Algorithm: "ed25519", Signature: base64.StdEncoding.EncodeToString(ed25519.Sign(ed25519.PrivateKey(privBytes), manifestBytes))}
		out, _ := json.MarshalIndent(sig, "", "  ")
		must(os.WriteFile(*sigPath, append(out, '\n'), 0o644))
		fmt.Printf("wrote signature %s\n", *sigPath)
	case "verify":
		sigBytes, err := os.ReadFile(*sigPath)
		must(err)
		sig, err := signing.ParseSignature(sigBytes)
		must(err)
		keysRaw, err := os.ReadFile(*trustedPath)
		must(err)
		keys := map[string]string{}
		must(json.Unmarshal(keysRaw, &keys))
		ok, key, err := signing.VerifyManifestSignature(manifestBytes, sig, keys)
		must(err)
		if !ok {
			fmt.Println("verification failed")
			os.Exit(1)
		}
		fmt.Printf("verified with key %s\n", key)
	default:
		fmt.Fprintf(os.Stderr, "unknown mode %s\n", *mode)
		os.Exit(2)
	}
}

func trim(b []byte) string {
	for len(b) > 0 && (b[len(b)-1] == '\n' || b[len(b)-1] == '\r' || b[len(b)-1] == ' ') {
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
