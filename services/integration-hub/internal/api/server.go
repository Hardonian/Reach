package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"reach/services/integration-hub/internal/core"
	"reach/services/integration-hub/internal/providers"
	"reach/services/integration-hub/internal/router"
	"reach/services/integration-hub/internal/security"
	"reach/services/integration-hub/internal/storage"
)

type Server struct {
	store      *storage.Store
	cipher     *security.Cipher
	dispatcher *router.TriggerDispatcher
	clients    map[string]core.OAuthClient
	limiter    *security.Limiter
}

func NewServer(store *storage.Store, cipher *security.Cipher, dispatcher *router.TriggerDispatcher, clients map[string]core.OAuthClient) *Server {
	return &Server{store: store, cipher: cipher, dispatcher: dispatcher, clients: clients, limiter: security.NewLimiter(120, time.Minute)}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/integrations", s.listIntegrations)
	mux.HandleFunc("GET /v1/events", s.listEvents)
	mux.HandleFunc("GET /v1/audit", s.listAudit)
	mux.HandleFunc("POST /v1/integrations/{provider}/oauth/start", s.oauthStart)
	mux.HandleFunc("GET /v1/integrations/{provider}/oauth/callback", s.oauthCallback)
	mux.HandleFunc("POST /v1/integrations/{provider}/approve", s.approval)
	mux.HandleFunc("POST /v1/notifications", s.notify)
	mux.HandleFunc("POST /webhooks/slack", s.webhook("slack"))
	mux.HandleFunc("POST /webhooks/github", s.webhook("github"))
	mux.HandleFunc("POST /webhooks/google", s.webhook("google"))
	mux.HandleFunc("POST /webhooks/jira", s.webhook("jira"))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Reach-Tenant")
		if tenantID == "" {
			http.Error(w, "missing tenant", http.StatusUnauthorized)
			return
		}
		if !s.limiter.Allow(tenantID + ":" + r.URL.Path) {
			http.Error(w, "rate limited", http.StatusTooManyRequests)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func (s *Server) oauthStart(w http.ResponseWriter, r *http.Request) {
	tenantID, provider, ok := s.tenantAndProvider(r)
	if !ok {
		http.Error(w, "invalid provider", http.StatusBadRequest)
		return
	}
	state := randToken()
	if err := s.store.SaveOAuthState(state, tenantID, provider); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	url, err := providers.BuildOAuthStartURL(s.clients[provider], state)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	_ = s.store.WriteAudit(tenantID, "oauth.start", map[string]any{"provider": provider})
	writeJSON(w, map[string]any{"authorizeUrl": url, "state": state})
}

func (s *Server) oauthCallback(w http.ResponseWriter, r *http.Request) {
	tenantID, provider, ok := s.tenantAndProvider(r)
	if !ok {
		http.Error(w, "invalid provider", http.StatusBadRequest)
		return
	}
	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if state == "" || code == "" {
		http.Error(w, "missing state/code", http.StatusBadRequest)
		return
	}
	if err := s.store.ConsumeOAuthState(state, tenantID, provider); err != nil {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	encAccess, _ := s.cipher.Encrypt([]byte("access-" + code))
	encRefresh, _ := s.cipher.Encrypt([]byte("refresh-" + code))
	if err := s.store.SaveToken(tenantID, provider, encAccess, encRefresh, time.Now().Add(time.Hour).UTC().Format(time.RFC3339), s.clients[provider].Scopes); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = s.store.WriteAudit(tenantID, "oauth.callback", map[string]any{"provider": provider})
	writeJSON(w, map[string]any{"status": "connected"})
}

func (s *Server) webhook(provider string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Reach-Tenant")
		body, _ := io.ReadAll(r.Body)
		nonce := r.Header.Get("X-Reach-Delivery")
		if err := s.store.CheckAndMarkReplay(tenantID, nonce, 10*time.Minute); err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		secret, err := s.store.WebhookSecret(tenantID, provider)
		if err != nil {
			http.Error(w, "missing webhook secret", http.StatusUnauthorized)
			return
		}
		if err := verifySignature(provider, secret, r, body); err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		e, err := providers.Normalize(provider, tenantID, body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err = s.store.SaveEvent(e); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = s.dispatcher.Dispatch(e)
		_ = s.store.WriteAudit(tenantID, "webhook.received", map[string]any{"provider": provider, "eventType": e.EventType, "triggerType": e.TriggerType})
		writeJSON(w, map[string]any{"status": "accepted", "eventId": e.EventID})
	}
}

func verifySignature(provider, secret string, r *http.Request, body []byte) error {
	switch provider {
	case "slack":
		timestamp := r.Header.Get("X-Slack-Request-Timestamp")
		sig := r.Header.Get("X-Slack-Signature")
		if timestamp == "" || sig == "" {
			return errors.New("missing slack signature")
		}
		base := []byte("v0:" + timestamp + ":" + string(body))
		expected := "v0=" + strings.TrimPrefix(security.ComputeHMAC(secret, base), "sha256=")
		if expected != sig {
			return errors.New("invalid slack signature")
		}
	case "github":
		sig := r.Header.Get("X-Hub-Signature-256")
		if !security.VerifyHMAC(secret, sig, body) {
			return errors.New("invalid github signature")
		}
	default:
		sig := r.Header.Get("X-Reach-Signature")
		if !security.VerifyHMAC(secret, sig, body) {
			return errors.New("invalid webhook signature")
		}
	}
	return nil
}

func (s *Server) notify(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Reach-Tenant")
	var in core.Notification
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	in.SchemaVersion = core.SchemaVersion
	in.TenantID = tenantID
	in.Status = "sent"
	in.CreatedAt = time.Now().UTC()
	in.UpdatedAt = in.CreatedAt
	if in.NotificationID == "" {
		in.NotificationID = randToken()
	}
	_ = s.store.WriteAudit(tenantID, "notification.sent", map[string]any{"channel": in.Channel, "subject": in.Subject})
	writeJSON(w, in)
}

func (s *Server) approval(w http.ResponseWriter, r *http.Request) {
	tenantID, provider, ok := s.tenantAndProvider(r)
	if !ok {
		http.Error(w, "invalid provider", http.StatusBadRequest)
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	decision, _ := payload["decision"].(string)
	e := core.NormalizedEvent{SchemaVersion: core.SchemaVersion, EventID: randToken(), TenantID: tenantID, Provider: provider, EventType: "approval." + decision, TriggerType: "approval", OccurredAt: time.Now().UTC(), Actor: map[string]string{"id": "external-user"}, Raw: payload, Resource: map[string]any{"decision": decision}}
	_ = s.store.SaveEvent(e)
	_ = s.dispatcher.Dispatch(e)
	_ = s.store.WriteAudit(tenantID, "approval.received", map[string]any{"provider": provider, "decision": decision})
	writeJSON(w, map[string]any{"status": "processed"})
}

func (s *Server) listIntegrations(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListIntegrations(r.Header.Get("X-Reach-Tenant"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"integrations": items})
}
func (s *Server) listEvents(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListEvents(r.Header.Get("X-Reach-Tenant"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"events": items})
}
func (s *Server) listAudit(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListAudit(r.Header.Get("X-Reach-Tenant"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"audit": items})
}

func (s *Server) tenantAndProvider(r *http.Request) (tenantID, provider string, ok bool) {
	tenantID = r.Header.Get("X-Reach-Tenant")
	provider = r.PathValue("provider")
	_, ok = s.clients[provider]
	return
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func randToken() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return base64.RawURLEncoding.EncodeToString(buf)
}
