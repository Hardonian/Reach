package spec

import (
	"strings"
	"testing"
)

func TestVersion(t *testing.T) {
	if Version != "1.0.0" {
		t.Errorf("expected Version '1.0.0', got %s", Version)
	}
}

func TestIsCompatible(t *testing.T) {
	tests := []struct {
		version  string
		expected bool
	}{
		{"1.0.0", true},
		{"1.1.0", true},
		{"1.0.5", true},
		{"2.0.0", false},
		{"0.9.0", false},
		{"1.0.0-alpha", true}, // major is still 1
		{"", false},
		{"  ", false},
		{"1", true},
		{"invalid", false},
	}

	for _, tt := range tests {
		got := IsCompatible(tt.version)
		if got != tt.expected {
			t.Errorf("IsCompatible(%q) = %v, want %v", tt.version, got, tt.expected)
		}
	}
}

func TestCompatibleError(t *testing.T) {
	tests := []struct {
		version string
		wantErr bool
	}{
		{"1.0.0", false},
		{"1.5.0", false},
		{"2.0.0", true},
		{"0.9.0", true},
		{"", true},
		{"  ", true},
		{"invalid.version.string", true},
		{"not-a-version", true},
		{"-1.0.0", true},
	}

	for _, tt := range tests {
		err := CompatibleError(tt.version)
		if tt.wantErr && err == nil {
			t.Errorf("CompatibleError(%q) expected error, got nil", tt.version)
		}
		if !tt.wantErr && err != nil {
			t.Errorf("CompatibleError(%q) expected no error, got %v", tt.version, err)
		}
	}
}

func TestCompatibleErrorMessages(t *testing.T) {
	// Test empty version
	err := CompatibleError("")
	if err == nil {
		t.Error("expected error for empty version")
	}
	if !strings.Contains(err.Error(), "required") {
		t.Errorf("expected 'required' in error, got: %s", err.Error())
	}

	// Test whitespace version
	err = CompatibleError("   ")
	if err == nil {
		t.Error("expected error for whitespace version")
	}
	if !strings.Contains(err.Error(), "required") {
		t.Errorf("expected 'required' in error, got: %s", err.Error())
	}

	// Test major version mismatch
	err = CompatibleError("2.0.0")
	if err == nil {
		t.Error("expected error for major version mismatch")
	}
	if !strings.Contains(err.Error(), "incompatible") {
		t.Errorf("expected 'incompatible' in error, got: %s", err.Error())
	}
	if !strings.Contains(err.Error(), "expected major 1") {
		t.Errorf("expected 'expected major 1' in error, got: %s", err.Error())
	}

	// Test invalid version format
	err = CompatibleError("abc")
	if err == nil {
		t.Error("expected error for invalid version")
	}
	if !strings.Contains(err.Error(), "invalid") {
		t.Errorf("expected 'invalid' in error, got: %s", err.Error())
	}

	// Test negative version
	err = CompatibleError("-1.0.0")
	if err == nil {
		t.Error("expected error for negative version")
	}
}

func TestMajor(t *testing.T) {
	tests := []struct {
		version string
		want    int
		wantErr bool
	}{
		{"1.0.0", 1, false},
		{"2.5.3", 2, false},
		{"10.0.0", 10, false},
		{"0.1.0", 0, false},
		{"1", 1, false},
		{"42", 42, false},
		{"", 0, true},
		{".1.0", 0, true},
		{"abc", 0, true},
		{"-1.0.0", 0, true},
		{"-5", 0, true},
		{"  2  ", 2, false},
		{"3.0.0-beta", 3, false},
	}

	for _, tt := range tests {
		got, err := major(tt.version)
		if tt.wantErr {
			if err == nil {
				t.Errorf("major(%q) expected error, got nil", tt.version)
			}
			continue
		}
		if err != nil {
			t.Errorf("major(%q) unexpected error: %v", tt.version, err)
			continue
		}
		if got != tt.want {
			t.Errorf("major(%q) = %d, want %d", tt.version, got, tt.want)
		}
	}
}

func TestCompatibleWithRunnerVersion(t *testing.T) {
	// Test that our current Version is compatible with itself
	if !IsCompatible(Version) {
		t.Error("Version should be compatible with itself")
	}

	err := CompatibleError(Version)
	if err != nil {
		t.Errorf("Version should not produce compatibility error: %v", err)
	}
}

func BenchmarkIsCompatible(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsCompatible("1.5.0")
	}
}

func BenchmarkCompatibleError(b *testing.B) {
	for i := 0; i < b.N; i++ {
		CompatibleError("1.5.0")
	}
}
