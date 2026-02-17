package hub

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Role string

const (
	RoleOwner  Role = "owner"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

type Session struct {
	ID              string            `json:"id"`
	TenantID        string            `json:"tenant_id"`
	Members         map[string]Role   `json:"members"`
	ActiveRuns      map[string]string `json:"active_runs"`
	NodeAssignments map[string]string `json:"node_assignments"`
}

type Event struct {
	Type      string         `json:"type"`
	SessionID string         `json:"session_id"`
	RunID     string         `json:"run_id,omitempty"`
	Approval  string         `json:"approval,omitempty"`
	Task      string         `json:"task,omitempty"`
	Payload   map[string]any `json:"payload,omitempty"`
	At        time.Time      `json:"at"`
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	clients  map[string]map[*websocketConn]string
}

func NewManager() *Manager {
	return &Manager{sessions: map[string]*Session{}, clients: map[string]map[*websocketConn]string{}}
}

func (m *Manager) getOrCreate(sessionID, tenant string) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[sessionID]
	if !ok {
		s = &Session{ID: sessionID, TenantID: tenant, Members: map[string]Role{}, ActiveRuns: map[string]string{}, NodeAssignments: map[string]string{}}
		m.sessions[sessionID] = s
	}
	return s
}

func collaborationAllowed(plan string) bool {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "pro", "enterprise":
		return true
	default:
		return false
	}
}

func (m *Manager) HandleWS(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("session_id")
	tenant := r.URL.Query().Get("tenant_id")
	if tenant == "" {
		http.Error(w, "tenant_id required", http.StatusBadRequest)
		return
	}
	memberID := r.URL.Query().Get("member_id")
	if memberID == "" {
		http.Error(w, "member_id required", http.StatusBadRequest)
		return
	}
	planTier := r.URL.Query().Get("plan_tier")
	if !collaborationAllowed(planTier) {
		http.Error(w, "plan does not allow collaboration", http.StatusPaymentRequired)
		return
	}
	role := Role(r.URL.Query().Get("role"))
	if role == "" {
		role = RoleViewer
	}
	if role != RoleOwner && role != RoleEditor && role != RoleViewer {
		http.Error(w, "invalid role", http.StatusBadRequest)
		return
	}
	s := m.getOrCreate(sessionID, tenant)
	if s.TenantID != tenant {
		http.Error(w, "tenant mismatch", http.StatusForbidden)
		return
	}
	conn, err := upgradeWebSocket(w, r)
	if err != nil {
		http.Error(w, "websocket upgrade failed", http.StatusBadRequest)
		return
	}

	m.mu.Lock()
	s.Members[memberID] = role
	if m.clients[sessionID] == nil {
		m.clients[sessionID] = map[*websocketConn]string{}
	}
	m.clients[sessionID][conn] = memberID
	m.mu.Unlock()
	_ = conn.WriteJSON(map[string]any{"type": "session.snapshot", "session": s})

	for {
		var msg Event
		if err := conn.ReadJSON(&msg); err != nil {
			break
		}
		msg.SessionID = sessionID
		msg.At = time.Now().UTC()
		if msg.Type == "run.event" || msg.Type == "approval" || msg.Type == "task.update" {
			if msg.RunID != "" && msg.Payload != nil {
				if node, ok := msg.Payload["node_id"].(string); ok {
					m.mu.Lock()
					s.NodeAssignments[msg.RunID] = node
					s.ActiveRuns[msg.RunID] = "active"
					m.mu.Unlock()
				}
			}
			m.broadcast(sessionID, msg)
		}
	}

	m.mu.Lock()
	delete(m.clients[sessionID], conn)
	delete(s.Members, memberID)
	m.mu.Unlock()
	_ = conn.Close()
}

func (m *Manager) broadcast(sessionID string, event Event) {
	m.mu.RLock()
	clients := m.clients[sessionID]
	m.mu.RUnlock()
	for conn := range clients {
		_ = conn.WriteJSON(event)
	}
}

func (m *Manager) HandleListSessions(w http.ResponseWriter, _ *http.Request) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	list := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		cp := *s
		list = append(list, &cp)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"sessions": list})
}
