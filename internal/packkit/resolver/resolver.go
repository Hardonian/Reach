package resolver

import (
	"fmt"
	"strconv"
	"strings"

	"reach/internal/packkit/registry"
)

type ResolvedPackage struct {
	ID string
	registry.PackageVersion
}

func ResolvePackage(id, versionConstraint string, idx registry.Index) (ResolvedPackage, error) {
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
	as := strings.Split(a, ".")
	bs := strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		ai := part(as, i)
		bi := part(bs, i)
		if ai > bi {
			return 1
		}
		if ai < bi {
			return -1
		}
	}
	return 0
}

func part(parts []string, i int) int {
	if len(parts) <= i {
		return 0
	}
	v, _ := strconv.Atoi(parts[i])
	return v
}
