package gamification

import (
	"testing"
	"time"
)

func TestXPAndBadge(t *testing.T) {
	s := NewStore("/tmp/ignore.json")
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s.ApplyEvent("run.completed", now)
	s.ApplyEvent("replay.verified", now)
	p := s.Snapshot()
	if p.XP <= 0 {
		t.Fatal("expected xp increment")
	}
	if !p.Badges["Determinist"] {
		t.Fatal("expected Determinist badge")
	}
}

func TestStreak(t *testing.T) {
	s := NewStore("/tmp/ignore.json")
	s.ApplyEvent("run.started", time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	s.ApplyEvent("run.started", time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC))
	if s.Snapshot().StreakDays != 2 {
		t.Fatalf("expected streak 2 got %d", s.Snapshot().StreakDays)
	}
}
