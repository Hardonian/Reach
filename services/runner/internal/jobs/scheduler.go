package jobs

import (
	"sort"

	"reach/services/runner/internal/storage"
)

type SchedulerDecision struct {
	JobID    string
	Action   string
	Reason   string
	NodeID   string
	RunID    string
	TenantID string
}

type Scheduler struct {
	MaxConcurrentAgents int
	PerSessionBudget    int
	PerNodeCapacity     int
}

func (s Scheduler) Decide(jobs []storage.JobRecord) []SchedulerDecision {
	sort.SliceStable(jobs, func(i, j int) bool {
		a, b := jobs[i], jobs[j]
		if a.Priority != b.Priority {
			return a.Priority < b.Priority
		}
		if a.TenantID != b.TenantID {
			return a.TenantID < b.TenantID
		}
		if a.SessionID != b.SessionID {
			return a.SessionID < b.SessionID
		}
		return a.ID < b.ID
	})
	decisions := make([]SchedulerDecision, 0, len(jobs))
	sessionCount := map[string]int{}
	nodeCount := map[string]int{}
	for _, rec := range jobs {
		key := rec.TenantID + "/" + rec.SessionID
		if s.PerSessionBudget > 0 && sessionCount[key] >= s.PerSessionBudget {
			decisions = append(decisions, SchedulerDecision{JobID: rec.ID, RunID: rec.RunID, TenantID: rec.TenantID, Action: "defer", Reason: "session_budget"})
			continue
		}
		if s.PerNodeCapacity > 0 && rec.NodeID != "" && nodeCount[rec.NodeID] >= s.PerNodeCapacity {
			decisions = append(decisions, SchedulerDecision{JobID: rec.ID, RunID: rec.RunID, TenantID: rec.TenantID, Action: "defer", Reason: "node_capacity"})
			continue
		}
		sessionCount[key]++
		if rec.NodeID != "" {
			nodeCount[rec.NodeID]++
		}
		decisions = append(decisions, SchedulerDecision{JobID: rec.ID, RunID: rec.RunID, TenantID: rec.TenantID, NodeID: rec.NodeID, Action: "run"})
	}
	return decisions
}
