package packloader

import (
	"fmt"
	"strconv"
	"strings"
)

// SemVer represents a parsed semantic version.
type SemVer struct {
	Major      int
	Minor      int
	Patch      int
	Prerelease string
	Build      string
}

// ParseSemVer parses a semver string into its components.
func ParseSemVer(s string) (SemVer, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return SemVer{}, fmt.Errorf("empty version string")
	}

	var v SemVer

	// Split off build metadata
	if idx := strings.Index(s, "+"); idx >= 0 {
		v.Build = s[idx+1:]
		s = s[:idx]
	}

	// Split off prerelease
	if idx := strings.Index(s, "-"); idx >= 0 {
		v.Prerelease = s[idx+1:]
		s = s[:idx]
	}

	parts := strings.Split(s, ".")
	if len(parts) < 1 || len(parts) > 3 {
		return SemVer{}, fmt.Errorf("invalid version format: expected major.minor.patch")
	}

	var err error
	v.Major, err = strconv.Atoi(parts[0])
	if err != nil || v.Major < 0 {
		return SemVer{}, fmt.Errorf("invalid major version: %s", parts[0])
	}

	if len(parts) >= 2 {
		v.Minor, err = strconv.Atoi(parts[1])
		if err != nil || v.Minor < 0 {
			return SemVer{}, fmt.Errorf("invalid minor version: %s", parts[1])
		}
	}

	if len(parts) >= 3 {
		v.Patch, err = strconv.Atoi(parts[2])
		if err != nil || v.Patch < 0 {
			return SemVer{}, fmt.Errorf("invalid patch version: %s", parts[2])
		}
	}

	return v, nil
}

// String returns the canonical semver string.
func (v SemVer) String() string {
	s := fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
	if v.Prerelease != "" {
		s += "-" + v.Prerelease
	}
	if v.Build != "" {
		s += "+" + v.Build
	}
	return s
}

// Compare returns -1, 0, or 1.
func (v SemVer) Compare(other SemVer) int {
	if v.Major != other.Major {
		return cmpInt(v.Major, other.Major)
	}
	if v.Minor != other.Minor {
		return cmpInt(v.Minor, other.Minor)
	}
	if v.Patch != other.Patch {
		return cmpInt(v.Patch, other.Patch)
	}
	// Prerelease versions have lower precedence than release
	if v.Prerelease == "" && other.Prerelease != "" {
		return 1
	}
	if v.Prerelease != "" && other.Prerelease == "" {
		return -1
	}
	if v.Prerelease != other.Prerelease {
		if v.Prerelease < other.Prerelease {
			return -1
		}
		return 1
	}
	return 0
}

// IsCompatibleWith checks if this version is backwards-compatible with other
// (same major version, >= minor.patch).
func (v SemVer) IsCompatibleWith(other SemVer) bool {
	return v.Major == other.Major && v.Compare(other) >= 0
}

func cmpInt(a, b int) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

// VersionConstraint represents a version requirement.
type VersionConstraint struct {
	Exact      string // Exact version pin: "1.2.3"
	MinVersion string // Minimum version: ">=1.2.0"
	MaxVersion string // Maximum version: "<2.0.0"
}

// ParseConstraint parses a version constraint string.
// Supports: "1.2.3" (exact), "^1.2.3" (compatible), ">=1.0.0" (minimum).
func ParseConstraint(s string) (VersionConstraint, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return VersionConstraint{}, fmt.Errorf("empty constraint")
	}

	switch {
	case strings.HasPrefix(s, "^"):
		// Caret: compatible with version (same major)
		ver, err := ParseSemVer(s[1:])
		if err != nil {
			return VersionConstraint{}, err
		}
		return VersionConstraint{
			MinVersion: ver.String(),
			MaxVersion: fmt.Sprintf("%d.0.0", ver.Major+1),
		}, nil
	case strings.HasPrefix(s, ">="):
		ver := strings.TrimPrefix(s, ">=")
		if _, err := ParseSemVer(ver); err != nil {
			return VersionConstraint{}, err
		}
		return VersionConstraint{MinVersion: ver}, nil
	default:
		// Exact pin
		if _, err := ParseSemVer(s); err != nil {
			return VersionConstraint{}, err
		}
		return VersionConstraint{Exact: s}, nil
	}
}

// Satisfies checks if a version satisfies this constraint.
func (c VersionConstraint) Satisfies(version string) (bool, error) {
	v, err := ParseSemVer(version)
	if err != nil {
		return false, err
	}

	if c.Exact != "" {
		exact, err := ParseSemVer(c.Exact)
		if err != nil {
			return false, err
		}
		return v.Compare(exact) == 0, nil
	}

	if c.MinVersion != "" {
		min, err := ParseSemVer(c.MinVersion)
		if err != nil {
			return false, err
		}
		if v.Compare(min) < 0 {
			return false, nil
		}
	}

	if c.MaxVersion != "" {
		max, err := ParseSemVer(c.MaxVersion)
		if err != nil {
			return false, err
		}
		if v.Compare(max) >= 0 {
			return false, nil
		}
	}

	return true, nil
}

// VersionResolver provides deterministic version resolution for pack dependencies.
type VersionResolver struct {
	// available maps pack ID -> list of available versions (sorted ascending)
	available map[string][]string
}

// NewVersionResolver creates a new resolver.
func NewVersionResolver() *VersionResolver {
	return &VersionResolver{
		available: make(map[string][]string),
	}
}

// AddVersion registers an available version for a pack.
func (r *VersionResolver) AddVersion(packID, version string) error {
	if _, err := ParseSemVer(version); err != nil {
		return fmt.Errorf("invalid version for %s: %w", packID, err)
	}
	r.available[packID] = append(r.available[packID], version)
	r.sortVersions(packID)
	return nil
}

// Resolve finds the best version matching a constraint.
// For determinism, it always picks the highest version satisfying the constraint.
func (r *VersionResolver) Resolve(packID string, constraint VersionConstraint) (string, error) {
	versions, ok := r.available[packID]
	if !ok {
		return "", fmt.Errorf("pack %s not found in resolver", packID)
	}

	// Iterate from highest to lowest
	for i := len(versions) - 1; i >= 0; i-- {
		sat, err := constraint.Satisfies(versions[i])
		if err != nil {
			continue
		}
		if sat {
			return versions[i], nil
		}
	}

	return "", fmt.Errorf("no version of %s satisfies constraint", packID)
}

// sortVersions sorts versions for a pack in ascending order.
func (r *VersionResolver) sortVersions(packID string) {
	versions := r.available[packID]
	for i := 1; i < len(versions); i++ {
		for j := i; j > 0; j-- {
			a, _ := ParseSemVer(versions[j-1])
			b, _ := ParseSemVer(versions[j])
			if a.Compare(b) > 0 {
				versions[j-1], versions[j] = versions[j], versions[j-1]
			}
		}
	}
}
