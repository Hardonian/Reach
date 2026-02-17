package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"reach/services/integration-hub/internal/api"
	"reach/services/integration-hub/internal/core"
	"reach/services/integration-hub/internal/router"
	"reach/services/integration-hub/internal/security"
	"reach/services/integration-hub/internal/storage"
)

var version = "dev"

func main() {
	dbPath := getenv("INTEGRATION_HUB_DB", "integration-hub.db")
	encKey := os.Getenv("INTEGRATION_HUB_ENCRYPTION_KEY")
	if encKey == "" {
		log.Fatal("INTEGRATION_HUB_ENCRYPTION_KEY is required (base64 32-byte key)")
	}
	store, err := storage.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	cipher, err := security.NewCipher(encKey)
	if err != nil {
		log.Fatal(err)
	}
	for _, p := range []string{"slack", "github", "google", "jira"} {
		secretEnv := os.Getenv("WEBHOOK_SECRET_" + strings.ToUpper(p))
		if secretEnv != "" {
			_ = store.SaveWebhookSecret("default", p, secretEnv)
		}
	}
	clients := map[string]core.OAuthClient{
		"slack":  {Provider: "slack", ClientID: getenv("SLACK_CLIENT_ID", ""), Secret: getenv("SLACK_CLIENT_SECRET", ""), RedirectURI: getenv("SLACK_REDIRECT_URI", "http://localhost:8090/v1/integrations/slack/oauth/callback"), Scopes: []string{"chat:write", "channels:read"}},
		"google": {Provider: "google", ClientID: getenv("GOOGLE_CLIENT_ID", ""), Secret: getenv("GOOGLE_CLIENT_SECRET", ""), RedirectURI: getenv("GOOGLE_REDIRECT_URI", "http://localhost:8090/v1/integrations/google/oauth/callback"), Scopes: []string{"gmail.send", "calendar.readonly"}},
		"github": {Provider: "github", ClientID: getenv("GITHUB_CLIENT_ID", ""), Secret: getenv("GITHUB_CLIENT_SECRET", ""), RedirectURI: getenv("GITHUB_REDIRECT_URI", "http://localhost:8090/v1/integrations/github/oauth/callback"), Scopes: []string{"repo", "pull_request"}},
		"jira":   {Provider: "jira", ClientID: getenv("JIRA_CLIENT_ID", ""), Secret: getenv("JIRA_CLIENT_SECRET", ""), RedirectURI: getenv("JIRA_REDIRECT_URI", "http://localhost:8090/v1/integrations/jira/oauth/callback"), Scopes: []string{"read:jira-work", "write:jira-work"}},
	}

	server := api.NewServer(store, cipher, router.NewTriggerDispatcher(getenv("RUNNER_INTERNAL_URL", "http://localhost:8080")), clients, version)
	addr := getenv("INTEGRATION_HUB_ADDR", ":8090")
	log.Printf("integration hub listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, server.Routes()))
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
