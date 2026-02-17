package core

import "time"

const SchemaVersion = "1.0.0"

type OAuthClient struct {
	Provider    string   `json:"provider"`
	ClientID    string   `json:"clientId"`
	Secret      string   `json:"-"`
	RedirectURI string   `json:"redirectUri"`
	Scopes      []string `json:"scopes"`
}

type NormalizedEvent struct {
	SchemaVersion string            `json:"schemaVersion"`
	EventID       string            `json:"eventId"`
	TenantID      string            `json:"tenantId"`
	Provider      string            `json:"provider"`
	EventType     string            `json:"eventType"`
	TriggerType   string            `json:"triggerType"`
	OccurredAt    time.Time         `json:"occurredAt"`
	Actor         map[string]string `json:"actor"`
	Resource      map[string]any    `json:"resource"`
	Raw           map[string]any    `json:"raw"`
	Labels        map[string]string `json:"labels,omitempty"`
}

type Notification struct {
	SchemaVersion  string         `json:"schemaVersion"`
	NotificationID string         `json:"notificationId"`
	TenantID       string         `json:"tenantId"`
	Channel        string         `json:"channel"`
	Subject        string         `json:"subject"`
	Body           string         `json:"body"`
	Status         string         `json:"status"`
	Metadata       map[string]any `json:"metadata,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

type TriggerRequest struct {
	TenantID string         `json:"tenantId"`
	Source   string         `json:"source"`
	Type     string         `json:"type"`
	Payload  map[string]any `json:"payload"`
}
