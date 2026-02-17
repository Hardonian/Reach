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

type sequenceSignals struct {
	list []RuntimeSignals
	i    int
}

func (s *sequenceSignals) Signals(context.Context, jobs.AutonomousSession) RuntimeSignals {
	if len(s.list) == 0 {
		return RuntimeSignals{NetworkAvailable: true, BatteryLevel: 100}
	}
	if s.i >= len(s.list) {
		return s.list[len(s.list)-1]
	}
	out := s.list[s.i]
	s.i++
	return out
}

func newStore(t *testing.T) (*jobs.Store, *storage.SQLiteStore) {
	db, err := storage.NewSQLiteStore(filepath.Join(t.TempDir(), "runner.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	return jobs.NewStore(db), db
}

func seedRun(t *testing.T, store *jobs.Store) string {
	r, err := store.CreateRun(context.Background(), "tenant-a", []string{"tool:safe"})
	if err != nil {
		t.Fatal(err)
	}
	return r.ID
}

func testSession() *jobs.AutonomousSession {
	return &jobs.AutonomousSession{Goal: "g", MaxIterations: 10, MaxToolCalls: 20, MaxRuntime: time.Minute, StartedAt: time.Now().UTC()}
}

func TestIterationCapEnforced(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{}, NoProgressLimit: 10, Scheduler: IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond}, Sleep: func(context.Context, time.Duration) bool { return true }}
	s := testSession()
	s.MaxIterations = 2
	reason := loop.Run(context.Background(), "tenant-a", runID, s)
	if reason != ReasonMaxIterations {
		t.Fatalf("expected %s got %s", ReasonMaxIterations, reason)
	}
}

func TestPauseOnNetworkLossAndResume(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	engine := &fakeEngine{results: []StepResult{{Success: true, Progressed: true}, {Success: true, Progressed: true, Done: true}}}
	loop := Loop{
		Store:     store,
		Engine:    engine,
		Signals:   &sequenceSignals{list: []RuntimeSignals{{NetworkAvailable: false, BatteryLevel: 90}, {NetworkAvailable: true, BatteryLevel: 90}, {NetworkAvailable: true, BatteryLevel: 90}}},
		Scheduler: IdleCycleScheduler{BurstMin: 2 * time.Millisecond, BurstMax: 2 * time.Millisecond, SleepInterval: time.Millisecond},
		Sleep:     func(context.Context, time.Duration) bool { return true },
	}
	reason := loop.Run(context.Background(), "tenant-a", runID, testSession())
	if reason != ReasonDone {
		t.Fatalf("expected done got %s", reason)
	}
	events, err := store.EventHistory(context.Background(), "tenant-a", runID, 0)
	if err != nil {
		t.Fatal(err)
	}
	seenPaused, seenResumed := false, false
	for _, e := range events {
		if e.Type == "autonomous.paused" {
			seenPaused = true
		}
		if e.Type == "autonomous.resumed" {
			seenResumed = true
		}
	}
	if !seenPaused || !seenResumed {
		t.Fatalf("expected pause/resume events, paused=%v resumed=%v", seenPaused, seenResumed)
	}
}

func TestNoProgressStop(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{results: []StepResult{{Success: true, Progressed: false}, {Success: true, Progressed: false}}}, NoProgressLimit: 2, Scheduler: IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond}, Sleep: func(context.Context, time.Duration) bool { return true }}
	reason := loop.Run(context.Background(), "tenant-a", runID, testSession())
	if reason != ReasonNoProgress {
		t.Fatalf("expected %s got %s", ReasonNoProgress, reason)
	}
}

func TestRuntimeCapEnforced(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{results: []StepResult{{Success: true, Progressed: true}}}, Scheduler: IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond}, Sleep: func(context.Context, time.Duration) bool { return true }}
	s := testSession()
	s.MaxRuntime = time.Millisecond
	s.StartedAt = time.Now().Add(-time.Second)
	reason := loop.Run(context.Background(), "tenant-a", runID, s)
	if reason != ReasonMaxRuntime {
		t.Fatalf("expected %s got %s", ReasonMaxRuntime, reason)
	}
}

func TestCheckpointCreated(t *testing.T) {
	store := newStore(t)
	runID := seedRun(t, store)
	loop := Loop{Store: store, Engine: &fakeEngine{results: []StepResult{{Success: true, Progressed: true, Done: true, Summary: "done"}}}, Scheduler: IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond}, Sleep: func(context.Context, time.Duration) bool { return true }}
	reason := loop.Run(context.Background(), "tenant-a", runID, testSession())
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
	loop := Loop{Store: store, Engine: &fakeEngine{errs: []error{errors.New("boom"), errors.New("boom")}}, RepeatedFailureLimit: 10, NoProgressLimit: 10, Scheduler: IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond}, Sleep: func(context.Context, time.Duration) bool { return true }}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	reason := loop.Run(ctx, "tenant-a", runID, testSession())
	if reason != ReasonContextCanceled {
		t.Fatalf("expected %s got %s", ReasonContextCanceled, reason)
	}
}
