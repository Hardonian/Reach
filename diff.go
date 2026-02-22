package determinism

import (
	"fmt"
	"reflect"
	"strings"
)

type RunDiff struct {
	MismatchFound bool
	Diffs         []string
}

func (d RunDiff) FormatDiff() string {
	if !d.MismatchFound {
		return "Runs are identical.\n"
	}
	return fmt.Sprintf("Found %d differences:\n%s\n", len(d.Diffs), strings.Join(d.Diffs, "\n"))
}

func DiffRuns(a, b map[string]any) RunDiff {
	diffs := []string{}
	compareMap("", a, b, &diffs)
	return RunDiff{
		MismatchFound: len(diffs) > 0,
		Diffs:         diffs,
	}
}

func compareMap(path string, a, b map[string]any, diffs *[]string) {
	for k, va := range a {
		vb, ok := b[k]
		if !ok {
			*diffs = append(*diffs, fmt.Sprintf("Missing key in B: %s%s", path, k))
			continue
		}
		compareValue(fmt.Sprintf("%s%s.", path, k), va, vb, diffs)
	}
	for k := range b {
		if _, ok := a[k]; !ok {
			*diffs = append(*diffs, fmt.Sprintf("Missing key in A: %s%s", path, k))
		}
	}
}

func compareValue(path string, a, b any, diffs *[]string) {
	if reflect.TypeOf(a) != reflect.TypeOf(b) {
		*diffs = append(*diffs, fmt.Sprintf("Type mismatch at %s: %T vs %T", path, a, b))
		return
	}
	switch va := a.(type) {
	case map[string]any:
		compareMap(path, va, b.(map[string]any), diffs)
	case []any:
		compareSlice(path, va, b.([]any), diffs)
	default:
		if !reflect.DeepEqual(a, b) {
			*diffs = append(*diffs, fmt.Sprintf("Value mismatch at %s: %v vs %v", path, a, b))
		}
	}
}

func compareSlice(path string, a, b []any, diffs *[]string) {
	if len(a) != len(b) {
		*diffs = append(*diffs, fmt.Sprintf("Length mismatch at %s: %d vs %d", path, len(a), len(b)))
		return
	}
	for i := range a {
		compareValue(fmt.Sprintf("%s[%d]", path, i), a[i], b[i], diffs)
	}
}
