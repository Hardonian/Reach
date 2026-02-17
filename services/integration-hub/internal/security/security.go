package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"
)

type Cipher struct{ key []byte }

func NewCipher(keyB64 string) (*Cipher, error) {
	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("integration key must be 32 bytes, got %d", len(key))
	}
	return &Cipher{key: key}, nil
}

func (c *Cipher) Encrypt(plaintext []byte) (string, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (c *Cipher) Decrypt(ciphertext string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}
	return gcm.Open(nil, raw[:nonceSize], raw[nonceSize:], nil)
}

func ComputeHMAC(secret string, body []byte) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

func VerifyHMAC(secret, provided string, body []byte) bool {
	expected := ComputeHMAC(secret, body)
	return hmac.Equal([]byte(expected), []byte(provided))
}

type Limiter struct {
	mu      sync.Mutex
	rate    int
	window  time.Duration
	entries map[string][]time.Time
}

func NewLimiter(rate int, window time.Duration) *Limiter {
	return &Limiter{rate: rate, window: window, entries: map[string][]time.Time{}}
}

func (l *Limiter) Allow(key string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	list := l.entries[key]
	cut := now.Add(-l.window)
	filtered := list[:0]
	for _, t := range list {
		if t.After(cut) {
			filtered = append(filtered, t)
		}
	}
	if len(filtered) >= l.rate {
		l.entries[key] = filtered
		return false
	}
	l.entries[key] = append(filtered, now)
	return true
}
