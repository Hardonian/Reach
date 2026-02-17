package main

import (
	"log"
	"net/http"
	"os"

	"reach/services/connector-registry/internal/api"
	"reach/services/connector-registry/internal/registry"
)

func main() {
	addr := os.Getenv("CONNECTOR_REGISTRY_ADDR")
	if addr == "" {
		addr = ":8092"
	}
	srv := api.New(registry.NewStore())
	log.Printf("connector-registry listening on %s", addr)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatal(err)
	}
}
