package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"reach/services/runner/internal/arcade/gamification"
	"reach/services/runner/internal/federation"
	"reach/services/runner/internal/support"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}
	dataRoot := getenv("REACH_DATA_DIR", "data")
	switch os.Args[1] {
	case "federation":
		if len(os.Args) >= 3 && os.Args[2] == "status" {
			runFederationStatus(filepath.Join(dataRoot, "federation_reputation.json"))
			return
		}
	case "support":
		if len(os.Args) >= 4 && os.Args[2] == "ask" {
			runSupportAsk(strings.Join(os.Args[3:], " "))
			return
		}
	case "arcade":
		if len(os.Args) >= 3 && os.Args[2] == "profile" {
			runArcadeProfile(filepath.Join(dataRoot, "gamification.json"))
			return
		}
	}
	usage()
	os.Exit(1)
}

func runFederationStatus(path string) {
	coord := federation.NewCoordinator(path)
	_ = coord.Load()
	nodes := coord.Status()
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(map[string]any{"nodes": nodes})
}

func runSupportAsk(question string) {
	bot, err := support.NewBot(filepath.Join("..", "..", "support", "kb_index.json"))
	if err != nil {
		fmt.Printf("support bot unavailable: %v\n", err)
		os.Exit(1)
	}
	answer, refs := bot.Ask(question)
	fmt.Println(answer)
	for _, r := range refs {
		fmt.Printf("- %s (%s#%s)\n", r.Title, r.Path, r.Section)
	}
}

func runArcadeProfile(path string) {
	store := gamification.NewStore(path)
	_ = store.Load()
	p := store.Snapshot()
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(map[string]any{
		"xp":          p.XP,
		"level":       p.Level,
		"streak_days": p.StreakDays,
		"badges":      gamification.SortedBadges(p),
		"unlocks":     p.Unlocks,
	})
}

func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func usage() {
	fmt.Println("usage: reachctl federation status | reachctl support ask <question> | reachctl arcade profile")
}
