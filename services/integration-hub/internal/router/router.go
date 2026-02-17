package router

import (
	"bytes"
	"context"
	"encoding/json"
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
	return &TriggerDispatcher{RunnerURL: runnerURL, Client: &http.Client{Timeout: 5 * time.Second}}
}

func (d *TriggerDispatcher) Dispatch(ctx context.Context, e core.NormalizedEvent, corr Correlation) error {
	if e.TriggerType == "unknown" {
		return nil
	}
	if err := d.circuitCheck(); err != nil {
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
		req.Header.Set("X-Request-ID", corr.RequestID)
		req.Header.Set("X-Session-ID", corr.SessionID)
		req.Header.Set("X-Run-ID", corr.RunID)
		req.Header.Set("X-Agent-ID", corr.AgentID)
		req.Header.Set("X-Spawn-ID", corr.SpawnID)
		req.Header.Set("X-Node-ID", corr.NodeID)

		resp, err := d.Client.Do(req)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode < 300 {
				d.recordSuccess()
				return nil
			}
			err = fmt.Errorf("runner trigger failed with status %d", resp.StatusCode)
		}
		lastErr = err
		time.Sleep(backoff(attempt))
	}
	d.recordFailure()
	return lastErr
}

func backoff(attempt int) time.Duration {
	base := []time.Duration{100 * time.Millisecond, 300 * time.Millisecond, 700 * time.Millisecond}
	jitter := time.Duration(rand.Intn(50)) * time.Millisecond
	return base[attempt] + jitter
}

func (d *TriggerDispatcher) circuitCheck() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if time.Now().Before(d.circuitUntil) {
		return fmt.Errorf("trigger dispatcher circuit open until %s", d.circuitUntil.Format(time.RFC3339))
	}
	return nil
}

func (d *TriggerDispatcher) recordFailure() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.consecutiveFails++
	if d.consecutiveFails >= 5 {
		d.circuitUntil = time.Now().Add(30 * time.Second)
		d.consecutiveFails = 0
	}
}

func (d *TriggerDispatcher) recordSuccess() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.consecutiveFails = 0
	d.circuitUntil = time.Time{}
}
