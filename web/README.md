# Reach Web Visualizations

Interactive HTML visualizations for Reach execution data.

## Available Visualizations

### 1. Event Timeline (`event-timeline.html`)

Visualizes execution events with timing and metadata.

**Features:**
- Chronological event display
- Event type color coding
- Timing information
- Filter by event type
- Stats summary

**Usage:**
```bash
# Generate timeline from run
cat run.json | reach viz timeline > timeline.html

# Or open directly
open web/visualizations/event-timeline.html
```

### 2. Decision Ranking (`decision-ranking.html`)

Multi-criteria decision analysis visualization.

**Features:**
- Ranked decision cards
- Score visualization
- Criteria breakdown
- Side-by-side comparison
- Interactive selection

**Usage:**
```bash
reach viz ranking --input decisions.json > ranking.html
```

### 3. Replay Diff (`replay-diff.html`)

Compare original execution with replay.

**Features:**
- Side-by-side comparison
- Fingerprint verification
- Drift detection
- Section-by-section diff
- Match/error/drift indicators

**Usage:**
```bash
reach replay run.reach --export-diff diff.html
```

## Embedding in Applications

These visualizations are standalone HTML files that can be:
- Opened directly in browsers
- Embedded in iframes
- Served from static file servers
- Integrated into dashboards

## Customization

All visualizations use CSS custom properties for theming:

```css
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #e2e8f0;
  --accent: #60a5fa;
}
```

## Data Format

Each visualization expects data in a specific format. See the `<script>` section of each HTML file for the expected schema.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

All visualizations use vanilla JavaScript with no external dependencies.
