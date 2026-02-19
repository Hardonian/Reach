package autonomous

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/storage"
)

type fakePlanner struct {
	plans []StepPlan
	err   error
	i     int
}

func (f *fakePlanner) NextStep(_ context.Context, _ SessionState) (*StepPlan, error) {
	if f.err != nil {
		return nil, f.err
	}
	if f.i < len(f.plans) {
		p := f.plans[f.i]
		f.i++
		return &p, nil
	}
	return &StepPlan{Action: ActionDone}, nil
}

type fakeExecutor struct {
	results []ExecutionResult
	errs    []error
	i       int
}

func (f *fakeExecutor) Execute(_ context.Context, _ ExecutionEnvelope) (*ExecutionResult, error) {
	idx := f.i
	f.i++
	if idx < len(f.errs) && f.errs[idx] != nil {
		return nil, f.errs[idx]
	}
	if idx < len(f.results) {
		return &f.results[idx], nil
	}
	return &ExecutionResult{Status: StatusSuccess}, nil
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
	r, err := store.CreateRun(context.Background(), "tenant-a", "", []string{"tool:safe"})
	if err != nil {
		t.Fatal(err)
	}
	return r.ID
}

func testSession() *jobs.AutonomousSession {
	return &jobs.AutonomousSession{Goal: "g", MaxIterations: 10, MaxToolCalls: 20, MaxRuntime: time.Minute, StartedAt: time.Now().UTC()}
}

func TestIterationCapEnforced(t *testing.T) {
	store, db := newStore(t)
	defer db.Close()
	runID := seedRun(t, store)
	loop := Loop{
		Store: store,
		Planner: &fakePlanner{plans: []StepPlan{
			{Action: ActionExecute, Tool: "t"},
			{Action: ActionExecute, Tool: "t"},
			{Action: ActionExecute, Tool: "t"},
		}},
		Executor:        &fakeExecutor{},
		NoProgressLimit: 10,
		Scheduler:       IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond},
		Sleep:           func(context.Context, time.Duration) bool { return true },
	}
	s := testSession()
	s.MaxIterations = 2
	reason := loop.Run(context.Background(), "tenant-a", runID, s)
	if reason != ReasonMaxIterations {
		t.Fatalf("expected %s got %s", ReasonMaxIterations, reason)
	}
}

func TestPauseOnNetworkLossAndResume(t *testing.T) {
	store, db := newStore(t)
	defer db.Close()
	runID := seedRun(t, store)
	// Plan: Execute -> Execute -> Done
	plans := []StepPlan{
		{Action: ActionExecute, Tool: "t1"},
		{Action: ActionExecute, Tool: "t2"},
		{Action: ActionDone},
	}
	planner := &fakePlanner{plans: plans}
	executor := &fakeExecutor{results: []ExecutionResult{
		{Status: StatusSuccess, Output: json.RawMessage(`{}`)},
		{Status: StatusSuccess, Output: json.RawMessage(`{}`)},
	}}

	loop := Loop{
		Store:     store,
		Planner:   planner,
		Executor:  executor,
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
	store, db := newStore(t)
	defer db.Close()
	runID := seedRun(t, store)
	// Executor returns failure -> no progress
	executor := &fakeExecutor{results: []ExecutionResult{
		{Status: StatusFailure},
		{Status: StatusFailure},
	}}
	planner := &fakePlanner{plans: []StepPlan{
		{Action: ActionExecute, Tool: "t"},
		{Action: ActionExecute, Tool: "t"},
	}}

	loop := Loop{
		Store:           store,
		Planner:         planner,
		Executor:        executor,
		NoProgressLimit: 2,
		Scheduler:       IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond},
		Sleep:           func(context.Context, time.Duration) bool { return true },
	}
	reason := loop.Run(context.Background(), "tenant-a", runID, testSession())
	if reason != ReasonNoProgress {
		t.Fatalf("expected %s got %s", ReasonNoProgress, reason)
	}
}

func TestRuntimeCapEnforced(t *testing.T) {
	store, db := newStore(t)
	defer db.Close()
	runID := seedRun(t, store)
	loop := Loop{
		Store:     store,
		Planner:   &fakePlanner{plans: []StepPlan{{Action: ActionExecute, Tool: "t"}}},
		Executor:  &fakeExecutor{},
		Scheduler: IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond},
		Sleep:     func(context.Context, time.Duration) bool { return true },
	}
	s := testSession()
	s.MaxRuntime = time.Millisecond
	s.StartedAt = time.Now().Add(-time.Second)
	reason := loop.Run(context.Background(), "tenant-a", runID, s)
	if reason != ReasonMaxRuntime {
		t.Fatalf("expected %s got %s", ReasonMaxRuntime, reason)
	}
}

func TestCheckpointCreated(t *testing.T) {
	store, db := newStore(t)
	defer db.Close()
	runID := seedRun(t, store)
	loop := Loop{
		Store: store,
		Planner: &fakePlanner{plans: []StepPlan{
			{Action: ActionExecute, Tool: "t"},
			{Action: ActionDone},
		}},
		Executor:  &fakeExecutor{},
		Scheduler: IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond},
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
	store, db := newStore(t)
	defer db.Close()
	runID := seedRun(t, store)
	loop := Loop{
		Store:                store,
		Planner:              &fakePlanner{err: errors.New("boom")}, // This simulates plan error
		Executor:             &fakeExecutor{},
		RepeatedFailureLimit: 10,
		NoProgressLimit:      10,
		Scheduler:            IdleCycleScheduler{BurstMin: time.Millisecond, BurstMax: time.Millisecond, SleepInterval: time.Millisecond},
		Sleep:                func(context.Context, time.Duration) bool { return true },
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	reason := loop.Run(ctx, "tenant-a", runID, testSession())
	if reason != ReasonContextCanceled {
		t.Fatalf("expected %s got %s", ReasonContextCanceled, reason)
	}
}
