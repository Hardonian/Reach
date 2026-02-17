package autonomous

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/storage"
)

type fakeEngine struct {
	results []StepResult
	errs    []error
	i       int
}

func (f *fakeEngine) Plan(_ context.Context, _ string, _ int) (StepPlan, error) {
	return StepPlan{ToolName: "t", Input: map[string]any{}}, nil
}

func (f *fakeEngine) Execute(_ context.Context, _ StepPlan) (StepResult, error) {
	idx := f.i
	f.i++
	if idx < len(f.errs) && f.errs[idx] != nil {
		return StepResult{}, f.errs[idx]
	}
	if idx < len(f.results) {
		return f.results[idx], nil
	}
	return StepResult{Success: true, Progressed: true}, nil
}

func newStore(t *testing.T) *jobs.Store {
	db, err := storage.NewSQLiteStore(filepath.Join(t.TempDir(), "runner.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	return jobs.NewStore(db)
}

func seedRun(t *testing.T, store *jobs.Store) string {
	r, err := store.CreateRun(context.Background(), "tenant-a", []string{"tool:safe"})
	if err != nil {
		t.Fatal(err)
	}
	return r.ID
}

func TestIterationCapEnforced(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{}, NoProgressLimit: 10}
	session := &jobs.AutonomousSession{Goal: "g", MaxIterations: 2, MaxToolCalls: 10, MaxRuntime: time.Minute, StartedAt: time.Now().UTC()}
	reason := loop.Run(context.Background(), "tenant-a", runID, session)
	if reason != ReasonMaxIterations {
		t.Fatalf("expected %s got %s", ReasonMaxIterations, reason)
	}
}

func TestNoProgressStop(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{results: []StepResult{{Success: true, Progressed: false}, {Success: true, Progressed: false}}}, NoProgressLimit: 2}
	session := &jobs.AutonomousSession{Goal: "g", MaxIterations: 10, MaxToolCalls: 10, MaxRuntime: time.Minute, StartedAt: time.Now().UTC()}
	reason := loop.Run(context.Background(), "tenant-a", runID, session)
	if reason != ReasonNoProgress {
		t.Fatalf("expected %s got %s", ReasonNoProgress, reason)
	}
}

func TestRuntimeCapEnforced(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{results: []StepResult{{Success: true, Progressed: true}}}}
	session := &jobs.AutonomousSession{Goal: "g", MaxIterations: 10, MaxToolCalls: 10, MaxRuntime: time.Millisecond, StartedAt: time.Now().Add(-time.Second)}
	reason := loop.Run(context.Background(), "tenant-a", runID, session)
	if reason != ReasonMaxRuntime {
		t.Fatalf("expected %s got %s", ReasonMaxRuntime, reason)
	}
}

func TestCheckpointCreated(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{results: []StepResult{{Success: true, Progressed: true, Done: true, Summary: "done"}}}}
	session := &jobs.AutonomousSession{Goal: "g", MaxIterations: 10, MaxToolCalls: 10, MaxRuntime: time.Minute, StartedAt: time.Now().UTC()}
	reason := loop.Run(context.Background(), "tenant-a", runID, session)
	if reason != ReasonDone {
		t.Fatalf("expected done got %s", reason)
	}
	events, err := store.EventHistory(context.Background(), "tenant-a", runID, 0)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, e := range events {
		if e.Type == "autonomous.checkpoint" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected autonomous.checkpoint event")
	}
}

func TestManualStopViaCancel(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{errs: []error{errors.New("boom"), errors.New("boom")}}, RepeatedFailureLimit: 10, NoProgressLimit: 10}
	session := &jobs.AutonomousSession{Goal: "g", MaxIterations: 100, MaxToolCalls: 100, MaxRuntime: time.Minute, StartedAt: time.Now().UTC()}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	reason := loop.Run(ctx, "tenant-a", runID, session)
	if reason != ReasonContextCanceled {
		t.Fatalf("expected %s got %s", ReasonContextCanceled, reason)
	}
}
