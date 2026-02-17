package jobs

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"time"

	"reach/services/runner/internal/storage"
)

type JobType string

const (
	JobToolCall             JobType = "ToolCall"
	JobRepoOp               JobType = "RepoOp"
	JobNotificationDispatch JobType = "NotificationDispatch"
	JobSpawnChild           JobType = "SpawnChild"
	JobCapsuleCheckpoint    JobType = "CapsuleCheckpoint"
)

type QueueJob struct {
	ID, TenantID, SessionID, RunID, AgentID, NodeID string
	Type                                            JobType
	PayloadJSON, IdempotencyKey                     string
	Priority                                        int
	MaxAttempts                                     int
	NextRunAt                                       time.Time
}

type QueueMetrics struct {
	QueueDepth map[JobType]int
	Retries    map[JobType]int
	DeadLetter map[JobType]int
}

type DurableQueue struct {
	db *storage.SQLiteStore
}

var ErrDuplicateJob = errors.New("duplicate idempotency key")

func NewDurableQueue(db *storage.SQLiteStore) *DurableQueue { return &DurableQueue{db: db} }

func (q *DurableQueue) Enqueue(ctx context.Context, job QueueJob) error {
	if job.MaxAttempts <= 0 {
		job.MaxAttempts = 5
	}
	if job.Priority <= 0 {
		job.Priority = 100
	}
	if job.NextRunAt.IsZero() {
		job.NextRunAt = time.Now().UTC()
	}
	if _, err := q.db.GetJobByIdempotency(ctx, job.TenantID, job.IdempotencyKey); err == nil {
		return ErrDuplicateJob
	}
	now := time.Now().UTC()
	return q.db.EnqueueJob(ctx, storage.JobRecord{ID: job.ID, TenantID: job.TenantID, SessionID: job.SessionID, RunID: job.RunID, AgentID: job.AgentID, NodeID: job.NodeID, Type: string(job.Type), PayloadJSON: job.PayloadJSON, IdempotencyKey: job.IdempotencyKey, Priority: job.Priority, Status: "queued", Attempts: 0, MaxAttempts: job.MaxAttempts, NextRunAt: job.NextRunAt, CreatedAt: now, UpdatedAt: now})
}

func (q *DurableQueue) Lease(ctx context.Context, limit int, leaseFor time.Duration) (string, []storage.JobRecord, error) {
	token := fmt.Sprintf("lease-%d", time.Now().UnixNano())
	jobs, err := q.db.LeaseReadyJobs(ctx, time.Now().UTC(), limit, token, leaseFor)
	return token, jobs, err
}

func (q *DurableQueue) Complete(ctx context.Context, jobID, leaseToken string, resultJSON string) error {
	return q.db.CompleteJob(ctx, jobID, leaseToken, resultJSON, time.Now().UTC())
}

func (q *DurableQueue) Fail(ctx context.Context, rec storage.JobRecord, leaseToken string, reason string) error {
	next := retryAt(rec, reason)
	dead := rec.Attempts+1 >= rec.MaxAttempts
	return q.db.FailJob(ctx, rec.ID, leaseToken, reason, next, dead)
}

func retryAt(rec storage.JobRecord, salt string) time.Time {
	base := math.Min(math.Pow(2, float64(rec.Attempts+1)), 64)
	h := fnv.New32a()
	_, _ = h.Write([]byte(rec.ID + salt))
	jitter := time.Duration(rand.New(rand.NewSource(int64(h.Sum32()))).Intn(1000)) * time.Millisecond
	return time.Now().UTC().Add(time.Duration(base)*time.Second + jitter)
}
