package resolver

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"reach/internal/packkit/registry"
)

type ResolvedPackage struct {
	ID string
	registry.PackageVersion
}

type version struct {
	major, minor, patch int
}

type cachedKey struct {
	id         string
	constraint string
}

var (
	cache   sync.Map
	verPool = sync.Pool{
		New: func() interface{} {
			return &version{}
		},
	}
)

func ResolvePackage(id, versionConstraint string, idx registry.Index) (ResolvedPackage, error) {
	key := cachedKey{id: id, constraint: versionConstraint}
	if cached, ok := cache.Load(key); ok {
		return cached.(ResolvedPackage), nil
	}

	var match *ResolvedPackage
	for _, p := range idx.Packages {
		if p.ID != id {
			continue
		}
		for _, v := range p.Versions {
			if !matchesConstraint(v.Version, versionConstraint) {
				continue
			}
			candidate := ResolvedPackage{ID: id, PackageVersion: v}
			if match == nil || compareVersion(candidate.Version, match.Version) > 0 {
				copyPkg := candidate
				match = &copyPkg
			}
		}
	}
	if match == nil {
		return ResolvedPackage{}, fmt.Errorf("package not found: %s %s", id, versionConstraint)
	}
	cache.Store(key, *match)
	return *match, nil
}

func matchesConstraint(version, constraint string) bool {
	if constraint == "" || constraint == ">=0.0.0" {
		return true
	}
	if strings.HasPrefix(constraint, "=") {
		return strings.TrimPrefix(constraint, "=") == version
	}
	if strings.HasPrefix(constraint, ">=") {
		return compareVersion(version, strings.TrimPrefix(constraint, ">=")) >= 0
	}
	return version == constraint
}

func compareVersion(a, b string) int {
	va := parseVersion(a)
	vb := parseVersion(b)
	if va.major != vb.major {
		if va.major > vb.major {
			return 1
		}
		return -1
	}
	if va.minor != vb.minor {
		if va.minor > vb.minor {
			return 1
		}
		return -1
	}
	if va.patch != vb.patch {
		if va.patch > vb.patch {
			return 1
		}
		return -1
	}
	return 0
}

func parseVersion(s string) *version {
	v := verPool.Get().(*version)
	v.major, v.minor, v.patch = 0, 0, 0

	parts := strings.SplitN(s, ".", 3)
	if len(parts) > 0 {
		v.major, _ = strconv.Atoi(parts[0])
	}
	if len(parts) > 1 {
		v.minor, _ = strconv.Atoi(parts[1])
	}
	if len(parts) > 2 {
		v.patch, _ = strconv.Atoi(parts[2])
	}
	return v
}
