# Demo Video Script: 8-Minute Deep Dive

**Target Audience:** Engineers, architects, technical buyers  
**Tone:** Authoritative, educational, detailed  
**Visual Style:** Terminal + code editor + architecture diagrams

---

## Act 1: The Problem Space (0:00-1:30)

### Scene 1.1: AI in Production (0:00-0:45)

**[VISUAL: Montage of AI applications - chatbots, recommendations, decisions]**

**VOICEOVER:**
"AI is powering critical infrastructure. Fraud detection. Medical diagnosis. Autonomous systems. These decisions matter. They affect lives, money, and trust."

**[VISUAL: News headlines about AI failures]**

- "Trading algorithm loses $440 million in 45 minutes"
- "Recommendation system promotes harmful content"
- "Self-driving car makes fatal decision"

**VOICEOVER:**
"But when AI goes wrong, how do you debug it? How do you prove what it was thinking? Traditional AI systems are opaque. You can't reproduce their decisions. You can't audit their reasoning."

---

### Scene 1.2: The Requirements (0:45-1:30)

**[VISUAL: Whiteboard animation - requirements appearing]**

**ON-SCREEN TEXT:**
"Production AI Requirements:
✓ Deterministic - same input, same output
✓ Auditable - every decision logged
✓ Replayable - reconstruct exactly what happened
✓ Verifiable - cryptographic proof of execution
✓ Policy-enforced - rules applied consistently"

**VOICEOVER:**
"For AI in production, you need determinism. You need audit trails. You need to replay decisions exactly as they happened. And you need all of this enforced by policies that can't be bypassed."

**[VISUAL: Transition to terminal]**

**VOICEOVER:**
"Reach provides all of this. Let me show you."

---

## Act 2: Core Concepts (1:30-3:30)

### Scene 2.1: What is Reach? (1:30-2:15)

**[VISUAL: Terminal with clean install]**

**VOICEOVER:**
"Reach is a deterministic decision engine. It evaluates scenarios, applies policies, and produces cryptographically-verifiable decisions."

**[ACTION: Show installation]**

```bash
# One-line install
curl -sSL https://reach.dev/install.sh | bash

# Verify
./reach doctor
```

**[VISUAL: Doctor output with all checks passing]**

```
reach doctor (linux/amd64)
[OK]   git installed and accessible
[OK]   go installed
[OK]   node version >= 18
[OK]   configuration check
reach doctor passed
```

**VOICEOVER:**
"The doctor command verifies your environment. Everything you need for deterministic execution."

---

### Scene 2.2: Anatomy of a Decision (2:15-3:30)

**[VISUAL: Code editor showing JSON structure]**

**VOICEOVER:**
"A Reach decision has three parts: actions you can take, scenarios that might occur, and outcomes that link them together."

**[ACTION: Show decision input]**

```bash
cat fixtures/events/simple-decision.json
```

**[VISUAL: Animated breakdown of structure]**

```json
{
  "actions": [
    { "id": "scale_up", "label": "Scale up resources" },
    { "id": "optimize", "label": "Optimize existing" }
  ],
  "scenarios": [
    { "id": "high_load", "probability": 0.7 },
    { "id": "normal_load", "probability": 0.3 }
  ],
  "outcomes": [
    ["scale_up", "high_load", 150],
    ["scale_up", "normal_load", 50],
    ["optimize", "high_load", 80],
    ["optimize", "normal_load", 120]
  ]
}
```

**VOICEOVER:**
"Actions are what you can do. Scenarios represent possible futures. Outcomes define what happens when you take an action in a scenario."

**[VISUAL: Decision matrix visualization]**

**VOICEOVER:**
"Reach evaluates the expected utility of each action, accounting for scenario probabilities. The action with the highest expected utility wins."

---

## Act 3: Live Demonstration (3:30-6:00)

### Scene 3.1: Basic Execution (3:30-4:15)

**[VISUAL: Terminal - run a decision]**

**VOICEOVER:**
"Let's run this infrastructure scaling decision."

**[ACTION: Execute]**

```bash
./reach run fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json \
  --verbose
```

**[VISUAL: Output appears with sections highlighted]**

```
=== Reach Decision Engine ===
Input loaded: fixtures/events/simple-decision.json
Actions: 2 | Scenarios: 2 | Outcomes: 4

Evaluation:
  scale_up:
    Expected Utility: 120.0
    Calculation: (150 × 0.7) + (50 × 0.3)
  optimize:
    Expected Utility: 102.5
    Calculation: (80 × 0.7) + (120 × 0.3)

Decision: scale_up
Confidence: 92%

Fingerprint: 9f86d081884c7d659a2feaa0c55ad015
Evidence: 5 items collected
```

**VOICEOVER:**
"Reach selected 'scale up' with 92% confidence. But more importantly, notice the fingerprint. This 64-character string uniquely identifies this exact decision."

---

### Scene 3.2: Determinism Verification (4:15-5:00)

**[VISUAL: Terminal - run verification]**

**VOICEOVER:**
"The fingerprint is deterministic. Same input always produces the same fingerprint. Let me prove it."

**[ACTION: Run multiple times]**

```bash
./reach verify-determinism --n 5 \
  --pack fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json
```

**[VISUAL: Output with matching fingerprints]**

```
Run 1: 9f86d081884c7d659a2feaa0c55ad015... ✓
Run 2: 9f86d081884c7d659a2feaa0c55ad015... ✓
Run 3: 9f86d081884c7d659a2feaa0c55ad015... ✓
Run 4: 9f86d081884c7d659a2feaa0c55ad015... ✓
Run 5: 9f86d081884c7d659a2feaa0c55ad015... ✓

All 5 fingerprints match.
Determinism verified.
```

**VOICEOVER:**
"Five runs, identical fingerprints. This works across platforms—Linux, macOS, Windows. Same input, same output, guaranteed."

---

### Scene 3.3: Replay and Audit (5:00-6:00)

**[VISUAL: Terminal - replay a previous run]**

**VOICEOVER:**
"Now here's where it gets powerful. Every decision is replayable."

**[ACTION: List runs]**

```bash
./reach list-runs --limit 5
```

**[VISUAL: Run list]**

```
RUN ID                      FINGERPRINT                         STATUS
run_20260223_195246_abc     9f86d081884c7d659a2feaa0c55ad015    completed
run_20260223_195240_def     a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6    completed
...
```

**[ACTION: Replay specific run]**

```bash
./reach replay run_20260223_195246_abc --verify
```

**[VISUAL: Replay output]**

```
Replaying: run_20260223_195246_abc
Input hash: a3f5c8e2d9b1470e6f8a2c5d7e9b1f4a... ✓
Execution trace: 8 steps ✓
Output hash: f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6... ✓
Fingerprint: 9f86d081884c7d659a2feaa0c55ad015... ✓

Replay verified. Decision is authentic.
```

**VOICEOVER:**
"The replay reconstructs exactly what happened. Input, execution, output—all verified against cryptographic hashes. You can prove, beyond doubt, what the decision was and how it was made."

---

## Act 4: Advanced Features (6:00-7:15)

### Scene 4.1: Policy Enforcement (6:00-6:35)

**[VISUAL: Show policy pack]**

**VOICEOVER:**
"Reach enforces policies at the engine level. Policies can restrict which tools are available, set rate limits, and require specific safety checks."

**[ACTION: Show strict policy]**

```bash
cat fixtures/bundles/strict-policy.json | jq '.capabilities'
```

**[VISUAL: Policy content]**

```json
{
  "capabilities": {
    "allowed_tools": ["file_read", "file_list"],
    "blocked_tools": ["shell_exec", "file_write"],
    "max_iterations": 100
  }
}
```

**VOICEOVER:**
"This policy allows read operations but blocks writes and shell execution. Even if the decision logic requests a blocked action, the policy prevents it."

---

### Scene 4.2: Federation (6:35-7:15)

**[VISUAL: Architecture diagram - multiple nodes]**

**VOICEOVER:**
"Reach supports federation—distributed execution across multiple nodes. This enables high availability and consensus-based decisions."

**[VISUAL: Show federation config]**

```json
{
  "federation": {
    "enabled": true,
    "min_nodes": 3,
    "consensus_threshold": 0.67
  }
}
```

**VOICEOVER:**
"A decision runs on multiple independent nodes. The results are compared. If they don't match, the discrepancy is flagged. This prevents single points of failure and detects compromised nodes."

---

## Act 5: Conclusion (7:15-8:00)

### Scene 5.1: Summary (7:15-7:40)

**[VISUAL: Quick recap montage]**

**VOICEOVER:**
"Let's recap. Reach provides:"

**[VISUAL: Points appear on screen]**

1. **Deterministic decisions** - Same input, same output, guaranteed
2. **Cryptographic proof** - Every decision fingerprinted and verifiable
3. **Full audit trails** - Replay any decision exactly as it happened
4. **Policy enforcement** - Safety rules applied at the engine level
5. **Federation support** - Distributed consensus for critical decisions

---

### Scene 5.2: Get Started (7:40-8:00)

**[VISUAL: Terminal showing quickstart]**

**VOICEOVER:**
"Reach is open source. Get started in under a minute."

**[ACTION: Quick commands]**

```bash
git clone https://github.com/reach/reach.git
cd reach
./reach doctor
node examples/01-quickstart-local/run.js
```

**[VISUAL: Output showing success]**

**ON-SCREEN TEXT:**

```
github.com/reach/reach

Documentation: reach.dev/docs
Discord: discord.gg/reach
Examples: /examples
```

**VOICEOVER:**
"Prove every decision. Build trustworthy AI. Get started today."

**[VISUAL: Reach logo, tagline, fade out]**

**TAGLINE:**
"Deterministic Decisions for Production AI"

---

## Production Notes

### Chapter Markers

| Time | Chapter  | Description           |
| ---- | -------- | --------------------- |
| 0:00 | Intro    | Problem space         |
| 1:30 | Concepts | Core Reach concepts   |
| 3:30 | Demo     | Live demonstration    |
| 6:00 | Advanced | Policy and federation |
| 7:15 | Outro    | Summary and CTA       |

### Technical Requirements

- Primary: Terminal recordings (asciinema or screen capture)
- Secondary: Code editor for JSON walkthrough
- Graphics: Architecture diagrams (Mermaid or Excalidraw)
- B-roll: Server infrastructure, team collaboration

### Recording Commands

```bash
# Pre-stage for smooth recording
cd /tmp/reach-demo
cp -r ~/reach/fixtures .
cp -r ~/reach/examples .

# Use deterministic timestamps
export REACH_FROZEN_TIME=2026-02-23T12:00:00Z
```

### Export Specs

- **Resolution:** 1920x1080
- **Frame rate:** 30fps
- **Format:** MP4 (H.264)
- **Audio:** AAC 128kbps
- **Duration:** Exactly 8:00 including outro

---

## Companion Assets

Create alongside this video:

- [ ] 30-second cut for social media
- [ ] 2-minute cut (see demo-video-script-2min.md)
- [ ] Thumbnail image (1280x720)
- [ ] End screen with links
