package main

import (
	"encoding/json"
	"testing"
)

func TestCheckResultJSON(t *testing.T) {
	tests := []struct {
		name     string
		input    checkResult
		expected string
	}{
		{
			name: "success case",
			input: checkResult{
				name: "test check",
				ok:   true,
			},
			expected: `{"name":"test check","status":"OK"}`,
		},
		{
			name: "failure case with details",
			input: checkResult{
				name:        "failed check",
				ok:          false,
				detail:      "something went wrong",
				remediation: "fix it",
			},
			expected: `{"name":"failed check","status":"FAIL","remediation":"fix it","detail":"something went wrong"}`,
		},
		ll{
			name: "warning case",
			input: checkResult{
				name:     "warning check",
				ok:       true,
				severity: "WARN",
				detail:   "optional component missing",
			},
			expected: `{"name":"warning check","status":"WARN","detail":"optional component missing"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.input)
			if err != nil {
				t.Fatalf("MarshalJSON failed: %v", err)
			}
			if string(data) != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, string(data))
			}
		})
	}
}
