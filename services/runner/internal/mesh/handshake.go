package mesh

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sync"
	"time"
)

type NodeIdentity struct {
	NodeID           string
	OrgID            string
	NodePublicKey    ed25519.PublicKey
	CapabilitiesHash string
}

type Challenge struct {
	Nonce                string
	PolicyVersion        string
	RegistrySnapshotHash string
	IssuedAt             time.Time
}

type Response struct {
	Challenge Challenge
	NodeID    string
	Signature string
}

type SessionToken struct {
	Value     string
	ExpiresAt time.Time
}

type Handshaker struct {
	mu      sync.Mutex
	usedSig map[string]struct{}
	ttl     time.Duration
	audit   func(event string, node NodeIdentity, challenge Challenge, err error)
}

func NewHandshaker(ttl time.Duration) *Handshaker {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &Handshaker{usedSig: map[string]struct{}{}, ttl: ttl}
}

func (h *Handshaker) WithAuditSink(fn func(event string, node NodeIdentity, challenge Challenge, err error)) *Handshaker {
	h.audit = fn
	return h
}

func (h *Handshaker) NewChallenge(policyVersion, registryHash string) (Challenge, error) {
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		return Challenge{}, err
	}
	return Challenge{Nonce: base64.StdEncoding.EncodeToString(nonce), PolicyVersion: policyVersion, RegistrySnapshotHash: registryHash, IssuedAt: time.Now().UTC()}, nil
}

func SignChallenge(privateKey ed25519.PrivateKey, c Challenge, nodeID string) string {
	payload := []byte(c.Nonce + "|" + c.PolicyVersion + "|" + c.RegistrySnapshotHash + "|" + nodeID)
	return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, payload))
}

func (h *Handshaker) Verify(identity NodeIdentity, response Response) (SessionToken, error) {
	h.emit("handshake.started", identity, response.Challenge, nil)
	if response.NodeID != identity.NodeID {
		err := errors.New("node id mismatch")
		h.emit("handshake.failed", identity, response.Challenge, err)
		return SessionToken{}, err
	}
	if time.Since(response.Challenge.IssuedAt) > h.ttl {
		err := errors.New("challenge expired")
		h.emit("handshake.failed", identity, response.Challenge, err)
		return SessionToken{}, err
	}
	payload := []byte(response.Challenge.Nonce + "|" + response.Challenge.PolicyVersion + "|" + response.Challenge.RegistrySnapshotHash + "|" + response.NodeID)
	sig, err := base64.StdEncoding.DecodeString(response.Signature)
	if err != nil {
		h.emit("handshake.failed", identity, response.Challenge, err)
		return SessionToken{}, err
	}
	if !ed25519.Verify(identity.NodePublicKey, payload, sig) {
		err := errors.New("invalid signature")
		h.emit("handshake.failed", identity, response.Challenge, err)
		return SessionToken{}, err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.usedSig[response.Signature]; ok {
		err := errors.New("replay detected")
		h.emit("handshake.failed", identity, response.Challenge, err)
		return SessionToken{}, err
	}
	h.usedSig[response.Signature] = struct{}{}
	tokenRaw := make([]byte, 24)
	if _, err := rand.Read(tokenRaw); err != nil {
		h.emit("handshake.failed", identity, response.Challenge, err)
		return SessionToken{}, err
	}
	token := SessionToken{Value: base64.StdEncoding.EncodeToString(tokenRaw), ExpiresAt: time.Now().UTC().Add(h.ttl)}
	h.emit("handshake.completed", identity, response.Challenge, nil)
	return token, nil
}

func (h *Handshaker) emit(event string, node NodeIdentity, challenge Challenge, err error) {
	if h.audit != nil {
		h.audit(event, node, challenge, err)
	}
}
