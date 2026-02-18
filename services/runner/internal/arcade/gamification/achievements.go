package gamification

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Achievement represents a single achievement definition.
type Achievement struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Category    string            `json:"category"`
	Rarity      Rarity            `json:"rarity"`
	Condition   AchievementCondition `json:"condition"`
	Icon        string            `json:"icon"`
	UnlockedAt  *time.Time        `json:"unlockedAt,omitempty"`
}

// Rarity indicates achievement rarity.
type Rarity string

const (
	RarityCommon    Rarity = "common"
	RarityUncommon  Rarity = "uncommon"
	RarityRare      Rarity = "rare"
	RarityEpic      Rarity = "epic"
	RarityLegendary Rarity = "legendary"
)

// AchievementCondition defines how to unlock.
type AchievementCondition struct {
	Type   string            `json:"type"` // "count", "streak", "flag", "composite"
	Target int               `json:"target,omitempty"`
	Flags  map[string]bool   `json:"flags,omitempty"`
}

// AchievementProgress tracks user progress.
type AchievementProgress struct {
	Unlocked   map[string]time.Time `json:"unlocked"`   // achievement ID -> timestamp
	Progress   map[string]int       `json:"progress"`   // achievement ID -> current count
	Stats      AchievementStats     `json:"stats"`
	UpdatedAt  time.Time            `json:"updatedAt"`
}

// AchievementStats tracks raw statistics.
type AchievementStats struct {
	TotalRuns          int       `json:"totalRuns"`
	VerifiedRuns       int       `json:"verifiedRuns"`
	CapsulesCreated    int       `json:"capsulesCreated"`
	PacksPublished     int       `json:"packsPublished"`
	TrustedNodes       int       `json:"trustedNodes"`
	ConsecutiveMatches int       `json:"consecutiveMatches"`
	EdgeModeRuns       int       `json:"edgeModeRuns"`
	OfflineRuns        int       `json:"offlineRuns"`
	FirstRunAt         time.Time `json:"firstRunAt"`
	LastRunAt          time.Time `json:"lastRunAt"`
}

// AchievementEngine manages achievements.
type AchievementEngine struct {
	mu        sync.RWMutex
	storePath string
	progress  AchievementProgress
	defs      map[string]Achievement
	notifier  func(Achievement)
}

// NewAchievementEngine creates an achievement engine.
func NewAchievementEngine(storePath string) *AchievementEngine {
	return &AchievementEngine{
		storePath: storePath,
		progress: AchievementProgress{
			Unlocked: make(map[string]time.Time),
			Progress: make(map[string]int),
			Stats:    AchievementStats{},
			UpdatedAt: time.Now(),
		},
		defs:     makeDefaultAchievements(),
		notifier: nil,
	}
}

// SetNotifier sets a callback for achievement unlocks.
func (e *AchievementEngine) SetNotifier(fn func(Achievement)) {
	e.notifier = fn
}

// Load reads progress from disk.
func (e *AchievementEngine) Load() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	data, err := os.ReadFile(e.storePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	
	return json.Unmarshal(data, &e.progress)
}

// Save writes progress to disk.
func (e *AchievementEngine) Save() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	if err := os.MkdirAll(filepath.Dir(e.storePath), 0o755); err != nil {
		return err
	}
	
	e.progress.UpdatedAt = time.Now()
	data, err := json.MarshalIndent(e.progress, "", "  ")
	if err != nil {
		return err
	}
	
	return os.WriteFile(e.storePath, data, 0o644)
}

// RecordEvent processes an event and updates achievements.
func (e *AchievementEngine) RecordEvent(eventType string, data map[string]any) []Achievement {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	now := time.Now()
	e.progress.Stats.LastRunAt = now
	
	if e.progress.Stats.FirstRunAt.IsZero() {
		e.progress.Stats.FirstRunAt = now
	}
	
	// Update stats based on event
	switch eventType {
	case "run.completed":
		e.progress.Stats.TotalRuns++
	case "run.verified":
		e.progress.Stats.VerifiedRuns++
		e.progress.Stats.ConsecutiveMatches++
	case "run.mismatch":
		e.progress.Stats.ConsecutiveMatches = 0
	case "capsule.created":
		e.progress.Stats.CapsulesCreated++
	case "pack.published":
		e.progress.Stats.PacksPublished++
	case "node.trusted":
		e.progress.Stats.TrustedNodes++
	case "run.edge_mode":
		e.progress.Stats.EdgeModeRuns++
	case "run.offline":
		e.progress.Stats.OfflineRuns++
	}
	
	// Check achievements
	unlocked := make([]Achievement, 0)
	for id, def := range e.defs {
		if _, has := e.progress.Unlocked[id]; has {
			continue
		}
		
		if e.checkCondition(def.Condition, eventType, data) {
			e.progress.Unlocked[id] = now
			unlocked = append(unlocked, def)
			
			if e.notifier != nil {
				e.notifier(def)
			}
		}
	}
	
	return unlocked
}

func (e *AchievementEngine) checkCondition(cond AchievementCondition, eventType string, data map[string]any) bool {
	switch cond.Type {
	case "first_run":
		return e.progress.Stats.TotalRuns >= 1
	case "count":
		return e.getStatCount(cond.Flags) >= cond.Target
	case "streak":
		return e.progress.Stats.ConsecutiveMatches >= cond.Target
	case "flag":
		return data != nil && matchesFlags(data, cond.Flags)
	case "composite":
		return e.getStatCount(cond.Flags) >= cond.Target
	default:
		return false
	}
}

func (e *AchievementEngine) getStatCount(flags map[string]bool) int {
	if flags == nil {
		return 0
	}
	
	count := 0
	if flags["totalRuns"] && e.progress.Stats.TotalRuns > 0 {
		count = e.progress.Stats.TotalRuns
	}
	if flags["verifiedRuns"] {
		count = e.progress.Stats.VerifiedRuns
	}
	if flags["capsulesCreated"] {
		count = e.progress.Stats.CapsulesCreated
	}
	if flags["packsPublished"] {
		count = e.progress.Stats.PacksPublished
	}
	if flags["trustedNodes"] {
		count = e.progress.Stats.TrustedNodes
	}
	if flags["edgeModeRuns"] {
		count = e.progress.Stats.EdgeModeRuns
	}
	if flags["offlineRuns"] {
		count = e.progress.Stats.OfflineRuns
	}
	
	return count
}

func matchesFlags(data, flags map[string]bool) bool {
	for key, value := range flags {
		if data[key] != value {
			return false
		}
	}
	return true
}

// GetProgress returns current achievement progress.
func (e *AchievementEngine) GetProgress() AchievementProgress {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.progress
}

// GetUnlocked returns all unlocked achievements.
func (e *AchievementEngine) GetUnlocked() []Achievement {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	result := make([]Achievement, 0, len(e.progress.Unlocked))
	for id := range e.progress.Unlocked {
		if def, ok := e.defs[id]; ok {
			result = append(result, def)
		}
	}
	return result
}

// GetAllAchievements returns all achievement definitions.
func (e *AchievementEngine) GetAllAchievements() []Achievement {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	result := make([]Achievement, 0, len(e.defs))
	for _, def := range e.defs {
		result = append(result, def)
	}
	return result
}

// Reset clears all progress (for testing).
func (e *AchievementEngine) Reset() {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	e.progress = AchievementProgress{
		Unlocked:  make(map[string]time.Time),
		Progress:  make(map[string]int),
		Stats:     AchievementStats{},
		UpdatedAt: time.Now(),
	}
}

func makeDefaultAchievements() map[string]Achievement {
	return map[string]Achievement{
		"first_run": {
			ID:          "first_run",
			Name:        "First Run",
			Description: "Execute your first Reach pack",
			Category:    "beginner",
			Rarity:      RarityCommon,
			Icon:        "🚀",
			Condition: AchievementCondition{
				Type: "first_run",
			},
		},
		"replay_verified": {
			ID:          "replay_verified",
			Name:        "Replay Verified",
			Description: "Successfully verify a deterministic replay",
			Category:    "trust",
			Rarity:      RarityCommon,
			Icon:        "✓",
			Condition: AchievementCondition{
				Type:   "count",
				Target: 1,
				Flags:  map[string]bool{"verifiedRuns": true},
			},
		},
		"capsule_created": {
			ID:          "capsule_created",
			Name:        "Capsule Created",
			Description: "Create your first execution capsule",
			Category:    "creation",
			Rarity:      RarityCommon,
			Icon:        "💊",
			Condition: AchievementCondition{
				Type:   "count",
				Target: 1,
				Flags:  map[string]bool{"capsulesCreated": true},
			},
		},
		"pack_published": {
			ID:          "pack_published",
			Name:        "Pack Published",
			Description: "Publish a pack to the registry",
			Category:    "creation",
			Rarity:      RarityUncommon,
			Icon:        "📦",
			Condition: AchievementCondition{
				Type:   "count",
				Target: 1,
				Flags:  map[string]bool{"packsPublished": true},
			},
		},
		"federation_trusted": {
			ID:          "federation_trusted",
			Name:        "Federation Node Trusted",
			Description: "Establish trust with a federation node",
			Category:    "federation",
			Rarity:      RarityUncommon,
			Icon:        "🤝",
			Condition: AchievementCondition{
				Type:   "count",
				Target: 1,
				Flags:  map[string]bool{"trustedNodes": true},
			},
		},
		"determinism_100": {
			ID:          "determinism_100",
			Name:        "100% Determinism",
			Description: "Complete 10 consecutive verified runs without mismatch",
			Category:    "trust",
			Rarity:      RarityRare,
			Icon:        "🎯",
			Condition: AchievementCondition{
				Type:   "streak",
				Target: 10,
			},
		},
		"edge_mode_master": {
			ID:          "edge_mode_master",
			Name:        "Edge Mode Master",
			Description: "Complete 25 runs in Edge Mode",
			Category:    "edge",
			Rarity:      RarityUncommon,
			Icon:        "📱",
			Condition: AchievementCondition{
				Type:   "count",
				Target: 25,
				Flags:  map[string]bool{"edgeModeRuns": true},
			},
		},
		"offline_warrior": {
			ID:          "offline_warrior",
			Name:        "Offline Warrior",
			Description: "Complete 10 runs without network connectivity",
			Category:    "edge",
			Rarity:      RarityRare,
			Icon:        "🏕️",
			Condition: AchievementCondition{
				Type:   "count",
				Target: 10,
				Flags:  map[string]bool{"offlineRuns": true},
			},
		},
		"veteran_runner": {
			ID:          "veteran_runner",
			Name:        "Veteran Runner",
			Description: "Execute 100 total runs",
			Category:    "milestone",
			Rarity:      RarityEpic,
			Icon:        "🏆",
			Condition: AchievementCondition{
				Type:   "count",
				Target: 100,
				Flags:  map[string]bool{"totalRuns": true},
			},
		},
		"determinism_sage": {
			ID:          "determinism_sage",
			Name:        "Determinism Sage",
			Description: "Achieve 100 consecutive verified runs",
			Category:    "trust",
			Rarity:      RarityLegendary,
			Icon:        "🔮",
			Condition: AchievementCondition{
				Type:   "streak",
				Target: 100,
			},
		},
	}
}

// ProfileDisplay formats achievements for CLI display.
type ProfileDisplay struct {
	TotalAchievements int               `json:"totalAchievements"`
	UnlockedCount     int               `json:"unlockedCount"`
	CompletionPercent float64           `json:"completionPercent"`
	RecentUnlocks     []Achievement     `json:"recentUnlocks"`
	Stats             AchievementStats  `json:"stats"`
}

// GetProfileDisplay formats profile for display.
func (e *AchievementEngine) GetProfileDisplay() ProfileDisplay {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	total := len(e.defs)
	unlocked := len(e.progress.Unlocked)
	
	recent := make([]Achievement, 0)
	for id, when := range e.progress.Unlocked {
		if time.Since(when) < 24*time.Hour {
			if def, ok := e.defs[id]; ok {
				def.UnlockedAt = &when
				recent = append(recent, def)
			}
		}
	}
	
	return ProfileDisplay{
		TotalAchievements: total,
		UnlockedCount:     unlocked,
		CompletionPercent: float64(unlocked) / float64(total) * 100,
		RecentUnlocks:     recent,
		Stats:             e.progress.Stats,
	}
}

// FormatAchievement returns a formatted string for display.
func FormatAchievement(a Achievement) string {
	rarityColors := map[Rarity]string{
		RarityCommon:    "\033[37m", // White
		RarityUncommon:  "\033[32m", // Green
		RarityRare:      "\033[34m", // Blue
		RarityEpic:      "\033[35m", // Purple
		RarityLegendary: "\033[33m", // Gold
	}
	
	reset := "\033[0m"
	color := rarityColors[a.Rarity]
	
	unlocked := ""
	if a.UnlockedAt != nil {
		unlocked = fmt.Sprintf(" (Unlocked: %s)", a.UnlockedAt.Format("2006-01-02"))
	}
	
	return fmt.Sprintf("%s%s %s\033[0m - %s [%s]%s", 
		color, a.Icon, a.Name, a.Description, a.Rarity, unlocked)
}
