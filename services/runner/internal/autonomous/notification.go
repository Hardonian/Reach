package autonomous

import "time"

type NotificationLevel string

const (
	NotificationPassive          NotificationLevel = "passive"
	NotificationReviewRequired   NotificationLevel = "review_required"
	NotificationApprovalRequired NotificationLevel = "approval_required"
	NotificationGuardrailWarning NotificationLevel = "guardrail_warning"
	NotificationStopped          NotificationLevel = "stopped"
)

type Notification struct {
	Level   NotificationLevel
	Title   string
	Message string
	Key     string
	At      time.Time
}

type NotificationFilter struct {
	lastByKey       map[string]time.Time
	aggregatedCount int
	aggregatedSince time.Time
}

func NewNotificationFilter() *NotificationFilter {
	return &NotificationFilter{lastByKey: map[string]time.Time{}}
}

func (f *NotificationFilter) Push(n Notification) (Notification, bool) {
	if f.lastByKey == nil {
		f.lastByKey = map[string]time.Time{}
	}
	if n.At.IsZero() {
		n.At = time.Now().UTC()
	}
	if n.Key != "" {
		if last, ok := f.lastByKey[n.Key]; ok && n.At.Sub(last) < 30*time.Second {
			return Notification{}, false
		}
		f.lastByKey[n.Key] = n.At
	}
	if n.Level == NotificationPassive {
		if f.aggregatedCount == 0 {
			f.aggregatedSince = n.At
		}
		f.aggregatedCount++
		if f.aggregatedCount < 3 {
			return Notification{}, false
		}
		agg := Notification{
			Level:   NotificationPassive,
			Title:   "Background updates",
			Message: "Multiple minor updates were grouped",
			Key:     "aggregate.passive",
			At:      n.At,
		}
		f.aggregatedCount = 0
		return agg, true
	}
	f.aggregatedCount = 0
	return n, true
}
