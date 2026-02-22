// Package tutorial implements the interactive tutorial system for Reach.
// Tutorials are local-only, no network required, and teach users Reach concepts.
package tutorial

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Mission represents a single tutorial mission.
type Mission struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Steps       []string `json:"steps"`
	Hints       []string `json:"hints,omitempty"`
	Reward      int      `json:"reward"`
	Completed   bool     `json:"completed,omitempty"`
}

// Progress tracks tutorial progress.
type Progress struct {
	CurrentMission string          `json:"current_mission"`
	CompletedCount int             `json:"completed_count"`
	TotalXP        int             `json:"total_xp"`
	Missions       map[string]bool `json:"missions"`
	Started        bool            `json:"started"`
}

// Tutorial manages the tutorial system.
type Tutorial struct {
	dataRoot  string
	missions  []Mission
	progress  *Progress
}

// NewTutorial creates a tutorial manager.
func NewTutorial(dataRoot string) *Tutorial {
	t := &Tutorial{
		dataRoot: dataRoot,
		missions: builtInMissions(),
		progress: &Progress{
			Missions: make(map[string]bool),
		},
	}
	t.loadProgress()
	return t
}

// builtInMissions returns the built-in tutorial missions.
func builtInMissions() []Mission {
	return []Mission{
		{
			ID:          "welcome",
			Name:        "Welcome to Reach",
			Description: "Learn the basics of Reach and run your first verification.",
			Steps: []string{
				"Reach helps you verify that your workspace is deterministic and reproducible.",
				"Let's start by checking your workspace health.",
				"Run: reachctl doctor",
				"This will verify your environment is set up correctly.",
			},
			Hints: []string{
				"The doctor command checks your workspace for common issues.",
				"All Reach commands work offline - no network required.",
			},
			Reward: 10,
		},
		{
			ID:          "first-run",
			Name:        "Your First Run",
			Description: "Execute your first Reach run and understand the output.",
			Steps: []string{
				"A Run is a single execution of a pack with specific inputs.",
				"Let's create a simple run to see how Reach works.",
				"Run: reachctl run --pack examples/packs/minimal-safe",
				"Observe the output - you'll see a fingerprint and trust score.",
			},
			Hints: []string{
				"The fingerprint is a unique hash that proves what happened.",
				"If you run this again with the same inputs, you get the same fingerprint.",
			},
			Reward: 20,
		},
		{
			ID:          "replay-run",
			Name:        "Replay a Run",
			Description: "Learn how to replay a run and verify its integrity.",
			Steps: []string{
				"One of Reach's key features is replayability.",
				"You can re-execute any run and verify it produces the same result.",
				"Run: reachctl replay <run_id> (use the ID from your first run)",
				"The replay should show 'verified: true' if determinism is maintained.",
			},
			Hints: []string{
				"Replay works by re-executing the event log from the original run.",
				"This is essential for auditing and compliance.",
			},
			Reward: 25,
		},
		{
			ID:          "diff-runs",
			Name:        "Compare Runs",
			Description: "Learn how to compare two runs to find differences.",
			Steps: []string{
				"When runs produce different fingerprints, you need to understand why.",
				"Run: reachctl diff-run <run_id_1> <run_id_2>",
				"The diff shows what changed between the two runs.",
				"This is useful for debugging non-deterministic behavior.",
			},
			Hints: []string{
				"Common causes of drift: timestamps, random values, unordered maps.",
				"Reach helps you identify and fix these issues.",
			},
			Reward: 30,
		},
		{
			ID:          "create-checkpoint",
			Name:        "Create a Checkpoint",
			Description: "Save workspace state at a point in time.",
			Steps: []string{
				"Checkpoints let you save and restore workspace state.",
				"Run: reachctl capsule create <run_id>",
				"This creates a portable bundle with the run's proof.",
				"You can share this bundle with others for verification.",
			},
			Hints: []string{
				"Checkpoints are essential for compliance workflows.",
				"They contain everything needed to verify the run later.",
			},
			Reward: 25,
		},
		{
			ID:          "simulate-rules",
			Name:        "Simulate New Rules",
			Description: "Test policy changes before applying them.",
			Steps: []string{
				"Reach lets you test policy changes safely.",
				"Create a policy file: examples/packs/policy-denial/policy.rego",
				"Run: reachctl run --pack examples/packs/policy-denial",
				"Observe how the policy affects the run outcome.",
			},
			Hints: []string{
				"Policies are written in Rego, a policy language.",
				"You can test policies without affecting production.",
			},
			Reward: 35,
		},
		{
			ID:          "chaos-test",
			Name:        "Chaos Testing",
			Description: "Test your workspace's resilience to changes.",
			Steps: []string{
				"Chaos testing helps find non-deterministic behavior.",
				"Run: reachctl verify-determinism --n=5",
				"This runs the same operation 5 times and compares fingerprints.",
				"If all fingerprints match, your workspace is deterministic.",
			},
			Hints: []string{
				"Non-determinism often comes from: time, random, map iteration.",
				"Fix these issues to ensure reproducible builds.",
			},
			Reward: 40,
		},
		{
			ID:          "trust-score",
			Name:        "Improve Your Trust Score",
			Description: "Learn how to improve your workspace's trust score.",
			Steps: []string{
				"The trust score reflects your workspace's health.",
				"Run: reachctl doctor to see current issues.",
				"Fix any findings to improve your score.",
				"Run: reachctl recipe run drift-scan to check for drift.",
			},
			Hints: []string{
				"Higher trust scores mean more reliable, reproducible builds.",
				"Aim for 100/100 for production workspaces.",
			},
			Reward: 50,
		},
	}
}

// Start begins the tutorial.
func (t *Tutorial) Start() (*Mission, error) {
	t.progress.Started = true
	t.progress.CurrentMission = t.missions[0].ID
	t.saveProgress()
	return t.GetCurrentMission()
}

// GetCurrentMission returns the current mission.
func (t *Tutorial) GetCurrentMission() (*Mission, error) {
	for i := range t.missions {
		if t.missions[i].ID == t.progress.CurrentMission {
			mission := t.missions[i]
			mission.Completed = t.progress.Missions[mission.ID]
			return &mission, nil
		}
	}
	return nil, fmt.Errorf("no current mission")
}

// Next advances to the next mission.
func (t *Tutorial) Next() (*Mission, error) {
	currentIdx := -1
	for i, m := range t.missions {
		if m.ID == t.progress.CurrentMission {
			currentIdx = i
			break
		}
	}

	if currentIdx == -1 {
		return t.Start()
	}

	// Mark current as completed
	if !t.progress.Missions[t.progress.CurrentMission] {
		t.progress.Missions[t.progress.CurrentMission] = true
		t.progress.CompletedCount++
		t.progress.TotalXP += t.missions[currentIdx].Reward
	}

	// Move to next
	if currentIdx+1 < len(t.missions) {
		t.progress.CurrentMission = t.missions[currentIdx+1].ID
		t.saveProgress()
		return t.GetCurrentMission()
	}

	// Tutorial complete
	t.saveProgress()
	return nil, fmt.Errorf("tutorial complete! Total XP: %d", t.progress.TotalXP)
}

// Status returns the current tutorial status.
func (t *Tutorial) Status() *Progress {
	return t.progress
}

// ListMissions returns all missions with their completion status.
func (t *Tutorial) ListMissions() []Mission {
	missions := make([]Mission, len(t.missions))
	copy(missions, t.missions)
	for i := range missions {
		missions[i].Completed = t.progress.Missions[missions[i].ID]
	}
	return missions
}

// SkipMission skips the current mission.
func (t *Tutorial) SkipMission() error {
	currentIdx := -1
	for i, m := range t.missions {
		if m.ID == t.progress.CurrentMission {
			currentIdx = i
			break
		}
	}

	if currentIdx == -1 {
		return fmt.Errorf("no current mission to skip")
	}

	// Move to next without marking as completed
	if currentIdx+1 < len(t.missions) {
		t.progress.CurrentMission = t.missions[currentIdx+1].ID
		t.saveProgress()
	}

	return nil
}

// Reset resets the tutorial progress.
func (t *Tutorial) Reset() error {
	t.progress = &Progress{
		Missions: make(map[string]bool),
	}
	t.saveProgress()
	return nil
}

// ExplainMission returns a detailed explanation of a mission.
func (t *Tutorial) ExplainMission(missionID string) (string, error) {
	for _, m := range t.missions {
		if m.ID == missionID {
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## %s\n\n", m.Name))
			sb.WriteString(fmt.Sprintf("%s\n\n", m.Description))
			sb.WriteString("### Steps\n\n")
			for i, step := range m.Steps {
				sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, step))
			}
			if len(m.Hints) > 0 {
				sb.WriteString("\n### Hints\n\n")
				for _, hint := range m.Hints {
					sb.WriteString(fmt.Sprintf("- %s\n", hint))
				}
			}
			sb.WriteString(fmt.Sprintf("\n**Reward**: %d XP\n", m.Reward))
			return sb.String(), nil
		}
	}
	return "", fmt.Errorf("mission not found: %s", missionID)
}

// loadProgress loads progress from disk.
func (t *Tutorial) loadProgress() {
	path := filepath.Join(t.dataRoot, "tutorial_progress.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}

	var progress Progress
	if err := json.Unmarshal(data, &progress); err != nil {
		return
	}

	t.progress = &progress
	if t.progress.Missions == nil {
		t.progress.Missions = make(map[string]bool)
	}
}

// saveProgress saves progress to disk.
func (t *Tutorial) saveProgress() error {
	path := filepath.Join(t.dataRoot, "tutorial_progress.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(t.progress, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o644)
}

// GetMissionByID returns a mission by its ID.
func (t *Tutorial) GetMissionByID(id string) (*Mission, error) {
	for i := range t.missions {
		if t.missions[i].ID == id {
			mission := t.missions[i]
			mission.Completed = t.progress.Missions[mission.ID]
			return &mission, nil
		}
	}
	return nil, fmt.Errorf("mission not found: %s", id)
}

// CompleteMission marks a specific mission as completed.
func (t *Tutorial) CompleteMission(missionID string) error {
	for i, m := range t.missions {
		if m.ID == missionID {
			if !t.progress.Missions[missionID] {
				t.progress.Missions[missionID] = true
				t.progress.CompletedCount++
				t.progress.TotalXP += t.missions[i].Reward
			}
			// Move to next if this was current
			if t.progress.CurrentMission == missionID {
				if i+1 < len(t.missions) {
					t.progress.CurrentMission = t.missions[i+1].ID
				}
			}
			t.saveProgress()
			return nil
		}
	}
	return fmt.Errorf("mission not found: %s", missionID)
}

// GetTotalMissions returns the total number of missions.
func (t *Tutorial) GetTotalMissions() int {
	return len(t.missions)
}

// GetCompletionPercentage returns the completion percentage.
func (t *Tutorial) GetCompletionPercentage() float64 {
	if len(t.missions) == 0 {
		return 0
	}
	return float64(t.progress.CompletedCount) / float64(len(t.missions)) * 100
}

// GetLeaderboard returns a sorted list of missions by reward (for display purposes).
func (t *Tutorial) GetLeaderboard() []Mission {
	missions := make([]Mission, len(t.missions))
	copy(missions, t.missions)
	
	sort.Slice(missions, func(i, j int) bool {
		return missions[i].Reward > missions[j].Reward
	})
	
	return missions
}
