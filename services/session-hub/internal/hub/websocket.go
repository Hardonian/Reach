package hub

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
)

const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

var (
	frameBufPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, 0, 256)
		},
	}
	maskKeyPool = sync.Pool{
		New: func() interface{} {
			return [4]byte{}
		},
	}
)

type websocketConn struct {
	conn net.Conn
	rw   *bufio.ReadWriter
	mu   sync.Mutex
}

func upgradeWebSocket(w http.ResponseWriter, r *http.Request) (*websocketConn, error) {
	if !strings.EqualFold(r.Header.Get("Connection"), "Upgrade") && !strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade") {
		return nil, errors.New("connection upgrade header required")
	}
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return nil, errors.New("upgrade websocket header required")
	}
	if r.Header.Get("Sec-WebSocket-Version") != "13" {
		return nil, errors.New("unsupported websocket version")
	}
	key := r.Header.Get("Sec-WebSocket-Key")
	if strings.TrimSpace(key) == "" {
		return nil, errors.New("sec-websocket-key required")
	}

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return nil, errors.New("hijacking not supported")
	}
	conn, rw, err := hijacker.Hijack()
	if err != nil {
		return nil, err
	}

	hash := sha1.Sum([]byte(key + wsGUID))
	accept := base64.StdEncoding.EncodeToString(hash[:])
	response := fmt.Sprintf("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n", accept)
	if _, err := rw.WriteString(response); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := rw.Flush(); err != nil {
		_ = conn.Close()
		return nil, err
	}

	return &websocketConn{conn: conn, rw: rw}, nil
}

func (c *websocketConn) Close() error { return c.conn.Close() }

func (c *websocketConn) ReadJSON(v any) error {
	payload, opcode, err := c.readFrame()
	if err != nil {
		return err
	}
	if opcode == 0x8 {
		return io.EOF
	}
	if opcode != 0x1 {
		return errors.New("unsupported websocket opcode")
	}
	return json.Unmarshal(payload, v)
}

func (c *websocketConn) WriteJSON(v any) error {
	payload, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.writeFrame(0x1, payload)
}

func (c *websocketConn) readFrame() ([]byte, byte, error) {
	header := make([]byte, 2)
	if _, err := io.ReadFull(c.rw, header); err != nil {
		return nil, 0, err
	}
	opcode := header[0] & 0x0F
	masked := header[1]&0x80 != 0
	if !masked {
		return nil, 0, errors.New("client frames must be masked")
	}
	length, err := c.readLength(header[1] & 0x7F)
	if err != nil {
		return nil, 0, err
	}

	maskKey := maskKeyPool.Get().([4]byte)
	defer maskKeyPool.Put(maskKey)
	if _, err := io.ReadFull(c.rw, maskKey[:]); err != nil {
		return nil, 0, err
	}

	// Reuse buffer from pool if possible
	payload := frameBufPool.Get().([]byte)[:0]
	if cap(payload) < length {
		payload = make([]byte, length)
	} else {
		payload = payload[:length]
	}
	if _, err := io.ReadFull(c.rw, payload); err != nil {
		return nil, 0, err
	}

	// Unmask using loop unrolling for small payloads
	for i := 0; i < length-3; i += 4 {
		m0, m1, m2, m3 := maskKey[0], maskKey[1], maskKey[2], maskKey[3]
		payload[i] ^= m0
		payload[i+1] ^= m1
		payload[i+2] ^= m2
		payload[i+3] ^= m3
	}
	for i := (length / 4) * 4; i < length; i++ {
		payload[i] ^= maskKey[i%4]
	}

	return payload, opcode, nil
}

func (c *websocketConn) readLength(short byte) (int, error) {
	switch short {
	case 126:
		buf := make([]byte, 2)
		if _, err := io.ReadFull(c.rw, buf); err != nil {
			return 0, err
		}
		return int(binary.BigEndian.Uint16(buf)), nil
	case 127:
		buf := make([]byte, 8)
		if _, err := io.ReadFull(c.rw, buf); err != nil {
			return 0, err
		}
		return int(binary.BigEndian.Uint64(buf)), nil
	default:
		return int(short), nil
	}
}

func (c *websocketConn) writeFrame(opcode byte, payload []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Pre-allocate frame buffer with enough capacity
	frameLen := 2 + 8 + len(payload)
	frame := make([]byte, 0, frameLen)
	frame = append(frame, 0x80|opcode)

	n := len(payload)
	switch {
	case n < 126:
		frame = append(frame, byte(n))
	case n <= 65535:
		frame = append(frame, 126)
		buf := [2]byte{}
		binary.BigEndian.PutUint16(buf[:], uint16(n))
		frame = append(frame, buf[:]...)
	default:
		frame = append(frame, 127)
		buf := [8]byte{}
		binary.BigEndian.PutUint64(buf[:], uint64(n))
		frame = append(frame, buf[:]...)
	}

	frame = append(frame, payload...)
	if _, err := c.rw.Write(frame); err != nil {
		return err
	}
	return c.rw.Flush()
}
