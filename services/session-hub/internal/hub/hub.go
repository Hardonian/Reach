package hub

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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

type queuedEvent struct {
	Event    Event
	Priority string
}

type clientState struct {
	memberID string
	conn     *websocketConn
	queue    chan queuedEvent
	closed   chan struct{}
}

type sessionData struct {
	Session
	mu sync.RWMutex
}

type Manager struct {
	sessions sync.Map // sessionID -> *sessionData
	clients  sync.Map // sessionID -> map[*websocketConn]*clientState

	queueDepth    atomic.Int64
	eventsBatched atomic.Uint64
	eventsDropped atomic.Uint64
}

func NewManager() *Manager {
	return &Manager{}
}

func (m *Manager) getOrCreate(sessionID, tenant string) *sessionData {
	val, _ := m.sessions.LoadOrStore(sessionID, &sessionData{
		Session: Session{
			ID:              sessionID,
			TenantID:        tenant,
			Members:         make(map[string]Role),
			ActiveRuns:      make(map[string]string),
			NodeAssignments: make(map[string]string),
		},
	})
	return val.(*sessionData)
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

	state := &clientState{memberID: memberID, conn: conn, queue: make(chan queuedEvent, 256), closed: make(chan struct{})}

	// Get or create client map for session
	clientsVal, _ := m.clients.LoadOrStore(sessionID, &sync.Map{})
	clients := clientsVal.(*sync.Map)
	clients.Store(conn, state)

	s.mu.Lock()
	s.Members[memberID] = role
	s.mu.Unlock()

	snapshot := map[string]any{"type": "session.snapshot", "session": &s.Session}
	_ = conn.WriteJSON(snapshot)
	go m.writeLoop(state)

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
					s.mu.Lock()
					s.NodeAssignments[msg.RunID] = node
					s.ActiveRuns[msg.RunID] = "active"
					s.mu.Unlock()
				}
			}
			m.broadcast(sessionID, msg, clients)
		}
	}

	clients.Delete(conn)
	s.mu.Lock()
	delete(s.Members, memberID)
	s.mu.Unlock()
	close(state.closed)
	_ = conn.Close()
}

func classifyPriority(event Event) string {
	switch event.Type {
	case "approval", "run.error", "run.stop":
		return "critical"
	case "run.event", "task.update":
		return "normal"
	default:
		return "passive"
	}
}

func (m *Manager) broadcast(sessionID string, event Event, clients *sync.Map) {
	prio := classifyPriority(event)
	clients.Range(func(key, value any) bool {
		state := value.(*clientState)
		select {
		case state.queue <- queuedEvent{Event: event, Priority: prio}:
			m.queueDepth.Add(1)
		default:
			if prio == "critical" {
				select {
				case state.queue <- queuedEvent{Event: event, Priority: prio}:
					m.queueDepth.Add(1)
				case <-state.closed:
				}
			} else {
				m.eventsDropped.Add(1)
			}
		}
		return true
	})
}

func (m *Manager) writeLoop(state *clientState) {
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()
	batch := make([]Event, 0, 32)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		_ = state.conn.WriteJSON(map[string]any{"type": "batch", "events": batch})
		m.eventsBatched.Add(uint64(len(batch)))
		batch = batch[:0]
	}
	for {
		select {
		case <-state.closed:
			flush()
			return
		case qe := <-state.queue:
			m.queueDepth.Add(-1)
			if qe.Priority == "critical" {
				flush()
				_ = state.conn.WriteJSON(qe.Event)
				continue
			}
			batch = append(batch, qe.Event)
			if len(batch) >= 32 {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (m *Manager) HandleListSessions(w http.ResponseWriter, _ *http.Request) {
	list := make([]*Session, 0, 64)
	m.sessions.Range(func(key, value any) bool {
		s := value.(*sessionData)
		s.mu.RLock()
		cp := s.Session
		s.mu.RUnlock()
		list = append(list, &cp)
		return true
	})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"sessions": list})
}

func (m *Manager) HandleMetrics(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	_, _ = w.Write([]byte("# TYPE sse_fanout_queue_depth gauge\n"))
	_, _ = w.Write([]byte("sse_fanout_queue_depth " + strconv.FormatInt(m.queueDepth.Load(), 10) + "\n"))
	_, _ = w.Write([]byte("# TYPE events_batched_total counter\n"))
	_, _ = w.Write([]byte("events_batched_total " + strconv.FormatUint(m.eventsBatched.Load(), 10) + "\n"))
	_, _ = w.Write([]byte("# TYPE events_dropped_total counter\n"))
	_, _ = w.Write([]byte("events_dropped_total{priority=\"passive\"} " + strconv.FormatUint(m.eventsDropped.Load(), 10) + "\n"))
}
