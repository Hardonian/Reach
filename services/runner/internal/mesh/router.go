package mesh

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

// TaskPriority defines task urgency levels.
type TaskPriority int

const (
	TaskPriorityLow    TaskPriority = 0
	TaskPriorityNormal TaskPriority = 1
	TaskPriorityHigh   TaskPriority = 2
)

// TaskRoute defines an explicit routing instruction for a task.
// Every routed task must have a definite target — no implicit broadcast.
type TaskRoute struct {
	// TaskID uniquely identifies this routed task
	TaskID string `json:"task_id"`
	// CorrelationID links this task to a cross-node execution chain
	CorrelationID string `json:"correlation_id"`
	// OriginNodeID is the node that created the route
	OriginNodeID string `json:"origin_node_id"`
	// TargetNodeID is the explicit destination node
	TargetNodeID string `json:"target_node_id"`
	// TaskType categorizes the task for handler dispatch
	TaskType string `json:"task_type"`
	// Payload is the task-specific data
	Payload json.RawMessage `json:"payload"`
	// Priority controls ordering
	Priority TaskPriority `json:"priority"`
	// TTL is the max time this route is valid
	TTL time.Duration `json:"ttl"`
	// CreatedAt is when the route was created
	CreatedAt time.Time `json:"created_at"`
	// Hops tracks the routing path for loop detection
	Hops []string `json:"hops"`
	// MaxHops prevents infinite forwarding chains
	MaxHops int `json:"max_hops"`
}

// TaskResult is the response from executing a routed task.
type TaskResult struct {
	// TaskID matches the original route
	TaskID string `json:"task_id"`
	// CorrelationID preserved for tracing
	CorrelationID string `json:"correlation_id"`
	// ExecutorNodeID is the node that executed the task
	ExecutorNodeID string `json:"executor_node_id"`
	// Status is "completed", "failed", or "rejected"
	Status string `json:"status"`
	// Result is the task output data
	Result json.RawMessage `json:"result,omitempty"`
	// Error describes failure reason if status is "failed" or "rejected"
	Error string `json:"error,omitempty"`
	// ExecutedAt is when execution completed
	ExecutedAt time.Time `json:"executed_at"`
}

// TaskHandler processes incoming routed tasks.
type TaskHandler func(route TaskRoute) (TaskResult, error)

// TaskRouter handles explicit task routing between mesh nodes.
// It enforces: no implicit broadcast, explicit targeting, loop detection,
// and hop-count limits.
type TaskRouter struct {
	mu sync.RWMutex

	localNodeID string
	transport   *TransportManager
	peerStore   *PeerStore

	// Registered handlers by task type
	handlers map[string]TaskHandler

	// Pending results for tasks we routed out
	pending map[string]chan TaskResult

	// Seen task IDs for deduplication
	seen map[string]time.Time

	// Max hops allowed (default 5)
	maxHops int

	// Audit callback
	audit func(event string, route TaskRoute, err error)
}

// NewTaskRouter creates a task router.
func NewTaskRouter(localNodeID string, transport *TransportManager, peerStore *PeerStore) *TaskRouter {
	return &TaskRouter{
		localNodeID: localNodeID,
		transport:   transport,
		peerStore:   peerStore,
		handlers:    make(map[string]TaskHandler),
		pending:     make(map[string]chan TaskResult),
		seen:        make(map[string]time.Time),
		maxHops:     5,
	}
}

// WithMaxHops configures the maximum hop count.
func (r *TaskRouter) WithMaxHops(n int) *TaskRouter {
	if n > 0 && n <= 20 {
		r.maxHops = n
	}
	return r
}

// WithAuditSink sets the audit callback.
func (r *TaskRouter) WithAuditSink(fn func(event string, route TaskRoute, err error)) *TaskRouter {
	r.audit = fn
	return r
}

// RegisterHandler registers a handler for a task type.
func (r *TaskRouter) RegisterHandler(taskType string, handler TaskHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[taskType] = handler
}

// Route sends a task to a specific target node. Returns the result or an error.
// This is the primary API — all routing is explicit, never broadcast.
func (r *TaskRouter) Route(route TaskRoute) error {
	r.emit("route.initiated", route, nil)

	// Validate the route
	if err := r.validateRoute(route); err != nil {
		r.emit("route.rejected", route, err)
		return err
	}

	// Check if target is self — execute locally
	if route.TargetNodeID == r.localNodeID {
		return r.executeLocal(route)
	}

	// Verify target is a known, trusted peer
	peer, ok := r.peerStore.Get(route.TargetNodeID)
	if !ok {
		err := fmt.Errorf("unknown target node: %s", route.TargetNodeID)
		r.emit("route.rejected", route, err)
		return err
	}
	if !peer.CanDelegateTo() {
		err := fmt.Errorf("target node not available for routing: %s", route.TargetNodeID)
		r.emit("route.rejected", route, err)
		return err
	}

	// Add self to hops
	route.Hops = append(route.Hops, r.localNodeID)

	// Serialize and send
	routeData, err := json.Marshal(route)
	if err != nil {
		return fmt.Errorf("failed to marshal route: %w", err)
	}

	msg := &Message{
		Type:    MsgTypeTaskRoute,
		From:    r.localNodeID,
		To:      route.TargetNodeID,
		Payload: routeData,
		ID:      generateMessageID(),
	}

	if err := r.transport.Send(route.TargetNodeID, msg); err != nil {
		r.emit("route.send_failed", route, err)
		return fmt.Errorf("failed to send route to %s: %w", route.TargetNodeID, err)
	}

	r.emit("route.sent", route, nil)
	return nil
}

// validateRoute checks a route for safety violations.
func (r *TaskRouter) validateRoute(route TaskRoute) error {
	if route.TaskID == "" {
		return errors.New("task_id is required")
	}
	if route.TargetNodeID == "" {
		return errors.New("target_node_id is required: explicit targeting required")
	}
	if route.TaskType == "" {
		return errors.New("task_type is required")
	}
	if route.OriginNodeID == "" {
		return errors.New("origin_node_id is required")
	}

	// TTL check
	if !route.CreatedAt.IsZero() && route.TTL > 0 {
		if time.Since(route.CreatedAt) > route.TTL {
			return errors.New("route TTL expired")
		}
	}

	// Loop detection: check if we're already in the hop chain
	for _, hop := range route.Hops {
		if hop == r.localNodeID {
			return fmt.Errorf("routing loop detected: node %s already in hop chain", r.localNodeID)
		}
	}

	// Hop count enforcement
	maxHops := route.MaxHops
	if maxHops <= 0 {
		maxHops = r.maxHops
	}
	if len(route.Hops) >= maxHops {
		return fmt.Errorf("max hops exceeded: %d >= %d", len(route.Hops), maxHops)
	}

	// Deduplication
	r.mu.RLock()
	if _, seen := r.seen[route.TaskID]; seen {
		r.mu.RUnlock()
		return fmt.Errorf("duplicate task: %s already processed", route.TaskID)
	}
	r.mu.RUnlock()

	return nil
}

// HandleIncomingRoute processes an incoming routed task message.
func (r *TaskRouter) HandleIncomingRoute(msg *Message, conn *Connection) {
	var route TaskRoute
	if err := json.Unmarshal(msg.Payload, &route); err != nil {
		return
	}

	r.emit("route.received", route, nil)

	// Validate
	if err := r.validateRoute(route); err != nil {
		r.emit("route.rejected", route, err)
		r.sendResult(msg.From, TaskResult{
			TaskID:         route.TaskID,
			CorrelationID:  route.CorrelationID,
			ExecutorNodeID: r.localNodeID,
			Status:         "rejected",
			Error:          err.Error(),
			ExecutedAt:     time.Now().UTC(),
		})
		return
	}

	// Mark as seen
	r.mu.Lock()
	r.seen[route.TaskID] = time.Now().UTC()
	r.mu.Unlock()

	// Execute locally
	r.executeLocal(route)
}

// HandleIncomingResult processes a task result from a remote node.
func (r *TaskRouter) HandleIncomingResult(msg *Message, conn *Connection) {
	var result TaskResult
	if err := json.Unmarshal(msg.Payload, &result); err != nil {
		return
	}

	r.mu.Lock()
	ch, ok := r.pending[result.TaskID]
	if ok {
		delete(r.pending, result.TaskID)
	}
	r.mu.Unlock()

	if ok && ch != nil {
		select {
		case ch <- result:
		default:
		}
	}
}

// executeLocal dispatches a route to the registered handler.
func (r *TaskRouter) executeLocal(route TaskRoute) error {
	r.mu.Lock()
	r.seen[route.TaskID] = time.Now().UTC()
	r.mu.Unlock()

	r.mu.RLock()
	handler, ok := r.handlers[route.TaskType]
	r.mu.RUnlock()

	if !ok {
		result := TaskResult{
			TaskID:         route.TaskID,
			CorrelationID:  route.CorrelationID,
			ExecutorNodeID: r.localNodeID,
			Status:         "rejected",
			Error:          fmt.Sprintf("no handler for task type: %s", route.TaskType),
			ExecutedAt:     time.Now().UTC(),
		}
		r.emit("route.no_handler", route, fmt.Errorf("no handler for %s", route.TaskType))
		if route.OriginNodeID != r.localNodeID {
			r.sendResult(route.OriginNodeID, result)
		}
		return fmt.Errorf("no handler for task type: %s", route.TaskType)
	}

	result, err := handler(route)
	if err != nil {
		r.emit("route.execution_failed", route, err)
		result = TaskResult{
			TaskID:         route.TaskID,
			CorrelationID:  route.CorrelationID,
			ExecutorNodeID: r.localNodeID,
			Status:         "failed",
			Error:          err.Error(),
			ExecutedAt:     time.Now().UTC(),
		}
	} else {
		r.emit("route.executed", route, nil)
		result.TaskID = route.TaskID
		result.CorrelationID = route.CorrelationID
		result.ExecutorNodeID = r.localNodeID
		if result.Status == "" {
			result.Status = "completed"
		}
		if result.ExecutedAt.IsZero() {
			result.ExecutedAt = time.Now().UTC()
		}
	}

	// Send result back to origin if remote
	if route.OriginNodeID != r.localNodeID {
		r.sendResult(route.OriginNodeID, result)
	}

	return err
}

// sendResult sends a task result back to the origin node.
func (r *TaskRouter) sendResult(targetNodeID string, result TaskResult) {
	resultData, err := json.Marshal(result)
	if err != nil {
		return
	}

	msg := &Message{
		Type:    MsgTypeTaskResult,
		From:    r.localNodeID,
		To:      targetNodeID,
		Payload: resultData,
		ID:      generateMessageID(),
	}

	r.transport.Send(targetNodeID, msg)
}

// CleanupSeen removes old entries from the seen map to prevent unbounded growth.
func (r *TaskRouter) CleanupSeen(maxAge time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()

	cutoff := time.Now().UTC().Add(-maxAge)
	for id, ts := range r.seen {
		if ts.Before(cutoff) {
			delete(r.seen, id)
		}
	}
}

func (r *TaskRouter) emit(event string, route TaskRoute, err error) {
	if r.audit != nil {
		r.audit(event, route, err)
	}
}
