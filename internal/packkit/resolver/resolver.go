package resolver

import (
	"fmt"
	"strconv"
	"strings"

	"reach/internal/packkit/registry"
)

func ResolvePackage(id, versionConstraint string, idx registry.Index) (registry.PackageRef, error) {
	var match *registry.PackageRef
	for i := range idx.Packages {
		pkg := idx.Packages[i]
		if pkg.ID != id || !matchesConstraint(pkg.Version, versionConstraint) {
			continue
		}
		if match == nil || compareVersion(pkg.Version, match.Version) > 0 {
			copyPkg := pkg
			match = &copyPkg
		}
	}
	if match == nil {
		return registry.PackageRef{}, fmt.Errorf("package not found: %s %s", id, versionConstraint)
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
