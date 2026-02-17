package main

import (
	"log"
	"net/http"
	"os"

	"reach/services/session-hub/internal/hub"
)

var version = "dev"

func main() {
	addr := os.Getenv("SESSION_HUB_ADDR")
	if addr == "" {
		addr = ":8090"
	}
	m := hub.NewManager()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","version":"` + version + `"}`))
	})
	mux.HandleFunc("GET /version", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"version":"` + version + `"}`))
	})
	mux.HandleFunc("GET /ws/session/{session_id}", m.HandleWS)
	mux.HandleFunc("GET /v1/admin/sessions", m.HandleListSessions)
	log.Printf("session-hub listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
