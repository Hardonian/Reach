package telemetry

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// SpanID is a unique identifier for a span.
type SpanID string

// Span represents a trace span.
type Span struct {
	ID       SpanID            `json:"id"`
	ParentID SpanID            `json:"parent_id,omitempty"`
	Name     string            `json:"name"`
	Start    time.Time         `json:"start"`
	End      time.Time         `json:"end,omitempty"`
	Duration time.Duration     `json:"duration,omitempty"`
	Tags     map[string]string `json:"tags,omitempty"`
	Events   []SpanEvent       `json:"events,omitempty"`
	Error    string            `json:"error,omitempty"`

	mu     sync.RWMutex
	parent *Span
	children []*Span
}

// SpanEvent represents an event within a span.
type SpanEvent struct {
	Timestamp time.Time `json:"ts"`
	Name      string    `json:"name"`
	Message   string    `json:"message,omitempty"`
}

// Tracer provides lightweight distributed tracing.
type Tracer struct {
	mu    sync.RWMutex
	spans map[SpanID]*Span
	active map[string]*Span // active spans by name
}

// NewTracer creates a new tracer.
func NewTracer() *Tracer {
	return &Tracer{
		spans:  make(map[SpanID]*Span),
		active: make(map[string]*Span),
	}
}

// StartSpan starts a new span.
func (t *Tracer) StartSpan(name string) *Span {
	return t.StartSpanWithParent(name, "")
}

// StartSpanWithParent starts a new span with a parent.
func (t *Tracer) StartSpanWithParent(name string, parentID SpanID) *Span {
	span := &Span{
		ID:     SpanID(fmt.Sprintf("%s_%d", name, time.Now().UnixNano())),
		Name:   name,
		Start:  time.Now().UTC(),
		Tags:   make(map[string]string),
		Events: make([]SpanEvent, 0),
	}

	if parentID != "" {
		t.mu.RLock()
		parent, ok := t.spans[parentID]
		t.mu.RUnlock()
		if ok {
			span.ParentID = parentID
			span.parent = parent
			parent.mu.Lock()
			parent.children = append(parent.children, span)
			parent.mu.Unlock()
		}
	}

	t.mu.Lock()
	t.spans[span.ID] = span
	t.active[name] = span
	t.mu.Unlock()

	return span
}

// Finish finishes a span.
func (s *Span) Finish() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.End.IsZero() {
		s.End = time.Now().UTC()
		s.Duration = s.End.Sub(s.Start)
	}
}

// FinishWithError finishes a span with an error.
func (s *Span) FinishWithError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.End.IsZero() {
		s.End = time.Now().UTC()
		s.Duration = s.End.Sub(s.Start)
	}

	if err != nil {
		s.Error = err.Error()
	}
}

// AddEvent adds an event to the span.
func (s *Span) AddEvent(name, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Events = append(s.Events, SpanEvent{
		Timestamp: time.Now().UTC(),
		Name:      name,
		Message:   message,
	})
}

// SetTag sets a tag on the span.
func (s *Span) SetTag(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Tags[key] = value
}

// IsFinished returns true if the span is finished.
func (s *Span) IsFinished() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return !s.End.IsZero()
}

// GetSpan returns a span by ID.
func (t *Tracer) GetSpan(id SpanID) (*Span, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	span, ok := t.spans[id]
	return span, ok
}

// GetActiveSpan returns the active span for a name.
func (t *Tracer) GetActiveSpan(name string) (*Span, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	span, ok := t.active[name]
	return span, ok
}

// FinishSpan finishes a span by name.
func (t *Tracer) FinishSpan(name string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if span, ok := t.active[name]; ok {
		span.Finish()
		delete(t.active, name)
	}
}

// GetTrace returns all spans for a given root span ID.
func (t *Tracer) GetTrace(rootID SpanID) []*Span {
	t.mu.RLock()
	root, ok := t.spans[rootID]
	t.mu.RUnlock()

	if !ok {
		return nil
	}

	var result []*Span
	var collect func(*Span)
	collect = func(s *Span) {
		result = append(result, s)
		s.mu.RLock()
		children := make([]*Span, len(s.children))
		copy(children, s.children)
		s.mu.RUnlock()
		for _, child := range children {
			collect(child)
		}
	}
	collect(root)
	return result
}

// Snapshot returns a snapshot of all finished spans.
func (t *Tracer) Snapshot() []*Span {
	t.mu.RLock()
	defer t.mu.RUnlock()

	var result []*Span
	for _, span := range t.spans {
		if span.IsFinished() {
			result = append(result, span)
		}
	}
	return result
}

// Reset clears all spans.
func (t *Tracer) Reset() {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.spans = make(map[SpanID]*Span)
	t.active = make(map[string]*Span)
}

// Context key type
type contextKey string

const spanContextKey contextKey = "telemetry.span"

// ContextWithSpan adds a span to a context.
func ContextWithSpan(ctx context.Context, span *Span) context.Context {
	return context.WithValue(ctx, spanContextKey, span)
}

// SpanFromContext extracts a span from a context.
func SpanFromContext(ctx context.Context) (*Span, bool) {
	span, ok := ctx.Value(spanContextKey).(*Span)
	return span, ok
}

// Default tracer instance.
var defaultTracer = NewTracer()

// Default returns the default tracer.
func DefaultTracer() *Tracer { return defaultTracer }

// T is a shorthand for DefaultTracer().
func T() *Tracer { return defaultTracer }
