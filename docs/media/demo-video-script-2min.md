# Demo Video Script: 2-Minute Quick Intro

**Target Audience:** Technical evaluators, decision-makers  
**Tone:** Energetic, professional, results-focused  
**Visual Style:** Terminal recordings with clean UI, occasional zoom on key output

---

## Scene 1: The Problem (0:00-0:20)

**[VISUAL: Split screen - chaotic logs on left, clean Reach output on right]**

**VOICEOVER:**
"AI systems are making critical decisions. But how do you prove they made the right call? How do you replay what happened when something goes wrong?"

**[VISUAL: Error message, frustrated developer]**

**VOICEOVER:**
"Traditional AI is a black box. Reach changes that."

---

## Scene 2: The Hook (0:20-0:35)

**[VISUAL: Terminal opens, clean prompt]**

**VOICEOVER:**
"Reach is a deterministic decision engine. Every decision is cryptographically proven, fully auditable, and bit-identically replayable."

**[ACTION: Type command]**

```bash
./reach doctor
```

**[VISUAL: Green checkmarks flow down screen]**

**ON-SCREEN TEXT:**
"✓ Deterministic by design"

---

## Scene 3: Live Demo (0:35-1:20)

**[VISUAL: Terminal - show the full command and output]**

**VOICEOVER:**
"Watch this. We define a decision scenario—infrastructure scaling based on predicted load."

**[ACTION: Show input JSON]**

```bash
cat fixtures/events/simple-decision.json | jq '.actions, .scenarios'
```

**[VISUAL: Highlight actions and scenarios]**

**VOICEOVER:**
"Two actions: scale up or optimize. Two scenarios: high load or normal. Each with expected outcomes."

**[ACTION: Run the decision]**

```bash
./reach run fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json
```

**[VISUAL: Terminal output appears]**

```
=== Reach Decision ===
Status: completed
Selected: scale_up
Confidence: 92%
Expected Utility: 125.5

Fingerprint: 9f86d081884c7d659a2feaa0c55ad015
Evidence: 5 items collected
Replay Available: yes
```

**VOICEOVER:**
"Reach evaluates every scenario, selects the optimal action, and produces a cryptographic fingerprint. This fingerprint uniquely identifies this exact decision."

---

## Scene 4: The Proof (1:20-1:50)

**[VISUAL: Terminal - run same command again]**

**VOICEOVER:**
"Here's the magic. Run it again with the same input..."

**[ACTION: Run again]**

```bash
./reach run ...
```

**[VISUAL: Output appears - fingerprint identical]**

```
Fingerprint: 9f86d081884c7d659a2feaa0c55ad015
```

**VOICEOVER:**
"Identical fingerprint. Every. Single. Time. Same input, same output, guaranteed."

**[VISUAL: Side-by-side comparison of outputs]**

**[ACTION: Show verification]**

```bash
./reach verify-determinism --n 5 \
  --pack fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json
```

**[VISUAL: Checkmarks for all 5 runs]**

```
✓ Run 1: 9f86d081...
✓ Run 2: 9f86d081...
✓ Run 3: 9f86d081...
✓ Run 4: 9f86d081...
✓ Run 5: 9f86d081...

All 5 fingerprints match.
```

---

## Scene 5: The Call to Action (1:50-2:00)

**[VISUAL: GitHub repo page, then quick cuts of docs, examples, Discord]**

**VOICEOVER:**
"Reach. Deterministic decisions for production AI. Open source, ready to use."

**ON-SCREEN TEXT:**
```
github.com/reach/reach

npm install -g @reach/cli
pip install reach-sdk
```

**VOICEOVER:**
"Get started in 60 seconds. Links in the description."

**[VISUAL: Reach logo, tagline]**

**TAGLINE:**
"Prove Every Decision"

**[FADE OUT]**

---

## Production Notes

### Recording Setup

```bash
# Terminal styling
export PS1="\$ "  # Minimal prompt
alias clear='printf "\033c"'  # Clean clear

# Use demo mode for consistent output
export REACH_DEMO_MODE=1

# Terminal: 100x30, font: 16pt monospace, theme: dark
```

### Key Visual Elements

| Timestamp | Element | Notes |
|-----------|---------|-------|
| 0:35 | Input JSON | Use `jq` for syntax highlighting |
| 0:55 | Terminal output | Pause on fingerprint line |
| 1:25 | Second run | Split screen to show match |
| 1:45 | Verification | Zoom in on final result |

### B-Roll Shots

- Typing on keyboard (close-up)
- Server racks (ambient)
- Code scrolling (abstract)
- Fingerprints animating (graphic)

### Music

- 0:00-0:20: Subtle tension
- 0:20-1:50: Upbeat tech groove
- 1:50-2:00: Clean resolve

---

## Post-Production Checklist

- [ ] Captions for all terminal commands
- [ ] Highlight fingerprints with box outline
- [ ] Add "WHOOSH" sound on transitions
- [ ] End with 5-second outro screen (links)
- [ ] Export: 1080p, 30fps, H.264
