package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"reach/internal/packkit/manifest"
	"reach/internal/packkit/signing"
)

func main() {
	if len(os.Args) < 2 {
		die("usage: packkit build|sign|install|upgrade")
	}
	switch os.Args[1] {
	case "build":
		build(os.Args[2:])
	case "sign":
		sign(os.Args[2:])
	case "install":
		install(os.Args[2:])
	case "upgrade":
		upgrade(os.Args[2:])
	default:
		die("unknown command")
	}
}

func build(args []string) {
	fs := flag.NewFlagSet("build", flag.ExitOnError)
	packType := fs.String("type", "", "connector|policy|template")
	src := fs.String("path", "", "source path")
	out := fs.String("out", "", "output path")
	_ = fs.Parse(args)
	manifestBytes, err := os.ReadFile(filepath.Join(*src, "manifest.json"))
	must(err)
	m, err := manifest.ParseManifest(manifestBytes)
	must(err)
	if m.Kind != *packType {
		die("manifest kind does not match --type")
	}
	dir := filepath.Join(*out, m.ID+"-"+m.Version)
	must(os.MkdirAll(dir, 0o755))
	must(os.WriteFile(filepath.Join(dir, "manifest.json"), manifestBytes, 0o644))
	bundlePath := filepath.Join(dir, "bundle.tar.gz")
	must(writeTar(*src, bundlePath))
	sha, err := fileSHA(bundlePath)
	must(err)
	must(os.WriteFile(filepath.Join(dir, "sha256.txt"), []byte(sha+"\n"), 0o644))
}

func sign(args []string) {
	fs := flag.NewFlagSet("sign", flag.ExitOnError)
	manifestPath := fs.String("manifest", "", "manifest")
	key := fs.String("key", "", "private key")
	keyID := fs.String("key-id", "default", "key id")
	_ = fs.Parse(args)
	manifestBytes, err := os.ReadFile(*manifestPath)
	must(err)
	kraw, err := os.ReadFile(*key)
	must(err)
	k, err := base64.StdEncoding.DecodeString(string(bytes.TrimSpace(kraw)))
	must(err)
	priv, err := signing.NormalizeEd25519PrivateKey(k)
	must(err)
	sig := signing.Signature{KeyID: *keyID, Algorithm: "ed25519", Signature: base64.StdEncoding.EncodeToString(ed25519.Sign(priv, manifestBytes))}
	out, _ := json.MarshalIndent(sig, "", "  ")
	must(os.WriteFile(filepath.Join(filepath.Dir(*manifestPath), "manifest.sig"), append(out, '\n'), 0o644))
}

func install(args []string) {
	fs := flag.NewFlagSet("install", flag.ExitOnError)
	id := fs.String("id", "", "package id")
	version := fs.String("version", "", "version")
	endpoint := fs.String("endpoint", "http://localhost:8092", "registry endpoint")
	_ = fs.Parse(args)
	reqBody, _ := json.Marshal(map[string]string{"id": *id, "version": *version})
	resp, err := http.Post(*endpoint+"/v1/connectors/install", "application/json", bytes.NewReader(reqBody))
	must(err)
	defer resp.Body.Close()
	_, _ = io.Copy(os.Stdout, resp.Body)
	if resp.StatusCode >= 300 {
		os.Exit(1)
	}
}

func upgrade(args []string) {
	fs := flag.NewFlagSet("upgrade", flag.ExitOnError)
	id := fs.String("id", "", "package id")
	endpoint := fs.String("endpoint", "http://localhost:8092", "registry endpoint")
	_ = fs.Parse(args)
	reqBody, _ := json.Marshal(map[string]string{"id": *id})
	resp, err := http.Post(*endpoint+"/v1/connectors/upgrade", "application/json", bytes.NewReader(reqBody))
	must(err)
	defer resp.Body.Close()
	_, _ = io.Copy(os.Stdout, resp.Body)
	if resp.StatusCode >= 300 {
		os.Exit(1)
	}
}

func writeTar(srcDir, out string) error {
	f, err := os.Create(out)
	if err != nil {
		return err
	}
	defer f.Close()
	gz := gzip.NewWriter(f)
	defer gz.Close()
	tw := tar.NewWriter(gz)
	defer tw.Close()
	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil || rel == "." {
			return err
		}
		h, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		h.Name = filepath.ToSlash(rel)
		if info.IsDir() {
			h.Name += "/"
		}
		if err := tw.WriteHeader(h); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		_, err = io.Copy(tw, in)
		return err
	})
}
func fileSHA(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:]), nil
}
func must(err error) {
	if err != nil {
		die(err.Error())
	}
}
func die(msg string) { fmt.Fprintln(os.Stderr, msg); os.Exit(1) }
