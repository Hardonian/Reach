package router

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"reach/services/integration-hub/internal/core"
)

type TriggerDispatcher struct {
	RunnerURL string
	Client    *http.Client
}

func NewTriggerDispatcher(runnerURL string) *TriggerDispatcher {
	return &TriggerDispatcher{RunnerURL: runnerURL, Client: &http.Client{Timeout: 5 * time.Second}}
}

func (d *TriggerDispatcher) Dispatch(e core.NormalizedEvent) error {
	if e.TriggerType == "unknown" {
		return nil
	}
	reqBody := core.TriggerRequest{
		TenantID: e.TenantID,
		Source:   e.Provider,
		Type:     e.TriggerType,
		Payload:  e.Raw,
	}
	raw, _ := json.Marshal(reqBody)
	resp, err := d.Client.Post(d.RunnerURL+"/internal/v1/triggers", "application/json", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("runner trigger failed with status %d", resp.StatusCode)
	}
	return nil
}
