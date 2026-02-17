package autonomous

import (
	"testing"
	"time"
)

func TestNotificationFilterDedupAndAggregate(t *testing.T) {
	f := NewNotificationFilter()
	now := time.Now().UTC()
	if _, ok := f.Push(Notification{Level: NotificationReviewRequired, Key: "same", At: now}); !ok {
		t.Fatal("first notification should pass")
	}
	if _, ok := f.Push(Notification{Level: NotificationReviewRequired, Key: "same", At: now.Add(5 * time.Second)}); ok {
		t.Fatal("duplicate notification should be dropped")
	}
	if _, ok := f.Push(Notification{Level: NotificationPassive, Key: "p1", At: now.Add(40 * time.Second)}); ok {
		t.Fatal("first passive should aggregate")
	}
	if _, ok := f.Push(Notification{Level: NotificationPassive, Key: "p2", At: now.Add(41 * time.Second)}); ok {
		t.Fatal("second passive should aggregate")
	}
	out, ok := f.Push(Notification{Level: NotificationPassive, Key: "p3", At: now.Add(42 * time.Second)})
	if !ok {
		t.Fatal("third passive should emit aggregate")
	}
	if out.Key != "aggregate.passive" {
		t.Fatalf("unexpected aggregate key %q", out.Key)
	}
}
