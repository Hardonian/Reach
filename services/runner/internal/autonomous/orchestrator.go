package autonomous

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"reach/services/runner/internal/jobs"

	"github.com/google/uuid"

	"reach/services/runner/internal/spec"
)

// BudgetProvider interface for budget operations
type BudgetProvider interface {
	PredictAndReserve(ctx context.Context, tenantID, runID, tool string, estimatedTokens int) (jobs.AllocationResult, error)
	CommitSpend(ctx context.Context, tenantID, runID string, allocID uint64, actualCost float64, tool string) error
	GetBudgetStatus(ctx context.Context, tenantID, runID string) (map[string]interface{}, error)
}

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
	ReasonPaused           StatusReason = "paused"
	ReasonPlanError        StatusReason = "plan_error"
	ReasonBudgetExceeded   StatusReason = "budget_exceeded"
)

type PauseReason string

const (
	PauseReasonNetwork      PauseReason = "network_lost"
	PauseReasonLowBattery   PauseReason = "battery_low"
	PauseReasonUser         PauseReason = "user_paused"
	PauseReasonGuardrail    PauseReason = "guardrail_near"
	PauseReasonPolicyWindow PauseReason = "policy_window"
	PauseReasonBudget       PauseReason = "budget_low"
)

type RuntimeSignals struct {
	NetworkAvailable bool
	BatteryLevel     int
	UserPaused       bool
	GuardrailNear    bool
}

type SignalProvider interface {
	Signals(context.Context, jobs.AutonomousSession) RuntimeSignals
}

type IdleCycleScheduler struct {
	BurstMin      time.Duration
	BurstMax      time.Duration
	SleepInterval time.Duration
}

func (s IdleCycleScheduler) normalize() IdleCycleScheduler {
	if s.BurstMin <= 0 {
		s.BurstMin = 10 * time.Second
	}
	if s.BurstMax <= 0 {
		s.BurstMax = 30 * time.Second
	}
	if s.BurstMax < s.BurstMin {
		s.BurstMax = s.BurstMin
	}
	if s.SleepInterval <= 0 {
		s.SleepInterval = 15 * time.Second
	}
	return s
}

func (s IdleCycleScheduler) burstForIteration(iteration int) time.Duration {
	s = s.normalize()
	if s.BurstMax == s.BurstMin {
		return s.BurstMin
	}
	window := s.BurstMax - s.BurstMin
	step := time.Second
	offset := (time.Duration(iteration) * step) % (window + step)
	return s.BurstMin + offset
}

// Loop provides the autonomous execution loop with budget integration.
type Loop struct {
	Store                *jobs.Store
	Planner              StepPlanner
	Executor             Executor
	Signals              SignalProvider
	Scheduler            IdleCycleScheduler
	RepeatedFailureLimit int
	NoProgressLimit      int
	IterationTimeout     time.Duration
	Sleep                func(context.Context, time.Duration) bool
	
	// Budget integration
	BudgetProvider       BudgetProvider
	TenantID             string
	RunID                string
	BudgetEnabled        bool
	defaultTokenEstimate int
}

func (l *Loop) Run(ctx context.Context, tenantID, runID string, session *jobs.AutonomousSession) StatusReason {
	if l.RepeatedFailureLimit <= 0 {
		l.RepeatedFailureLimit = 3
	}
	if l.NoProgressLimit <= 0 {
		l.NoProgressLimit = 3
	}
	if l.defaultTokenEstimate <= 0 {
		l.defaultTokenEstimate = 1000
	}
	
	// Store IDs for budget operations
	l.TenantID = tenantID
	l.RunID = runID
	
	scheduler := l.Scheduler.normalize()
	sleepFn := l.Sleep
	if sleepFn == nil {
		sleepFn = func(ctx context.Context, d time.Duration) bool {
			t := time.NewTimer(d)
			defer t.Stop()
			select {
			case <-ctx.Done():
				return false
			case <-t.C:
				return true
			}
		}
	}

	for {
		if reason, stop := l.preflight(ctx, runID, session); stop {
			return reason
		}
		burstDeadline := time.Now().UTC().Add(scheduler.burstForIteration(session.IterationCount))
		for time.Now().UTC().Before(burstDeadline) {
			if reason, stop := l.preflight(ctx, runID, session); stop {
				return reason
			}
			if reason := l.pauseReason(ctx, *session); reason != "" {
				session.Status = jobs.AutonomousPaused
				session.StopReason = string(reason)
				session.UpdatedAt = time.Now().UTC()
				_ = l.publishStateEvent(ctx, runID, "autonomous.paused", map[string]any{"reason": reason, "iteration_count": session.IterationCount})
				if !sleepFn(ctx, scheduler.SleepInterval) {
					return ReasonContextCanceled
				}
				session.Status = jobs.AutonomousRunning
				session.StopReason = ""
				session.UpdatedAt = time.Now().UTC()
				_ = l.publishStateEvent(ctx, runID, "autonomous.resumed", map[string]any{"iteration_count": session.IterationCount})
				continue
			}
			if reason := l.tick(ctx, tenantID, runID, session); reason != "" {
				return reason
			}
		}
		if !sleepFn(ctx, scheduler.SleepInterval) {
			return ReasonContextCanceled
		}
	}
}

func (l *Loop) preflight(ctx context.Context, _ string, session *jobs.AutonomousSession) (StatusReason, bool) {
	if err := ctx.Err(); err != nil {
		return ReasonContextCanceled, true
	}
	if session.IterationCount >= session.MaxIterations {
		return ReasonMaxIterations, true
	}
	if session.MaxToolCalls > 0 && session.ToolCallCount >= session.MaxToolCalls {
		return ReasonMaxToolCalls, true
	}
	if session.MaxRuntime > 0 && time.Since(session.StartedAt) >= session.MaxRuntime {
		return ReasonMaxRuntime, true
	}
	
	// Check budget status if enabled
	if l.BudgetEnabled && l.BudgetProvider != nil {
		status, err := l.BudgetProvider.GetBudgetStatus(ctx, l.TenantID, l.RunID)
		if err == nil {
			if paused, ok := status["paused"].(bool); ok && paused {
				return ReasonBudgetExceeded, true
			}
		}
	}
	
	return "", false
}

func (l *Loop) pauseReason(ctx context.Context, session jobs.AutonomousSession) PauseReason {
	if l.Signals == nil {
		return ""
	}
	sig := l.Signals.Signals(ctx, session)
	if sig.UserPaused {
		return PauseReasonUser
	}
	if !sig.NetworkAvailable {
		return PauseReasonNetwork
	}
	if sig.BatteryLevel > 0 && sig.BatteryLevel <= 15 {
		return PauseReasonLowBattery
	}
	if sig.GuardrailNear {
		return PauseReasonGuardrail
	}
	
	// Check budget if enabled
	if l.BudgetEnabled && l.BudgetProvider != nil {
		status, err := l.BudgetProvider.GetBudgetStatus(ctx, l.TenantID, l.RunID)
		if err == nil {
			if percentUsed, ok := status["percent_used"].(float64); ok && percentUsed >= 80 {
				return PauseReasonBudget
			}
		}
	}
	
	return ""
}

func (l *Loop) tick(ctx context.Context, tenantID, runID string, session *jobs.AutonomousSession) StatusReason {
	stepCtx := ctx
	if l.IterationTimeout > 0 {
		var cancel context.CancelFunc
		stepCtx, cancel = context.WithTimeout(ctx, l.IterationTimeout)
		defer cancel()
	}

	// 1. Build Session State for Planner
	state := SessionState{
		Goal:           session.Goal,
		IterationCount: session.IterationCount,
		Variables:      make(map[string]any),
	}
	
	// Add budget info to state if available
	if l.BudgetEnabled && l.BudgetProvider != nil {
		status, err := l.BudgetProvider.GetBudgetStatus(ctx, tenantID, runID)
		if err == nil {
			state.Variables["budget_status"] = status
		}
	}

	// 2. Planner Step
	plan, err := l.Planner.NextStep(stepCtx, state)
	if err != nil {
		session.FailureStreak++
		if session.FailureStreak >= l.RepeatedFailureLimit {
			return ReasonRepeatedFailure
		}
		return "" // Retry
	}

	// Handle non-execution actions
	if plan.Action == ActionDone {
		return ReasonDone
	}
	if plan.Action == ActionWait {
		return "" // Just finish tick, loop will sleep if burst finished
	}
	if plan.Action == ActionFail {
		return ReasonPlanError
	}

	// 3. Budget Check: Predict and reserve before execution
	var allocResult jobs.AllocationResult
	if l.BudgetEnabled && l.BudgetProvider != nil {
		estimatedTokens := l.defaultTokenEstimate
		if plan.EstimatedTokens > 0 {
			estimatedTokens = plan.EstimatedTokens
		}
		
		allocResult, err = l.BudgetProvider.PredictAndReserve(ctx, tenantID, runID, plan.Tool, estimatedTokens)
		if err != nil {
			// Budget check failed
			session.FailureStreak++
			_ = l.publishStateEvent(ctx, runID, "autonomous.budget_denied", map[string]any{
				"tool": plan.Tool,
				"error": err.Error(),
			})
			
			if errors.Is(err, jobs.ErrBudgetExceeded) {
				return ReasonBudgetExceeded
			}
			return "" // Retry
		}
		
		if !allocResult.Approved {
			// Budget allocation denied
			_ = l.publishStateEvent(ctx, runID, "autonomous.budget_exceeded", map[string]any{
				"tool": plan.Tool,
				"estimated_cost": allocResult.EstCost,
			})
			return ReasonBudgetExceeded
		}
	}

	// 4. Execution Step
	// Create Envelope
	envelope := ExecutionEnvelope{
		ID:        uuid.New().String(),
		TaskID:    runID,
		ToolName:  plan.Tool,
		Arguments: plan.Args,
		Context: ExecutionContext{
			SessionID:   runID,
			TenantID:    tenantID,
			AgentID:     "root",
			SpecVersion: spec.Version,
		},
		Permissions: session.AllowedCapabilities,
	}
	
	// Include budget allocation in envelope if applicable
	if l.BudgetEnabled {
		envelope.BudgetAllocID = allocResult.AllocatedID
		envelope.EstimatedCost = allocResult.EstCost
	}

	res, err := l.Executor.Execute(stepCtx, envelope)

	// 5. Commit or rollback budget allocation
	if l.BudgetEnabled && l.BudgetProvider != nil {
		actualCost := allocResult.EstCost // Default to estimate
		if res != nil && res.Metrics.CostUSD > 0 {
			actualCost = res.Metrics.CostUSD
		}
		
		commitErr := l.BudgetProvider.CommitSpend(ctx, tenantID, runID, allocResult.AllocatedID, actualCost, plan.Tool)
		if commitErr != nil {
			// Log but don't fail the operation
			_ = l.publishStateEvent(ctx, runID, "autonomous.budget_commit_error", map[string]any{
				"tool": plan.Tool,
				"error": commitErr.Error(),
			})
		}
	}

	// 6. Update Session
	session.ToolCallCount++
	session.IterationCount++
	session.UpdatedAt = time.Now().UTC()

	var success bool

	if err != nil {
		success = false
	} else {
		success = res.Status == StatusSuccess
	}

	if !success {
		session.FailureStreak++
	} else {
		session.FailureStreak = 0
	}

	// Progress heuristic: success is progress.
	if success {
		session.NoProgressStreak = 0
	} else {
		session.NoProgressStreak++
	}

	// 7. Checkpoint
	if ckErr := l.checkpoint(ctx, tenantID, runID, *session, *plan, res); ckErr != nil {
		return ReasonCheckpointFailed
	}

	if session.FailureStreak >= l.RepeatedFailureLimit {
		return ReasonRepeatedFailure
	}
	if session.NoProgressStreak >= l.NoProgressLimit {
		return ReasonNoProgress
	}
	return ""
}

func (l *Loop) publishStateEvent(ctx context.Context, runID, event string, payload map[string]any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return l.Store.PublishEvent(ctx, runID, jobs.Event{Type: event, Payload: body, CreatedAt: time.Now().UTC()}, "autonomous")
}

func (l *Loop) checkpoint(ctx context.Context, tenantID, runID string, session jobs.AutonomousSession, plan StepPlan, res *ExecutionResult) error {
	// Include budget status in checkpoint
	budgetData := map[string]any{}
	if l.BudgetEnabled && l.BudgetProvider != nil {
		status, err := l.BudgetProvider.GetBudgetStatus(ctx, tenantID, runID)
		if err == nil {
			budgetData = status
		}
	}
	
	capsule, err := json.Marshal(map[string]any{
		"goal":            session.Goal,
		"iteration":       session.IterationCount,
		"tool_call_count": session.ToolCallCount,
		"plan":            plan,
		"result":          res,
		"budget":          budgetData,
		"timestamp":       time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		return err
	}
	if err := l.Store.PublishEvent(ctx, runID, jobs.Event{Type: "autonomous.checkpoint", Payload: capsule, CreatedAt: time.Now().UTC()}, "autonomous"); err != nil {
		return err
	}

	summary := "executed"
	if res != nil && res.Error != nil {
		summary = res.Error.Message
	}

	auditPayload, _ := json.Marshal(map[string]any{
		"iteration": session.IterationCount,
		"delta_summary": summary,
		"budget_enabled": l.BudgetEnabled,
	})
	if err := l.Store.Audit(ctx, tenantID, runID, "autonomous.checkpoint", auditPayload); err != nil {
		return err
	}
	return nil
}

// StaticPlanner for testing/wiring
type StaticPlanner struct{}

func (StaticPlanner) NextStep(_ context.Context, s SessionState) (*StepPlan, error) {
	if s.IterationCount > 1000000 {
		return nil, errors.New("iteration overflow")
	}
	return &StepPlan{
		Action: ActionExecute,
		Tool:   "noop",
		Args:   json.RawMessage(`{"ok":true}`),
	}, nil
}

// StaticExecutor for testing/wiring
type StaticExecutor struct{}

func (StaticExecutor) Execute(_ context.Context, _ ExecutionEnvelope) (*ExecutionResult, error) {
	return &ExecutionResult{
		Status: StatusSuccess,
		Output: json.RawMessage(`{"ok": true}`),
		Metrics: ExecutionMetrics{
			Duration: time.Millisecond,
			CostUSD:  0.001,
		},
	}, nil
}
