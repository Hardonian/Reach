package bridge

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestWebSocketConnectDisconnect(t *testing.T) {
	srv := NewServer(Config{Logger: log.New(io.Discard, "", 0)})
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	editorID := registerEditor(t, ts.URL)
	client := dialWS(t, ts.URL, "/v1/ws/"+editorID)

	srv.mu.RLock()
	if srv.editors[editorID].conn == nil {
		t.Fatalf("expected websocket connection to be registered")
	}
	srv.mu.RUnlock()

	client.close()

	deadline := time.Now().Add(1 * time.Second)
	for time.Now().Before(deadline) {
		srv.mu.RLock()
		connNil := srv.editors[editorID].conn == nil
		srv.mu.RUnlock()
		if connNil {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected websocket connection cleanup")
}

func TestContextUpdateValidation(t *testing.T) {
	srv := NewServer(Config{Logger: log.New(io.Discard, "", 0)})
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	editorID := registerEditor(t, ts.URL)

	badPayload := `{"workspace_root":"","open_files":[],"active_file":"","selection_range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}}}`
	resp, err := http.Post(ts.URL+"/v1/context/"+editorID, "application/json", strings.NewReader(badPayload))
	if err != nil {
		t.Fatalf("post context: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected bad request, got %d", resp.StatusCode)
	}
}

func TestApprovalRoundTrip(t *testing.T) {
	approvalCh := make(chan ApprovalForwardRequest, 1)
	runner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/approvals/decision" {
			http.NotFound(w, r)
			return
		}
		var payload ApprovalForwardRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		approvalCh <- payload
		w.WriteHeader(http.StatusNoContent)
	}))
	defer runner.Close()

	srv := NewServer(Config{RunnerBaseURL: runner.URL, Logger: log.New(io.Discard, "", 0)})
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	editorID := registerEditor(t, ts.URL)
	client := dialWS(t, ts.URL, "/v1/ws/"+editorID)
	defer client.close()

	msg := CommandEnvelope{Type: "approval_decision", Payload: map[string]any{"run_id": "run-123", "approved": true, "reason": "safe"}}
	if err := client.writeJSON(msg); err != nil {
		t.Fatalf("send decision: %v", err)
	}

	select {
	case forwarded := <-approvalCh:
		if forwarded.EditorID != editorID {
			t.Fatalf("expected editor id %s, got %s", editorID, forwarded.EditorID)
		}
		if forwarded.Decision.RunID != "run-123" || !forwarded.Decision.Approved {
			t.Fatalf("unexpected forwarded decision: %+v", forwarded.Decision)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for approval forwarding")
	}
}

func TestListenAndServeShutdown(t *testing.T) {
	srv := NewServer(Config{BindAddr: "127.0.0.1:0", Logger: log.New(io.Discard, "", 0)})
	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe(ctx) }()
	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for shutdown")
	}
}

func registerEditor(t *testing.T, baseURL string) string {
	t.Helper()
	resp, err := http.Post(baseURL+"/v1/register-editor", "application/json", bytes.NewReader(nil))
	if err != nil {
		t.Fatalf("register editor: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected register status: %d", resp.StatusCode)
	}
	var out RegisterEditorResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	return out.EditorID
}

type wsTestClient struct {
	conn net.Conn
	rw   *bufio.ReadWriter
}

func dialWS(t *testing.T, baseURL, path string) *wsTestClient {
	t.Helper()
	u, _ := url.Parse(baseURL)
	conn, err := net.Dial("tcp", u.Host)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	rw := bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))
	key := make([]byte, 16)
	_, _ = rand.Read(key)
	secKey := base64.StdEncoding.EncodeToString(key)
	request := fmt.Sprintf("GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n", path, u.Host, secKey)
	if _, err := rw.WriteString(request); err != nil {
		t.Fatalf("write request: %v", err)
	}
	_ = rw.Flush()

	status, err := rw.ReadString('\n')
	if err != nil {
		t.Fatalf("read status: %v", err)
	}
	if !strings.Contains(status, "101") {
		t.Fatalf("unexpected status line: %s", status)
	}

	headers := map[string]string{}
	for {
		line, err := rw.ReadString('\n')
		if err != nil {
			t.Fatalf("read headers: %v", err)
		}
		line = strings.TrimSpace(line)
		if line == "" {
			break
		}
		parts := strings.SplitN(line, ":", 2)
		headers[strings.ToLower(strings.TrimSpace(parts[0]))] = strings.TrimSpace(parts[1])
	}
	sum := sha1.Sum([]byte(secKey + wsGUID))
	expected := base64.StdEncoding.EncodeToString(sum[:])
	if headers["sec-websocket-accept"] != expected {
		t.Fatalf("invalid sec-websocket-accept header")
	}
	return &wsTestClient{conn: conn, rw: rw}
}

func (c *wsTestClient) writeJSON(v any) error {
	payload, err := json.Marshal(v)
	if err != nil {
		return err
	}
	mask := [4]byte{}
	_, _ = rand.Read(mask[:])
	for i := range payload {
		payload[i] ^= mask[i%4]
	}
	frame := []byte{0x81}
	switch n := len(payload); {
	case n < 126:
		frame = append(frame, 0x80|byte(n))
	case n <= 65535:
		frame = append(frame, 0x80|126)
		buf := make([]byte, 2)
		binary.BigEndian.PutUint16(buf, uint16(n))
		frame = append(frame, buf...)
	default:
		frame = append(frame, 0x80|127)
		buf := make([]byte, 8)
		binary.BigEndian.PutUint64(buf, uint64(n))
		frame = append(frame, buf...)
	}
	frame = append(frame, mask[:]...)
	frame = append(frame, payload...)
	if _, err := c.rw.Write(frame); err != nil {
		return err
	}
	return c.rw.Flush()
}

func (c *wsTestClient) close() {
	_, _ = c.rw.Write([]byte{0x88, 0x80, 0, 0, 0, 0})
	_ = c.rw.Flush()
	_ = c.conn.Close()
}
