package providers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"reach/services/integration-hub/internal/core"
)

var OAuthURLs = map[string]string{
	"slack":  "https://slack.com/oauth/v2/authorize",
	"google": "https://accounts.google.com/o/oauth2/v2/auth",
	"github": "https://github.com/login/oauth/authorize",
	"jira":   "https://auth.atlassian.com/authorize",
}

func BuildOAuthStartURL(client core.OAuthClient, state string) (string, error) {
	base, ok := OAuthURLs[client.Provider]
	if !ok {
		return "", fmt.Errorf("unsupported provider %s", client.Provider)
	}
	q := url.Values{}
	q.Set("client_id", client.ClientID)
	q.Set("redirect_uri", client.RedirectURI)
	q.Set("state", state)
	q.Set("response_type", "code")
	q.Set("scope", strings.Join(client.Scopes, " "))
	return base + "?" + q.Encode(), nil
}

func Normalize(provider, tenantID string, payload []byte) (core.NormalizedEvent, error) {
	var raw map[string]any
	if err := json.Unmarshal(payload, &raw); err != nil {
		return core.NormalizedEvent{}, err
	}
	e := core.NormalizedEvent{
		SchemaVersion: core.SchemaVersion,
		EventID:       fmt.Sprintf("%s-%d", provider, time.Now().UnixNano()),
		TenantID:      tenantID,
		Provider:      provider,
		OccurredAt:    time.Now().UTC(),
		Actor:         map[string]string{"id": "unknown"},
		Resource:      map[string]any{},
		Raw:           raw,
		TriggerType:   "unknown",
		EventType:     "unknown",
	}
	switch provider {
	case "slack":
		e.EventType = asString(raw["type"])
		e.Actor["id"] = asString(raw["user"])
		e.Resource["channel"] = raw["channel"]
		if strings.Contains(asString(raw["text"]), "/reach run") {
			e.TriggerType = "run.start"
		}
		if raw["actions"] != nil {
			e.TriggerType = "approval"
		}
	case "github":
		e.EventType = asString(raw["action"])
		if pr, ok := raw["pull_request"].(map[string]any); ok {
			e.EventType = "pull_request." + asString(raw["action"])
			e.Resource["pr"] = pr["html_url"]
			e.TriggerType = "run.start"
		}
	case "google":
		e.EventType = asString(raw["eventType"])
		e.Actor["email"] = asString(raw["email"])
		if strings.Contains(e.EventType, "calendar") {
			e.TriggerType = "schedule"
		}
	case "jira":
		e.EventType = asString(raw["webhookEvent"])
		if issue, ok := raw["issue"].(map[string]any); ok {
			e.Resource["issue"] = issue["key"]
			e.TriggerType = "task.event"
		}
	}
	return e, nil
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}
