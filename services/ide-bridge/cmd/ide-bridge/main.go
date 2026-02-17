package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/reach/ide-bridge/internal/bridge"
)

var version = "dev"

func main() {
	var (
		bindAddr      = flag.String("bind", envOrDefault("IDE_BRIDGE_BIND", "127.0.0.1:7878"), "bind address for IDE bridge")
		runnerBaseURL = flag.String("runner-base-url", envOrDefault("RUNNER_BASE_URL", "http://127.0.0.1:8080"), "base URL for Reach Runner API")
		authToken     = flag.String("token", envOrDefault("IDE_BRIDGE_TOKEN", ""), "optional bearer token for IDE bridge and runner forwarding")
	)
	flag.Parse()

	logger := log.New(os.Stdout, "ide-bridge ", log.LstdFlags|log.Lmicroseconds)
	srv := bridge.NewServer(bridge.Config{
		BindAddr:      *bindAddr,
		AuthToken:     *authToken,
		RunnerBaseURL: *runnerBaseURL,
		Logger:        logger,
		Version:       version,
	})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := srv.ListenAndServe(ctx); err != nil {
		logger.Fatalf("server failed: %v", err)
	}
}

func envOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
