package hub

import (
	"bufio"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func newServer(m *Manager) *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws/session/{session_id}", m.HandleWS)
	return httptest.NewServer(mux)
}

type wsClient struct {
	conn net.Conn
	rw   *bufio.ReadWriter
}

func dialWS(t *testing.T, baseURL, path string) *wsClient {
	t.Helper()
	u, _ := url.Parse(baseURL)
	conn, err := net.Dial("tcp", u.Host)
	if err != nil {
		t.Fatal(err)
	}
	rw := bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))
	key := make([]byte, 16)
	_, _ = rand.Read(key)
	secKey := base64.StdEncoding.EncodeToString(key)
	req := fmt.Sprintf("GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n", path, u.Host, secKey)
	_, _ = rw.WriteString(req)
	_ = rw.Flush()

	status, _ := rw.ReadString('\n')
	if !strings.Contains(status, "101") {
		t.Fatalf("unexpected status: %s", status)
	}
	headers := map[string]string{}
	for {
		line, _ := rw.ReadString('\n')
		line = strings.TrimSpace(line)
		if line == "" {
			break
		}
		parts := strings.SplitN(line, ":", 2)
		headers[strings.ToLower(strings.TrimSpace(parts[0]))] = strings.TrimSpace(parts[1])
	}
	expectedSum := sha1.Sum([]byte(secKey + wsGUID))
	if headers["sec-websocket-accept"] != base64.StdEncoding.EncodeToString(expectedSum[:]) {
		t.Fatal("bad sec-websocket-accept")
	}
	return &wsClient{conn: conn, rw: rw}
}

func (c *wsClient) close() { _ = c.conn.Close() }

func (c *wsClient) writeJSON(v any) error {
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
	n := len(payload)
	switch {
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
	_, err = c.rw.Write(frame)
	if err == nil {
		err = c.rw.Flush()
	}
	return err
}

func (c *wsClient) readJSON(v any) error {
	header := make([]byte, 2)
	if _, err := c.rw.Read(header); err != nil {
		return err
	}
	n := int(header[1] & 0x7F)
	if n == 126 {
		buf := make([]byte, 2)
		_, _ = c.rw.Read(buf)
		n = int(binary.BigEndian.Uint16(buf))
	}
	payload := make([]byte, n)
	_, err := c.rw.Read(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(payload, v)
}

func TestBroadcastToMultipleClients(t *testing.T) {
	m := NewManager()
	ts := newServer(m)
	defer ts.Close()

	c1 := dialWS(t, ts.URL, "/ws/session/sess-1?tenant_id=t1&member_id=alice&role=owner&plan_tier=pro&plan=pro")
	defer c1.close()
	c2 := dialWS(t, ts.URL, "/ws/session/sess-1?tenant_id=t1&member_id=bob&role=editor&plan_tier=pro&plan=pro")
	defer c2.close()

	var snapshot map[string]any
	_ = c1.readJSON(&snapshot)
	_ = c2.readJSON(&snapshot)

	if err := c1.writeJSON(Event{Type: "task.update", Task: "ready"}); err != nil {
		t.Fatal(err)
	}
	_ = c2.conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var got map[string]any
	if err := c2.readJSON(&got); err != nil {
		t.Fatal(err)
	}
	if got["type"] != "batch" {
		t.Fatalf("unexpected event wrapper: %+v", got)
	}
}

func TestSessionTenantIsolation(t *testing.T) {
	m := NewManager()
	ts := newServer(m)
	defer ts.Close()

	c1 := dialWS(t, ts.URL, "/ws/session/sess-1?tenant_id=t1&member_id=alice&role=owner&plan_tier=pro&plan=pro")
	defer c1.close()
	var snapshot map[string]any
	_ = c1.readJSON(&snapshot)

	u, _ := url.Parse(ts.URL)
	conn, err := net.Dial("tcp", u.Host)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	rw := bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))
	key := base64.StdEncoding.EncodeToString([]byte("0123456789012345"))
	_, _ = rw.WriteString(fmt.Sprintf("GET /ws/session/sess-1?tenant_id=t2&member_id=bob&role=viewer&plan_tier=pro&plan=pro HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n", u.Host, key))
	_ = rw.Flush()
	status, _ := rw.ReadString('\n')
	if !strings.Contains(status, "403") {
		t.Fatalf("expected 403, got %s", status)
	}
}

func TestFreeTierCannotJoinCollaboration(t *testing.T) {
	m := NewManager()
	ts := newServer(m)
	defer ts.Close()

	u, _ := url.Parse(ts.URL)
	conn, err := net.Dial("tcp", u.Host)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	rw := bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))
	key := base64.StdEncoding.EncodeToString([]byte("1234567890123456"))
	_, _ = rw.WriteString(fmt.Sprintf("GET /ws/session/sess-2?tenant_id=t1&member_id=free&role=viewer&plan_tier=free HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n", u.Host, key))
	_ = rw.Flush()
	status, _ := rw.ReadString('\n')
	if !strings.Contains(status, "402") {
		t.Fatalf("expected 402, got %s", status)
	}
}
