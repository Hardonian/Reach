package main

import (
	"log"
	"net/http"
	"os"

	"reach/services/session-hub/internal/hub"
)

func main() {
	addr := os.Getenv("SESSION_HUB_ADDR")
	if addr == "" {
		addr = ":8090"
	}
	m := hub.NewManager()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws/session/{session_id}", m.HandleWS)
	mux.HandleFunc("GET /v1/admin/sessions", m.HandleListSessions)
	log.Printf("session-hub listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
