package jobs

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	reacherrors "reach/services/runner/internal/errors"
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

// ErrQueueFull is returned when the queue exceeds its maximum depth.
var ErrQueueFull = reacherrors.New(reacherrors.CodeQueueFull, "queue capacity exceeded")

// ErrDuplicateJob is returned when a job with duplicate idempotency key is enqueued.
var ErrDuplicateJob = reacherrors.New(reacherrors.CodeResourceExhausted, "duplicate idempotency key")

// DurableQueue provides a bounded durable job queue with backpressure.
type DurableQueue struct {
	db           *storage.SQLiteStore
	maxDepth     int
	currentDepth atomic.Int64
	semaphore    chan struct{}
	mu           sync.RWMutex
}

// NewDurableQueue creates a new bounded durable queue.
func NewDurableQueue(db *storage.SQLiteStore) *DurableQueue {
	return &DurableQueue{
		db:        db,
		maxDepth:  1000,
		semaphore: make(chan struct{}, 1000),
	}
}

// Enqueue adds a job to the queue with backpressure.
func (q *DurableQueue) Enqueue(ctx context.Context, job QueueJob) error {
	// Check queue depth and apply backpressure
	depth := q.currentDepth.Load()
	if int(depth) >= q.maxDepth {
		return reacherrors.New(reacherrors.CodeQueueFull, fmt.Sprintf("queue capacity exceeded: %d/%d", depth, q.maxDepth))
	}

	// Try to acquire a slot (non-blocking check)
	select {
	case q.semaphore <- struct{}{}:
		// Slot acquired
	default:
		return reacherrors.New(reacherrors.CodeQueueFull, fmt.Sprintf("queue full: %d/%d", depth, q.maxDepth))
	}

	// Increment depth counter
	q.currentDepth.Add(1)

	// Ensure we release on error
	success := false
	defer func() {
		if !success {
			<-q.semaphore
			q.currentDepth.Add(-1)
		}
	}()

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
		success = true
		return ErrDuplicateJob
	}
	now := time.Now().UTC()
	if err := q.db.EnqueueJob(ctx, storage.JobRecord{ID: job.ID, TenantID: job.TenantID, SessionID: job.SessionID, RunID: job.RunID, AgentID: job.AgentID, NodeID: job.NodeID, Type: string(job.Type), PayloadJSON: job.PayloadJSON, IdempotencyKey: job.IdempotencyKey, Priority: job.Priority, Status: "queued", Attempts: 0, MaxAttempts: job.MaxAttempts, NextRunAt: job.NextRunAt, CreatedAt: now, UpdatedAt: now}); err != nil {
		return err
	}

	success = true
	return nil
}

// ReleaseSlot releases a queue slot after job processing.
func (q *DurableQueue) ReleaseSlot() {
	select {
	case <-q.semaphore:
		q.currentDepth.Add(-1)
	default:
	}
}

// Depth returns the current queue depth.
func (q *DurableQueue) Depth() int {
	return int(q.currentDepth.Load())
}

// MaxDepth returns the maximum queue depth.
func (q *DurableQueue) MaxDepth() int {
	return q.maxDepth
}

// AvailableSlots returns the number of available queue slots.
func (q *DurableQueue) AvailableSlots() int {
	return q.maxDepth - int(q.currentDepth.Load())
}

// ErrDuplicateJob is returned when a job with