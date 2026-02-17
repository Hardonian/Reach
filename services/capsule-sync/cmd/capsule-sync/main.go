package main

import (
	"log"
	"net/http"
	"os"

	"reach/services/capsule-sync/internal/api"
	"reach/services/capsule-sync/internal/store"
)

func main() {
	addr := os.Getenv("CAPSULE_SYNC_ADDR")
	if addr == "" {
		addr = ":8094"
	}
	srv := api.New(store.New())
	log.Printf("capsule-sync listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, srv.Handler()))
}
