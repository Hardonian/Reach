package jobs

import (
	"encoding/json"
	"errors"
	"fmt"
)

const protocolSchemaVersion = "1.0.0"

var errInvalidEventPayload = errors.New("invalid event payload")

func validateAndNormalizeEventPayload(eventType string, payload []byte) ([]byte, error) {
	if eventType == "replay.event" {
		if !json.Valid(payload) {
			return nil, fmt.Errorf("%w: replay.event must be valid json", errInvalidEventPayload)
		}
		return payload, nil
	}

	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		return nil, fmt.Errorf("%w: payload must be a json object: %v", errInvalidEventPayload, err)
	}

	if version, ok := body["schemaVersion"].(string); !ok || version == "" {
		body["schemaVersion"] = protocolSchemaVersion
	} else if version != protocolSchemaVersion {
		return nil, fmt.Errorf("%w: schemaVersion must be %s", errInvalidEventPayload, protocolSchemaVersion)
	}

	if err := validatePayloadByType(eventType, body); err != nil {
		return nil, err
	}

	normalized, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal normalized payload: %v", errInvalidEventPayload, err)
	}
	return normalized, nil
}

func validatePayloadByType(eventType string, payload map[string]any) error {
	required := map[string][]string{
		"spawn.event":           {"spawnId", "sessionId", "goal", "depth", "status"},
		"guardrail.stop":        {"reason", "triggeredBy", "runId"},
		"session.started":       {"sessionId", "tenantId", "status", "startedAt", "members"},
		"capsule.sync":          {"capsuleId", "session", "spawn", "syncState", "updatedAt"},
		"policy.gate.requested": {"gate_id", "reason"},
		"policy.gate.resolved":  {"gate_id", "decision"},
		"policy.gate.stored":    {"id", "tool", "reason"},
	}
	for _, key := range required[eventType] {
		if _, ok := payload[key]; !ok {
			return fmt.Errorf("%w: %s requires %s", errInvalidEventPayload, eventType, key)
		}
	}
	return nil
}
