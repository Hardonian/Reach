package main

import (
	"log"
	"net/http"
	"os"

	"reach/services/runner/internal/api"
	"reach/services/runner/internal/storage"
)

func main() {
	addr := os.Getenv("RUNNER_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	dbPath := os.Getenv("RUNNER_DB_PATH")
	if dbPath == "" {
		dbPath = "data/runner.sqlite"
	}
	db, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	server := api.NewServer(db)
	log.Printf("runner listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}
