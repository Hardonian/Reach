package router

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"reach/services/integration-hub/internal/core"
)

type Correlation struct {
	TraceID   string
	SessionID string
	RunID     string
	AgentID   string
	SpawnID   string
	NodeID    string
	RequestID string
}

type TriggerDispatcher struct {
	RunnerURL string
	Client    *http.Client

	mu               sync.Mutex
	consecutiveFails int
	circuitUntil     time.Time
}

func NewTriggerDispatcher(runnerURL string) *TriggerDispatcher {
	return &TriggerDispatcher{RunnerURL: runnerURL, Client: &http.Client{Timeout: 3 * time.Second}}
}

func (d *TriggerDispatcher) Dispatch(ctx context.Context, e core.NormalizedEvent, corr Correlation) error {
	if e.TriggerType == "unknown" {
		return nil
	}
	if err := d.allow(); err != nil {
		return err
	}

	reqBody := core.TriggerRequest{TenantID: e.TenantID, Source: e.Provider, Type: e.TriggerType, Payload: e.Raw}
	raw, _ := json.Marshal(reqBody)

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.RunnerURL+"/internal/v1/triggers", bytes.NewReader(raw))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		if corr.TraceID != "" {
			req.Header.Set("traceparent", "00-"+corr.TraceID+"-0000000000000001-01")
		}
		if corr.RequestID != "" {
			req.Header.Set("X-Request-ID", corr.RequestID)
		}
		if corr.SessionID != "" {
			req.Header.Set("X-Session-ID", corr.SessionID)
		}
		if corr.RunID != "" {
			req.Header.Set("X-Run-ID", corr.RunID)
		}
		if corr.AgentID != "" {
			req.Header.Set("X-Agent-ID", corr.AgentID)
		}
		if corr.SpawnID != "" {
			req.Header.Set("X-Spawn-ID", corr.SpawnID)
		}
		if corr.NodeID != "" {
			req.Header.Set("X-Node-ID", corr.NodeID)
		}

		resp, err := d.Client.Do(req)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode < 300 {
				d.markSuccess()
				return nil
			}
			err = fmt.Errorf("runner trigger failed with status %d", resp.StatusCode)
		}
		lastErr = err
		if attempt < 2 {
			time.Sleep(backoff(attempt))
		}
	}
	d.markFailure()
	return lastErr
}

func backoff(attempt int) time.Duration {
	base := []time.Duration{100 * time.Millisecond, 300 * time.Millisecond, 700 * time.Millisecond}
	// Use deterministic jitter derived from attempt number
	jitter := time.Duration(deterministicJitterInt(attempt, 50)) * time.Millisecond
	return base[attempt] + jitter
}

// deterministicJitterInt generates a deterministic jitter value in range [0, max) from an attempt number.
func deterministicJitterInt(attempt, max int) int {
	h := sha256.Sum256([]byte{byte(attempt), byte(attempt >> 8), byte(attempt >> 16), byte(attempt >> 24)})
	seed := int64(0)
	for i := 0; i < 8; i++ {
		seed = seed*256 + int64(h[i])
	}
	rng := rand.New(rand.NewSource(seed))
	return rng.Intn(max)
}

func (d *TriggerDispatcher) allow() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if time.Now().Before(d.circuitUntil) {
		return errors.New("trigger dispatcher circuit open")
	}
	return nil
}

func (d *TriggerDispatcher) markSuccess() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.consecutiveFails = 0
	d.circuitUntil = time.Time{}
}

func (d *TriggerDispatcher) markFailure() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.consecutiveFails++
	if d.consecutiveFails >= 5 {
		d.circuitUntil = time.Now().Add(20 * time.Second)
		d.consecutiveFails = 0
	}
}
