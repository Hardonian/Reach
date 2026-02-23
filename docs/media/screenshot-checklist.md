# Screenshot Checklist

A comprehensive guide for capturing consistent, professional screenshots of Reach for documentation, marketing, and press use.

---

## Terminal Settings

### macOS (iTerm2/Terminal)

```bash
# Font: SF Mono, Menlo, or JetBrains Mono, 14pt
# Theme: Dark background (recommended)
# Window size: 100 columns x 30 rows

# Export for consistency
echo 'export PS1="$ "' >> ~/.zshrc
echo 'export CLICOLOR_FORCE=1' >> ~/.zshrc
```

### Windows (Windows Terminal)

```powershell
# Font: Cascadia Mono, 14pt
# Color scheme: Campbell or One Half Dark
# Window size: 100 columns x 30 rows

# Minimal prompt
function Prompt { "$ " }
```

### Linux (GNOME Terminal/Konsole)

```bash
# Font: Fira Code or JetBrains Mono, 12pt
# Color: Tango or Solarized Dark
# Window: 100x30

export PS1="$ "
```

---

## Screenshot Categories

### 1. Hero Shots

**Purpose:** Marketing materials, README headers, launch posts

| Shot | Command | Notes |
|------|---------|-------|
| Quickstart | `./reach doctor` passing | All green checkmarks |
| Decision output | `./reach run ...` with fingerprint | Highlight fingerprint |
| Verification | `./reach verify-determinism --n 5` | All fingerprints matching |
| Replay | `./reach replay <run_id> --verify` | "Replay verified" message |

**Styling:**
- Full terminal window visible
- Clean background (no desktop clutter)
- Command prompt at top, output below

---

### 2. Documentation Screenshots

**Purpose:** Docs, tutorials, troubleshooting guides

| Shot | Content | Annotations |
|------|---------|-------------|
| Doctor output | Full `reach doctor` output | Number each check |
| Error example | Common failure with fix | Arrow to error message |
| Decision matrix | Input JSON structure | Highlight key fields |
| Replay trace | Execution steps | Step numbers |
| Federation diagram | Multi-node output | Node labels |

**Styling:**
- Crop to relevant content
- Use red boxes for errors, green for success
- Add callouts with Skitch/CleanShot

---

### 3. Feature Highlights

**Purpose:** Social media, blog posts, release notes

| Feature | Command | Visual |
|---------|---------|--------|
| Determinism | `verify-determinism` | Fingerprint match animation |
| Policies | Policy denied message | Lock icon overlay |
| Federation | Multi-node consensus | Connected nodes graphic |
| Replay | `replay --verify` | Timeline visualization |
| Fingerprints | Close-up of hash | Magnified view |

**Styling:**
- Tight crop on relevant text
- High contrast
- 1200x630 for social sharing

---

## Shot List by Use Case

### README.md

- [ ] Main hero: `./reach doctor` passing
- [ ] Quick start: `node examples/01-quickstart-local/run.js`
- [ ] Decision output with fingerprint
- [ ] Architecture diagram (exported)

### Landing Page

- [ ] Animated GIF: Verification running
- [ ] Screenshot: Decision matrix visualization
- [ ] Screenshot: Replay timeline
- [ ] Team photo (if applicable)

### Documentation Site

- [ ] Installation: Package manager outputs
- [ ] Configuration: `.env` file example
- [ ] Troubleshooting: Error messages with fixes
- [ ] API: JSON request/response pairs

### Social Media

- [ ] Twitter/X: 1200x675, fingerprint close-up
- [ ] LinkedIn: 1200x627, feature highlight
- [ ] GitHub: 1280x640, terminal aesthetic

### Press Kit

- [ ] Logo variations (light/dark)
- [ ] Product screenshots (all features)
- [ ] Team/action shots
- [ ] Architecture diagram

---

## Capture Workflow

### 1. Preparation

```bash
# Clean environment
unset REACH_DATA_DIR
unset REACH_LOG_LEVEL
export REACH_DEMO_MODE=1

# Reset to known state
rm -rf /tmp/reach-screenshot-demo
mkdir -p /tmp/reach-screenshot-demo
cd /tmp/reach-screenshot-demo
cp -r ~/reach/fixtures .
cp -r ~/reach/examples .

# Configure terminal
export PS1="$ "
clear
```

### 2. Capture

```bash
# For static screenshots
# Use: CleanShot X (macOS), ShareX (Windows), Flameshot (Linux)

# For recordings/GIFs
# Use: asciinema, Screen Studio, or LICEcap
```

### 3. Post-Processing

```bash
# Resize for consistency
convert screenshot.png -resize 1920x1080 screenshot-1920.png

# Add subtle shadow
convert screenshot.png \
  \( +clone -background black -shadow 80x3+5+5 \) +swap \
  -background white -layers merge screenshot-shadow.png

# Annotate
# Use: Skitch, Preview (macOS), or GIMP
```

---

## Annotation Guidelines

### Colors

| Use | Color | Hex |
|-----|-------|-----|
| Success/OK | Green | #4CAF50 |
| Error/Fail | Red | #F44336 |
| Warning | Yellow | #FFC107 |
| Info/Highlight | Blue | #2196F3 |
| Text/Arrows | White | #FFFFFF |

### Arrow Style

- Red border (#F44336)
- White fill with 80% opacity
- 3px stroke width
- Rounded corners

### Text Overlay

- Font: System sans-serif, 18pt bold
- Shadow: 2px black offset
- Background: 80% black rounded rectangle

---

## Common Mistakes to Avoid

| ❌ Don't | ✅ Do |
|----------|-------|
| Personal info in prompt | Use generic `user@host` or `$` |
| Messy desktop background | Solid color or blurred background |
| Typos in commands | Pre-type and copy-paste |
| Wrong terminal size | Always 100x30 minimum |
| Inconsistent fonts | Pick one monospace font |
| Cursor visible in shot | Hide cursor or position carefully |
| Sensitive data | Use fixtures/example data only |

---

## Pre-Baked Commands

Copy-paste ready commands for consistent screenshots:

### Hero Shot

```bash
clear
echo "$ ./reach doctor"
./reach doctor 2>&1 | head -20
```

### Decision Output

```bash
clear
echo "$ ./reach run fixtures/bundles/minimal-valid.json \\"
echo ">   --input fixtures/events/simple-decision.json"
./reach run fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json 2>&1
```

### Verification

```bash
clear
echo "$ ./reach verify-determinism --n 5 \\"
echo ">   --pack fixtures/bundles/minimal-valid.json \\"
echo ">   --input fixtures/events/simple-decision.json"
./reach verify-determinism --n 5 \
  --pack fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json 2>&1
```

---

## Storage and Naming

### Directory Structure

```
assets/screenshots/
├── hero/
│   ├── doctor-passing.png
│   ├── decision-output.png
│   └── verification-matching.png
├── docs/
│   ├── installation/
│   ├── configuration/
│   └── troubleshooting/
├── social/
│   ├── twitter-
│   ├── linkedin-
│   └── github-
└── press/
    ├── feature-A.png
    ├── feature-B.png
    └── team.png
```

### Naming Convention

```
{category}-{description}-{size}.{ext}

Examples:
hero-doctor-passing-1920x1080.png
docs-install-npm-output-1200x800.png
social-fingerprint-highlight-1200x675.png
```

---

## Automation

### Scripted Capture (macOS)

```bash
#!/bin/bash
# capture.sh - Automate screenshot capture

SCENE=$1
OUTPUT="assets/screenshots/${SCENE}-$(date +%Y%m%d).png"

# Prepare terminal
osascript -e 'tell application "Terminal" to activate'
osascript -e 'tell application "Terminal" to set bounds of front window to {100, 100, 1100, 700}'

# Run command based on scene
case $SCENE in
  "hero")
    ./reach doctor
    ;;
  "decision")
    ./reach run fixtures/bundles/minimal-valid.json --input fixtures/events/simple-decision.json
    ;;
esac

# Capture
screencapture -i "$OUTPUT"
echo "Saved: $OUTPUT"
```

---

## Accessibility

Ensure screenshots are accessible:

- [ ] High contrast for readability
- [ ] Text is 16px minimum
- [ ] Include alt text when using in docs
- [ ] Provide text equivalent for terminal output

Example alt text:
```markdown
![Terminal showing Reach doctor output with all checks passing:
 git installed, go installed, node version >= 18, configuration check]
```

---

## Version Tracking

Update screenshots when:
- [ ] New version released (update version strings)
- [ ] UI output format changes
- [ ] New features added
- [ ] Brand colors updated

Include screenshot version in filename:
```
hero-doctor-v031-1920x1080.png
```
