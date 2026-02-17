package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"reach/services/runner/internal/mcpserver"
)

func main() {
	workspace := os.Getenv("RUNNER_WORKSPACE")
	if workspace == "" {
		workspace = "."
	}
	capabilities := strings.Split(os.Getenv("RUNNER_CAPABILITIES"), ",")
	policy := mcpserver.NewStaticPolicy(capabilities)
	srv := mcpserver.New(workspace, policy, mcpserver.LogAuditLogger{}, nil, nil)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	httpAddr := os.Getenv("RUNNER_MCP_HTTP_ADDR")
	if httpAddr != "" {
		mux := http.NewServeMux()
		mux.Handle("/mcp", mcpserver.HTTPHandler(srv))
		server := &http.Server{Addr: httpAddr, Handler: mux}
		go func() {
			<-ctx.Done()
			_ = server.Shutdown(context.Background())
		}()
		log.Printf("runner MCP HTTP listening on %s", httpAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
		return
	}

	log.Printf("runner MCP serving over stdio")
	if err := mcpserver.ServeStdio(ctx, srv, os.Stdin, os.Stdout); err != nil {
		log.Fatal(err)
	}
}
