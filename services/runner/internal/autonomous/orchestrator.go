package autonomous

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"reach/services/runner/internal/jobs"
)

type StatusReason string

const (
	ReasonDone             StatusReason = "done"
	ReasonManualStop       StatusReason = "manual_stop"
	ReasonMaxIterations    StatusReason = "max_iterations"
	ReasonMaxRuntime       StatusReason = "max_runtime"
	ReasonMaxToolCalls     StatusReason = "max_tool_calls"
	ReasonRepeatedFailure  StatusReason = "repeated_failures"
	ReasonNoProgress       StatusReason = "no_progress"
	ReasonContextCanceled  StatusReason = "context_canceled"
	ReasonCheckpointFailed StatusReason = "checkpoint_failed"
)

type StepPlan struct {
	ToolName string
	Input    map[string]any
}

type StepResult struct {
	Success    bool
	Progressed bool
	Summary    string
	Output     map[string]any
	Done       bool
}

type Engine interface {
	Plan(context.Context, string, int) (StepPlan, error)
	Execute(context.Context, StepPlan) (StepResult, error)
}

type Loop struct {
	Store                *jobs.Store
	Engine               Engine
	RepeatedFailureLimit int
	NoProgressLimit      int
	IterationTimeout     time.Duration
}

func (l *Loop) Run(ctx context.Context, tenantID, runID string, session *jobs.AutonomousSession) StatusReason {
	if l.RepeatedFailureLimit <= 0 {
		l.RepeatedFailureLimit = 3
	}
	if l.NoProgressLimit <= 0 {
		l.NoProgressLimit = 3
	}
	for {
		if err := ctx.Err(); err != nil {
			return ReasonContextCanceled
		}
		if session.IterationCount >= session.MaxIterations {
			return ReasonMaxIterations
		}
		if session.MaxToolCalls > 0 && session.ToolCallCount >= session.MaxToolCalls {
			return ReasonMaxToolCalls
		}
		if session.MaxRuntime > 0 && time.Since(session.StartedAt) >= session.MaxRuntime {
			return ReasonMaxRuntime
		}

		stepCtx := ctx
		if l.IterationTimeout > 0 {
			var cancel context.CancelFunc
			stepCtx, cancel = context.WithTimeout(ctx, l.IterationTimeout)
			defer cancel()
		}
		plan, err := l.Engine.Plan(stepCtx, session.Goal, session.IterationCount)
		if err != nil {
			session.FailureStreak++
			if session.FailureStreak >= l.RepeatedFailureLimit {
				return ReasonRepeatedFailure
			}
			continue
		}

		res, err := l.Engine.Execute(stepCtx, plan)
		session.ToolCallCount++
		session.IterationCount++
		session.UpdatedAt = time.Now().UTC()
		if err != nil || !res.Success {
			session.FailureStreak++
		} else {
			session.FailureStreak = 0
		}
		if res.Progressed {
			session.NoProgressStreak = 0
		} else {
			session.NoProgressStreak++
		}

		if ckErr := l.checkpoint(ctx, tenantID, runID, *session, plan, res); ckErr != nil {
			return ReasonCheckpointFailed
		}

		if res.Done {
			return ReasonDone
		}
		if session.FailureStreak >= l.RepeatedFailureLimit {
			return ReasonRepeatedFailure
		}
		if session.NoProgressStreak >= l.NoProgressLimit {
			return ReasonNoProgress
		}
	}
}

func (l *Loop) checkpoint(ctx context.Context, tenantID, runID string, session jobs.AutonomousSession, plan StepPlan, res StepResult) error {
	capsule, err := json.Marshal(map[string]any{
		"goal":            session.Goal,
		"iteration":       session.IterationCount,
		"tool_call_count": session.ToolCallCount,
		"plan":            plan,
		"result":          res,
		"timestamp":       time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		return err
	}
	if err := l.Store.PublishEvent(ctx, runID, jobs.Event{Type: "autonomous.checkpoint", Payload: capsule, CreatedAt: time.Now().UTC()}, "autonomous"); err != nil {
		return err
	}
	auditPayload, _ := json.Marshal(map[string]any{"iteration": session.IterationCount, "delta_summary": res.Summary})
	if err := l.Store.Audit(ctx, tenantID, runID, "autonomous.checkpoint", auditPayload); err != nil {
		return err
	}
	return nil
}

// StaticEngine is used by API wiring and tests when a dedicated planner is not configured yet.
type StaticEngine struct{}

func (StaticEngine) Plan(_ context.Context, _ string, i int) (StepPlan, error) {
	if i > 1000000 {
		return StepPlan{}, errors.New("iteration overflow")
	}
	return StepPlan{ToolName: "noop", Input: map[string]any{"iteration": i}}, nil
}

func (StaticEngine) Execute(_ context.Context, _ StepPlan) (StepResult, error) {
	return StepResult{Success: true, Progressed: false, Summary: "no-op", Output: map[string]any{"ok": true}, Done: false}, nil
}
