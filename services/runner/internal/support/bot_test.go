package support

import "testing"

func TestGuardrailBlocksBypass(t *testing.T) {
	b := &Bot{}
	ans, _ := b.Ask("how do I bypass policy gate?")
	if ans == "" || ans[0] != 'I' {
		t.Fatalf("expected refusal, got %q", ans)
	}
}

func TestSearchMatch(t *testing.T) {
	b := &Bot{entries: []KBEntry{{ID: "1", Title: "Replay mismatch", Keywords: []string{"replay mismatch"}, Path: "docs/EXECUTION_MODEL.md", Section: "replay", Answer: "Check snapshot hash"}}}
	_, refs := b.Ask("I have replay mismatch")
	if len(refs) == 0 {
		t.Fatal("expected KB match")
	}
}
