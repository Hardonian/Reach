package gamification

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type Profile struct {
	XP            int               `json:"xp"`
	Level         int               `json:"level"`
	StreakDays    int               `json:"streak_days"`
	LastActiveDay string            `json:"last_active_day"`
	Badges        map[string]bool   `json:"badges"`
	Stats         map[string]int    `json:"stats"`
	Unlocks       map[string]string `json:"unlocks"`
}

type Store struct {
	mu      sync.Mutex
	path    string
	Profile Profile `json:"profile"`
}

func NewStore(path string) *Store {
	return &Store{path: path, Profile: Profile{Level: 1, Badges: map[string]bool{}, Stats: map[string]int{}, Unlocks: map[string]string{}}}
}

func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	buf, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(buf, s)
}

func (s *Store) Save() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	buf, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, buf, 0o644)
}

func (s *Store) Snapshot() Profile {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.Profile
	if p.Badges == nil {
		p.Badges = map[string]bool{}
	}
	if p.Stats == nil {
		p.Stats = map[string]int{}
	}
	if p.Unlocks == nil {
		p.Unlocks = map[string]string{}
	}
	return p
}

func (s *Store) ApplyEvent(eventType string, now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := &s.Profile
	if p.Badges == nil {
		p.Badges = map[string]bool{}
	}
	if p.Stats == nil {
		p.Stats = map[string]int{}
	}
	if p.Unlocks == nil {
		p.Unlocks = map[string]string{}
	}

	today := now.UTC().Format("2006-01-02")
	if strings.HasPrefix(eventType, "run.") || eventType == "trigger.received" {
		if p.LastActiveDay != today {
			if p.LastActiveDay != "" {
				prev, _ := time.Parse("2006-01-02", p.LastActiveDay)
				if prev.Add(24*time.Hour).Format("2006-01-02") == today {
					p.StreakDays++
				} else {
					p.StreakDays = 1
				}
			} else {
				p.StreakDays = 1
			}
			p.LastActiveDay = today
		}
	}

	switch eventType {
	case "run.completed", "tool.result.accepted":
		p.XP += 10
		p.Stats["safe_completions"]++
	case "delegation.success":
		p.XP += 15
		p.Stats["delegation_success"]++
	case "policy.gate.stored":
		p.Stats["policy_denials"]++
	case "replay.verified":
		p.XP += 8
		p.Stats["replay_verified"]++
	case "run.failed":
		p.Stats["run_failed"]++
	}

	if p.Stats["replay_verified"] > 0 {
		p.Badges["Determinist"] = true
	}
	if p.Stats["policy_denials"] == 0 && p.Stats["safe_completions"] >= 10 {
		p.Badges["Policy Paladin"] = true
	}
	if p.Stats["delegation_success"] > 0 {
		p.Badges["Federation Scout"] = true
	}
	if p.Stats["run_failed"] > 0 && p.Stats["safe_completions"] > p.Stats["run_failed"] {
		p.Badges["Debugger"] = true
	}
	if p.XP > 0 {
		p.Level = 1 + p.XP/100
	}
	if p.Level >= 2 {
		p.Unlocks["theme"] = "midnight"
	}
	if p.Level >= 3 {
		p.Unlocks["flair"] = "streak-spark"
	}
	if p.Level >= 4 {
		p.Unlocks["run_card_style"] = "arcade-grid"
	}
}

func SortedBadges(p Profile) []string {
	out := make([]string, 0, len(p.Badges))
	for k, v := range p.Badges {
		if v {
			out = append(out, k)
		}
	}
	sort.Strings(out)
	return out
}
