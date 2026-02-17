package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"reach/services/connector-registry/internal/api"
	"reach/services/connector-registry/internal/registry"
)

var version = "dev"

func main() {
	addr := getenv("CONNECTOR_REGISTRY_ADDR", ":8092")
	root := getenv("CONNECTOR_REGISTRY_ROOT", ".")
	trusted := getenv("PACKKIT_TRUSTED_KEYS", filepath.Join("..", "runner", "config", "trusted_plugin_keys.json"))
	keys, err := registry.TrustedKeysFromFile(trusted)
	if err != nil {
		log.Fatalf("load trusted keys: %v", err)
	}
	store, err := registry.NewStore(filepath.Join(root, "connectors"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), keys)
	if err != nil {
		log.Fatalf("init store: %v", err)
	}
	srv := api.New(store, version)
	log.Printf("connector-registry listening on %s", addr)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatal(err)
	}
}

func getenv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
