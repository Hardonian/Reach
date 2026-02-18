package telemetry

import (
	"context"
	"testing"
	"time"
)

func TestNewTracer(t *testing.T) {
	tracer := NewTracer()
	if tracer == nil {
		t.Fatal("NewTracer() returned nil")
	}
}

func TestStartSpan(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test-operation")

	if span == nil {
		t.Fatal("StartSpan() returned nil")
	}
	if span.Name != "test-operation" {
		t.Errorf("expected name='test-operation', got: %s", span.Name)
	}
	if span.ID == "" {
		t.Error("expected span ID to be set")
	}
	if span.Start.IsZero() {
		t.Error("expected start time to be set")
	}
}

func TestStartSpanWithParent(t *testing.T) {
	tracer := NewTracer()
	parent := tracer.StartSpan("parent")
	child := tracer.StartSpanWithParent("child", parent.ID)

	if child.ParentID != parent.ID {
		t.Errorf("expected parent ID='%s', got: '%s'", parent.ID, child.ParentID)
	}
}

func TestSpanFinish(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")

	time.Sleep(10 * time.Millisecond)
	span.Finish()

	if span.End.IsZero() {
		t.Error("expected end time to be set")
	}
	if span.Duration == 0 {
		t.Error("expected duration to be set")
	}
	if span.Duration < 10*time.Millisecond {
		t.Errorf("expected duration >= 10ms, got: %v", span.Duration)
	}
}

func TestSpanFinishWithError(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")

	testErr := context.DeadlineExceeded
	span.FinishWithError(testErr)

	if span.Error == "" {
		t.Error("expected error to be set")
	}
}

func TestSpanAddEvent(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")

	span.AddEvent("checkpoint", "reached checkpoint")
	span.AddEvent("complete", "operation complete")

	if len(span.Events) != 2 {
		t.Errorf("expected 2 events, got: %d", len(span.Events))
	}
	if span.Events[0].Name != "checkpoint" {
		t.Errorf("expected first event name='checkpoint', got: %s", span.Events[0].Name)
	}
}

func TestSpanSetTag(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")

	span.SetTag("key", "value")
	span.SetTag("number", "42")

	if span.Tags["key"] != "value" {
		t.Errorf("expected tag key='value', got: %s", span.Tags["key"])
	}
}

func TestSpanIsFinished(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")

	if span.IsFinished() {
		t.Error("new span should not be finished")
	}

	span.Finish()
	if !span.IsFinished() {
		t.Error("finished span should be marked as finished")
	}
}

func TestTracerGetSpan(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")

	retrieved, ok := tracer.GetSpan(span.ID)
	if !ok {
		t.Error("expected to find span")
	}
	if retrieved.ID != span.ID {
		t.Error("retrieved span should have same ID")
	}

	_, ok = tracer.GetSpan("nonexistent")
	if ok {
		t.Error("should not find nonexistent span")
	}
}

func TestTracerGetActiveSpan(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test-operation")

	active, ok := tracer.GetActiveSpan("test-operation")
	if !ok {
		t.Error("expected to find active span")
	}
	if active.ID != span.ID {
		t.Error("active span should have same ID")
	}

	span.Finish()
	tracer.FinishSpan("test-operation")

	_, ok = tracer.GetActiveSpan("test-operation")
	if ok {
		t.Error("should not find finished span as active")
	}
}

func TestTracerGetTrace(t *testing.T) {
	tracer := NewTracer()
	parent := tracer.StartSpan("parent")
	child1 := tracer.StartSpanWithParent("child1", parent.ID)
	child2 := tracer.StartSpanWithParent("child2", parent.ID)
	grandchild := tracer.StartSpanWithParent("grandchild", child1.ID)

	_ = child2
	_ = grandchild

	trace := tracer.GetTrace(parent.ID)
	if len(trace) != 4 {
		t.Errorf("expected 4 spans in trace, got: %d", len(trace))
	}
}

func TestTracerSnapshot(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")
	span.Finish()

	// Active span not finished
	tracer.StartSpan("active")

	snapshot := tracer.Snapshot()
	if len(snapshot) != 1 {
		t.Errorf("expected 1 finished span in snapshot, got: %d", len(snapshot))
	}
}

func TestTracerReset(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")
	_ = span

	tracer.Reset()

	_, ok := tracer.GetSpan(span.ID)
	if ok {
		t.Error("span should be cleared after reset")
	}
}

func TestContextWithSpan(t *testing.T) {
	tracer := NewTracer()
	span := tracer.StartSpan("test")

	ctx := ContextWithSpan(context.Background(), span)
	retrieved, ok := SpanFromContext(ctx)
	if !ok {
		t.Error("expected to find span in context")
	}
	if retrieved.ID != span.ID {
		t.Error("retrieved span should have same ID")
	}
}

func TestSpanFromContext_NotFound(t *testing.T) {
	_, ok := SpanFromContext(context.Background())
	if ok {
		t.Error("should not find span in empty context")
	}
}

func TestDefaultTracer(t *testing.T) {
	tracer := DefaultTracer()
	if tracer == nil {
		t.Fatal("DefaultTracer() returned nil")
	}

	// Test T() shorthand
	if T() != tracer {
		t.Error("T() should return same as DefaultTracer()")
	}
}
