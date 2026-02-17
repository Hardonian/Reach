package main

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"reach/internal/packkit/manifest"
)

func main() {
	packType := flag.String("type", "", "connector|policy|template")
	srcPath := flag.String("path", "", "source package path")
	outPath := flag.String("out", "", "output directory")
	flag.Parse()
	if *packType == "" || *srcPath == "" || *outPath == "" {
		die("type, path, and out are required")
	}
	if *packType != "connector" && *packType != "policy" && *packType != "template" {
		die("type must be connector|policy|template")
	}
	manifestPath := filepath.Join(*srcPath, "manifest.json")
	manifestBytes, err := os.ReadFile(manifestPath)
	must(err)
	m, err := manifest.ParseManifest(manifestBytes)
	must(err)
	if m.Kind != *packType {
		die(fmt.Sprintf("manifest kind %s does not match --type %s", m.Kind, *packType))
	}
	if err := validateManifestSchema(m); err != nil {
		die(err.Error())
	}

	bundleDir := filepath.Join(*outPath, fmt.Sprintf("%s-%s", m.ID, m.Version))
	must(os.MkdirAll(bundleDir, 0o755))

	targetManifest := filepath.Join(bundleDir, "manifest.json")
	must(os.WriteFile(targetManifest, manifestBytes, 0o644))
	bundlePath := filepath.Join(bundleDir, "bundle.tar.gz")
	must(writeTarGz(*srcPath, bundlePath))
	sha, err := fileSHA256(bundlePath)
	must(err)
	must(os.WriteFile(filepath.Join(bundleDir, "sha256.txt"), []byte(sha+"\n"), 0o644))

	fmt.Printf("built package at %s\n", bundleDir)
}

func validateManifestSchema(m manifest.Manifest) error {
	if m.Kind == "" || m.ID == "" || m.Version == "" || m.RiskLevel == "" {
		return fmt.Errorf("manifest requires kind,id,version,risk_level")
	}
	switch m.RiskLevel {
	case "low", "medium", "high", "strict", "experimental":
	default:
		return fmt.Errorf("invalid risk_level %s", m.RiskLevel)
	}
	return nil
}

func writeTarGz(srcDir, outFile string) error {
	f, err := os.Create(outFile)
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
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)
		if info.IsDir() {
			header.Name += "/"
		}
		if err := tw.WriteHeader(header); err != nil {
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

func fileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func must(err error) {
	if err != nil {
		die(err.Error())
	}
}

func die(msg string) {
	fmt.Fprintln(os.Stderr, strings.TrimSpace(msg))
	os.Exit(1)
}
