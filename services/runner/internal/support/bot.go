package support

import (
	"encoding/json"
	"os"
	"regexp"
	"sort"
	"strings"
)

type KBEntry struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Keywords []string `json:"keywords"`
	Path     string   `json:"path"`
	Section  string   `json:"section"`
	Answer   string   `json:"answer"`
}

type Bot struct {
	entries []KBEntry
}

func NewBot(indexPath string) (*Bot, error) {
	buf, err := os.ReadFile(indexPath)
	if err != nil {
		return nil, err
	}
	var entries []KBEntry
	if err := json.Unmarshal(buf, &entries); err != nil {
		return nil, err
	}
	return &Bot{entries: entries}, nil
}

func (b *Bot) Ask(question string) (string, []KBEntry) {
	q := strings.ToLower(redactSecrets(question))
	if unsafeRequest(q) {
		return "I can’t help with bypassing policy, signing, audit, or replay checks. I can help debug the safe path instead.", nil
	}
	matches := b.search(q)
	if len(matches) == 0 {
		return "I couldn't find an exact match. Try `reach federation status` and check docs/FEDERATION_COORDINATION.md or docs/SUPPORT_BOT.md.", nil
	}
	return matches[0].Answer, matches
}

func (b *Bot) search(q string) []KBEntry {
	type ranked struct {
		entry KBEntry
		score int
	}
	result := make([]ranked, 0, len(b.entries))
	for _, e := range b.entries {
		score := 0
		title := strings.ToLower(e.Title)
		if strings.Contains(title, q) || strings.Contains(q, title) {
			score += 6
		}
		for _, kw := range e.Keywords {
			if strings.Contains(q, strings.ToLower(kw)) {
				score += 3
			}
		}
		if score > 0 {
			result = append(result, ranked{entry: e, score: score})
		}
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].score == result[j].score {
			return result[i].entry.ID < result[j].entry.ID
		}
		return result[i].score > result[j].score
	})
	out := make([]KBEntry, 0, len(result))
	for _, r := range result {
		out = append(out, r.entry)
	}
	return out
}

func unsafeRequest(q string) bool {
	unsafe := []string{"bypass policy", "disable signing", "ignore replay", "skip audit", "unsafe tool"}
	for _, u := range unsafe {
		if strings.Contains(q, u) {
			return true
		}
	}
	return false
}

var tokenPattern = regexp.MustCompile(`(?i)(api[_-]?key|token|secret)\s*[:=]\s*[^\s]+`)

func redactSecrets(in string) string {
	return tokenPattern.ReplaceAllString(in, "$1=[REDACTED]")
}
