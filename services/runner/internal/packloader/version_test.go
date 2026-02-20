package packloader

import (
	"testing"
)

func TestParseSemVer_Valid(t *testing.T) {
	tests := []struct {
		input    string
		expected SemVer
	}{
		{"1.0.0", SemVer{1, 0, 0, "", ""}},
		{"2.3.4", SemVer{2, 3, 4, "", ""}},
		{"0.1.0", SemVer{0, 1, 0, "", ""}},
		{"1.0.0-alpha", SemVer{1, 0, 0, "alpha", ""}},
		{"1.0.0-beta.1", SemVer{1, 0, 0, "beta.1", ""}},
		{"1.0.0+build.123", SemVer{1, 0, 0, "", "build.123"}},
		{"1.0.0-rc.1+build", SemVer{1, 0, 0, "rc.1", "build"}},
	}

	for _, tt := range tests {
		v, err := ParseSemVer(tt.input)
		if err != nil {
			t.Errorf("ParseSemVer(%q) error: %v", tt.input, err)
			continue
		}
		if v != tt.expected {
			t.Errorf("ParseSemVer(%q) = %+v, want %+v", tt.input, v, tt.expected)
		}
	}
}

func TestParseSemVer_Invalid(t *testing.T) {
	tests := []string{
		"",
		"abc",
		"-1.0.0",
		"1.0.0.0",
	}
	for _, s := range tests {
		_, err := ParseSemVer(s)
		if err == nil {
			t.Errorf("ParseSemVer(%q) should have failed", s)
		}
	}
}

func TestSemVer_String(t *testing.T) {
	v := SemVer{1, 2, 3, "alpha", "build"}
	if s := v.String(); s != "1.2.3-alpha+build" {
		t.Errorf("String() = %q, want %q", s, "1.2.3-alpha+build")
	}
}

func TestSemVer_Compare(t *testing.T) {
	tests := []struct {
		a, b     string
		expected int
	}{
		{"1.0.0", "1.0.0", 0},
		{"1.0.1", "1.0.0", 1},
		{"1.0.0", "1.0.1", -1},
		{"2.0.0", "1.9.9", 1},
		{"1.1.0", "1.0.9", 1},
		{"1.0.0", "1.0.0-alpha", 1},    // release > prerelease
		{"1.0.0-alpha", "1.0.0", -1},    // prerelease < release
		{"1.0.0-alpha", "1.0.0-beta", -1},
	}

	for _, tt := range tests {
		a, _ := ParseSemVer(tt.a)
		b, _ := ParseSemVer(tt.b)
		got := a.Compare(b)
		if got != tt.expected {
			t.Errorf("Compare(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.expected)
		}
	}
}

func TestSemVer_IsCompatibleWith(t *testing.T) {
	tests := []struct {
		a, b     string
		expected bool
	}{
		{"1.2.0", "1.0.0", true},  // same major, higher minor
		{"1.0.0", "1.0.0", true},  // exact match
		{"2.0.0", "1.0.0", false}, // different major
		{"1.0.0", "1.1.0", false}, // lower minor
	}

	for _, tt := range tests {
		a, _ := ParseSemVer(tt.a)
		b, _ := ParseSemVer(tt.b)
		got := a.IsCompatibleWith(b)
		if got != tt.expected {
			t.Errorf("IsCompatibleWith(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.expected)
		}
	}
}

func TestParseConstraint_Exact(t *testing.T) {
	c, err := ParseConstraint("1.2.3")
	if err != nil {
		t.Fatal(err)
	}
	if c.Exact != "1.2.3" {
		t.Errorf("expected exact=1.2.3, got %s", c.Exact)
	}
}

func TestParseConstraint_Caret(t *testing.T) {
	c, err := ParseConstraint("^1.2.3")
	if err != nil {
		t.Fatal(err)
	}
	if c.MinVersion != "1.2.3" {
		t.Errorf("expected min=1.2.3, got %s", c.MinVersion)
	}
	if c.MaxVersion != "2.0.0" {
		t.Errorf("expected max=2.0.0, got %s", c.MaxVersion)
	}
}

func TestParseConstraint_GreaterEqual(t *testing.T) {
	c, err := ParseConstraint(">=1.0.0")
	if err != nil {
		t.Fatal(err)
	}
	if c.MinVersion != "1.0.0" {
		t.Errorf("expected min=1.0.0, got %s", c.MinVersion)
	}
}

func TestConstraint_Satisfies(t *testing.T) {
	tests := []struct {
		constraint string
		version    string
		expected   bool
	}{
		{"1.0.0", "1.0.0", true},
		{"1.0.0", "1.0.1", false},
		{"^1.2.0", "1.2.0", true},
		{"^1.2.0", "1.3.0", true},
		{"^1.2.0", "1.9.9", true},
		{"^1.2.0", "2.0.0", false},
		{"^1.2.0", "1.1.0", false},
		{">=1.0.0", "1.0.0", true},
		{">=1.0.0", "2.0.0", true},
		{">=1.0.0", "0.9.0", false},
	}

	for _, tt := range tests {
		c, err := ParseConstraint(tt.constraint)
		if err != nil {
			t.Fatalf("ParseConstraint(%q): %v", tt.constraint, err)
		}
		got, err := c.Satisfies(tt.version)
		if err != nil {
			t.Fatalf("Satisfies(%q, %q): %v", tt.constraint, tt.version, err)
		}
		if got != tt.expected {
			t.Errorf("Satisfies(%q, %q) = %v, want %v", tt.constraint, tt.version, got, tt.expected)
		}
	}
}

func TestVersionResolver_Resolve(t *testing.T) {
	r := NewVersionResolver()
	r.AddVersion("my-pack", "1.0.0")
	r.AddVersion("my-pack", "1.1.0")
	r.AddVersion("my-pack", "1.2.0")
	r.AddVersion("my-pack", "2.0.0")

	// Exact
	v, err := r.Resolve("my-pack", VersionConstraint{Exact: "1.1.0"})
	if err != nil {
		t.Fatal(err)
	}
	if v != "1.1.0" {
		t.Errorf("expected 1.1.0, got %s", v)
	}

	// Caret (highest 1.x)
	c, _ := ParseConstraint("^1.0.0")
	v, err = r.Resolve("my-pack", c)
	if err != nil {
		t.Fatal(err)
	}
	if v != "1.2.0" {
		t.Errorf("expected 1.2.0, got %s", v)
	}

	// Min version
	v, err = r.Resolve("my-pack", VersionConstraint{MinVersion: "1.1.0"})
	if err != nil {
		t.Fatal(err)
	}
	if v != "2.0.0" {
		t.Errorf("expected 2.0.0 (highest >= 1.1.0), got %s", v)
	}
}

func TestVersionResolver_NotFound(t *testing.T) {
	r := NewVersionResolver()
	_, err := r.Resolve("missing", VersionConstraint{Exact: "1.0.0"})
	if err == nil {
		t.Error("expected error for missing pack")
	}
}

func TestVersionResolver_NoMatch(t *testing.T) {
	r := NewVersionResolver()
	r.AddVersion("my-pack", "1.0.0")

	_, err := r.Resolve("my-pack", VersionConstraint{Exact: "2.0.0"})
	if err == nil {
		t.Error("expected error for no matching version")
	}
}

func TestVersionResolver_SortedOrder(t *testing.T) {
	r := NewVersionResolver()
	// Add out of order
	r.AddVersion("my-pack", "1.2.0")
	r.AddVersion("my-pack", "1.0.0")
	r.AddVersion("my-pack", "1.1.0")

	// Resolve caret should still pick highest 1.x
	c, _ := ParseConstraint("^1.0.0")
	v, err := r.Resolve("my-pack", c)
	if err != nil {
		t.Fatal(err)
	}
	if v != "1.2.0" {
		t.Errorf("expected 1.2.0, got %s", v)
	}
}
