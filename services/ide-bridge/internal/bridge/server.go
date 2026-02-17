package bridge

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Config struct {
	BindAddr      string
	AuthToken     string
	RunnerBaseURL string
	Version       string
	HTTPClient    *http.Client
	Logger        *log.Logger
}

type Server struct {
	cfg     Config
	mu      sync.RWMutex
	editors map[string]*editorState
}

func NewServer(cfg Config) *Server {
	if cfg.BindAddr == "" {
		cfg.BindAddr = "127.0.0.1:7878"
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 10 * time.Second}
	}
	if cfg.Logger == nil {
		cfg.Logger = log.New(io.Discard, "", 0)
	}
	if cfg.Version == "" {
		cfg.Version = "dev"
	}

	return &Server{
		cfg:     cfg,
		editors: make(map[string]*editorState),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "version": s.cfg.Version})
	})
	mux.HandleFunc("/version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"version": s.cfg.Version})
	})
	mux.HandleFunc("/v1/register-editor", s.handleRegisterEditor)
	mux.HandleFunc("/v1/context/", s.handleUpdateContext)
	mux.HandleFunc("/v1/ws/", s.handleEditorWebSocket)
	mux.HandleFunc("/v1/commands/", s.handleSendCommand)
	return s.authMiddleware(mux)
}

func (s *Server) ListenAndServe(ctx context.Context) error {
	ln, err := net.Listen("tcp", s.cfg.BindAddr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer ln.Close()

	httpServer := &http.Server{Handler: s.Handler()}
	errCh := make(chan error, 1)
	go func() {
		if serveErr := httpServer.Serve(ln); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
		}
	}()

	s.cfg.Logger.Printf("ide-bridge listening on %s", s.cfg.BindAddr)

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
		return nil
	case serveErr := <-errCh:
		return serveErr
	}
}

func (s *Server) handleRegisterEditor(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id, err := newEditorID()
	if err != nil {
		http.Error(w, "failed to generate editor id", http.StatusInternalServerError)
		return
	}

	s.mu.Lock()
	s.editors[id] = &editorState{id: id, registeredAt: time.Now()}
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, RegisterEditorResponse{EditorID: id})
}

func (s *Server) handleUpdateContext(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	editorID := strings.TrimPrefix(r.URL.Path, "/v1/context/")
	if editorID == "" {
		http.Error(w, "editor id is required", http.StatusBadRequest)
		return
	}

	var ctxPayload EditorContext
	if err := json.NewDecoder(r.Body).Decode(&ctxPayload); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}
	if err := validateContext(ctxPayload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	editor, ok := s.editors[editorID]
	if !ok {
		s.mu.Unlock()
		http.Error(w, "editor not found", http.StatusNotFound)
		return
	}
	editor.context = ctxPayload
	editor.contextSet = true
	s.mu.Unlock()

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleEditorWebSocket(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	editorID := strings.TrimPrefix(r.URL.Path, "/v1/ws/")
	if editorID == "" {
		http.Error(w, "editor id is required", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	editor, ok := s.editors[editorID]
	if !ok {
		s.mu.Unlock()
		http.Error(w, "editor not found", http.StatusNotFound)
		return
	}
	conn, err := upgradeWebSocket(w, r)
	if err != nil {
		s.mu.Unlock()
		http.Error(w, "websocket upgrade failed", http.StatusBadRequest)
		return
	}
	editor.conn = conn
	editor.lastHeartbeat = time.Now()
	s.mu.Unlock()

	s.cfg.Logger.Printf("editor %s connected", editorID)
	go s.readEditorLoop(editorID, conn)
}

func (s *Server) readEditorLoop(editorID string, conn *websocketConn) {
	defer func() {
		_ = conn.Close()
		s.mu.Lock()
		if editor, ok := s.editors[editorID]; ok {
			editor.conn = nil
		}
		s.mu.Unlock()
		s.cfg.Logger.Printf("editor %s disconnected", editorID)
	}()

	for {
		var msg CommandEnvelope
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}
		s.mu.Lock()
		if editor, ok := s.editors[editorID]; ok {
			editor.lastHeartbeat = time.Now()
		}
		s.mu.Unlock()

		switch msg.Type {
		case "approval_decision":
			decision, err := parseApprovalDecision(msg.Payload)
			if err != nil {
				s.cfg.Logger.Printf("invalid approval decision from %s: %v", editorID, err)
				continue
			}
			if err := s.forwardApproval(editorID, decision); err != nil {
				s.cfg.Logger.Printf("failed to forward approval decision for %s: %v", editorID, err)
			}
		default:
			s.cfg.Logger.Printf("ignored message type=%s editor=%s", msg.Type, editorID)
		}
	}
}

func parseApprovalDecision(payload map[string]any) (ApprovalDecision, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return ApprovalDecision{}, err
	}
	var decision ApprovalDecision
	if err := json.Unmarshal(raw, &decision); err != nil {
		return ApprovalDecision{}, err
	}
	if strings.TrimSpace(decision.RunID) == "" {
		return ApprovalDecision{}, errors.New("run_id is required")
	}
	return decision, nil
}

func (s *Server) forwardApproval(editorID string, decision ApprovalDecision) error {
	if s.cfg.RunnerBaseURL == "" {
		return nil
	}
	payload := ApprovalForwardRequest{EditorID: editorID, Decision: decision}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	url := strings.TrimRight(s.cfg.RunnerBaseURL, "/") + "/v1/approvals/decision"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.cfg.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.AuthToken)
	}
	resp, err := s.cfg.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("runner returned status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func (s *Server) handleSendCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	editorID := strings.TrimPrefix(r.URL.Path, "/v1/commands/")
	if editorID == "" {
		http.Error(w, "editor id is required", http.StatusBadRequest)
		return
	}

	var cmd CommandEnvelope
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}
	if err := validateCommandType(cmd.Type); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	editor, ok := s.editors[editorID]
	if !ok {
		s.mu.RUnlock()
		http.Error(w, "editor not found", http.StatusNotFound)
		return
	}
	if editor.conn == nil {
		s.mu.RUnlock()
		http.Error(w, "editor websocket not connected", http.StatusConflict)
		return
	}
	if err := s.validateCommandForEditor(editor, cmd); err != nil {
		s.mu.RUnlock()
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	conn := editor.conn
	s.mu.RUnlock()

	if err := conn.WriteJSON(cmd); err != nil {
		http.Error(w, "failed to send command", http.StatusBadGateway)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) validateCommandForEditor(editor *editorState, cmd CommandEnvelope) error {
	if cmd.Type != "apply_patch" {
		return nil
	}
	if !editor.contextSet {
		return errors.New("editor context not set")
	}
	filePathRaw, ok := cmd.Payload["file_path"]
	if !ok {
		return errors.New("file_path is required for apply_patch")
	}
	filePath, ok := filePathRaw.(string)
	if !ok || strings.TrimSpace(filePath) == "" {
		return errors.New("file_path must be a non-empty string")
	}
	if err := ensurePathWithinRoot(editor.context.WorkspaceRoot, filePath); err != nil {
		return err
	}
	return nil
}

func ensurePathWithinRoot(root, candidate string) error {
	if root == "" {
		return errors.New("workspace_root is required")
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return fmt.Errorf("invalid workspace_root: %w", err)
	}
	joined := candidate
	if !filepath.IsAbs(candidate) {
		joined = filepath.Join(absRoot, candidate)
	}
	absPath, err := filepath.Abs(joined)
	if err != nil {
		return fmt.Errorf("invalid file_path: %w", err)
	}
	rel, err := filepath.Rel(absRoot, absPath)
	if err != nil {
		return fmt.Errorf("path check failed: %w", err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return errors.New("file_path escapes workspace_root")
	}
	return nil
}

func validateCommandType(cmdType string) error {
	switch cmdType {
	case "apply_patch", "show_diff", "notify", "request_approval":
		return nil
	default:
		return fmt.Errorf("unsupported command type %q", cmdType)
	}
}

func validateContext(ctx EditorContext) error {
	if strings.TrimSpace(ctx.WorkspaceRoot) == "" {
		return errors.New("workspace_root is required")
	}
	if strings.TrimSpace(ctx.ActiveFile) == "" {
		return errors.New("active_file is required")
	}
	if len(ctx.OpenFiles) == 0 {
		return errors.New("open_files must contain at least one file")
	}
	for _, file := range ctx.OpenFiles {
		if strings.TrimSpace(file) == "" {
			return errors.New("open_files entries must be non-empty")
		}
	}
	if ctx.SelectionRange.Start.Line < 0 || ctx.SelectionRange.Start.Character < 0 || ctx.SelectionRange.End.Line < 0 || ctx.SelectionRange.End.Character < 0 {
		return errors.New("selection_range positions must be non-negative")
	}
	return nil
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	if s.cfg.AuthToken == "" {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token != s.cfg.AuthToken {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func newEditorID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
