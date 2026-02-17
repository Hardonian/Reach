package router

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"reach/services/integration-hub/internal/core"
)

type TriggerDispatcher struct {
	RunnerURL string
	Client    *http.Client

	mu               sync.Mutex
	consecutiveFails int
	openUntil        time.Time
}

func NewTriggerDispatcher(runnerURL string) *TriggerDispatcher {
	return &TriggerDispatcher{RunnerURL: runnerURL, Client: &http.Client{Timeout: 3 * time.Second}}
}

func (d *TriggerDispatcher) Dispatch(ctx context.Context, correlationID string, e core.NormalizedEvent) error {
	if e.TriggerType == "unknown" {
		return nil
	}
	if err := d.allow(); err != nil {
		return err
	}
	reqBody := core.TriggerRequest{
		TenantID: e.TenantID,
		Source:   e.Provider,
		Type:     e.TriggerType,
		Payload:  e.Raw,
	}
	raw, _ := json.Marshal(reqBody)

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, d.RunnerURL+"/internal/v1/triggers", bytes.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		if correlationID != "" {
			req.Header.Set("X-Correlation-ID", correlationID)
		}
		resp, err := d.Client.Do(req)
		if err == nil && resp.StatusCode < 300 {
			resp.Body.Close()
			d.markSuccess()
			return nil
		}
		if resp != nil {
			resp.Body.Close()
			err = fmt.Errorf("runner trigger failed with status %d", resp.StatusCode)
		}
		lastErr = err
		if attempt < 2 {
			time.Sleep(time.Duration(100*(1<<attempt)) * time.Millisecond)
		}
	}
	d.markFailure()
	return lastErr
}

func (d *TriggerDispatcher) allow() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if time.Now().Before(d.openUntil) {
		return errors.New("trigger dispatcher circuit open")
	}
	return nil
}

func (d *TriggerDispatcher) markSuccess() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.consecutiveFails = 0
	d.openUntil = time.Time{}
}

func (d *TriggerDispatcher) markFailure() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.consecutiveFails++
	if d.consecutiveFails >= 5 {
		d.openUntil = time.Now().Add(20 * time.Second)
		d.consecutiveFails = 0
	}
}
