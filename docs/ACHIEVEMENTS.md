# Achievements

Reach includes a safe, cosmetic-only achievement system to recognize milestones and encourage best practices.

## Principles

**Achievements NEVER unlock capabilities.** They are purely cosmetic and for status recognition. This ensures:

- No pay-to-win or grind-to-unlock mechanics
- Security boundaries remain unchanged
- Determinism guarantees unaffected
- Policy enforcement unchanged

## Achievement List

### Beginner

| Icon | Name | Description | Rarity |
|------|------|-------------|--------|
| 🚀 | First Run | Execute your first Reach pack | Common |
| ✓ | Replay Verified | Successfully verify a deterministic replay | Common |

### Creation

| Icon | Name | Description | Rarity |
|------|------|-------------|--------|
| 💊 | Capsule Created | Create your first execution capsule | Common |
| 📦 | Pack Published | Publish a pack to the registry | Uncommon |

### Trust & Determinism

| Icon | Name | Description | Rarity |
|------|------|-------------|--------|
| 🎯 | 100% Determinism | 10 consecutive verified runs | Rare |
| 🔮 | Determinism Sage | 100 consecutive verified runs | Legendary |

### Federation

| Icon | Name | Description | Rarity |
|------|------|-------------|--------|
| 🤝 | Federation Node Trusted | Establish trust with a federation node | Uncommon |

### Edge Mode

| Icon | Name | Description | Rarity |
|------|------|-------------|--------|
| 📱 | Edge Mode Master | Complete 25 runs in Edge Mode | Uncommon |
| 🏕️ | Offline Warrior | Complete 10 runs offline | Rare |

### Milestones

| Icon | Name | Description | Rarity |
|------|------|-------------|--------|
| 🏆 | Veteran Runner | Execute 100 total runs | Epic |

## Storage

Achievements are stored locally in:

```
~/.reach/profile/achievements.json
```

Example:
```json
{
  "unlocked": {
    "first_run": "2025-01-15T10:30:00Z",
    "replay_verified": "2025-01-15T10:35:00Z"
  },
  "progress": {},
  "stats": {
    "totalRuns": 5,
    "verifiedRuns": 3,
    "capsulesCreated": 1,
    "packsPublished": 0,
    "trustedNodes": 0,
    "consecutiveMatches": 3,
    "edgeModeRuns": 2,
    "offlineRuns": 0,
    "firstRunAt": "2025-01-15T10:30:00Z",
    "lastRunAt": "2025-01-15T11:00:00Z"
  },
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

## CLI Commands

### View Profile

```bash
reach profile
```

Output:
```
=== Reach Profile ===

Achievements: 3/10 (30%)

Unlocked:
  🚀 First Run - Execute your first Reach pack [common]
  ✓ Replay Verified - Successfully verify a deterministic replay [common]
  💊 Capsule Created - Create your first execution capsule [common]

Stats:
  Total Runs: 5
  Verified Runs: 3
  Consecutive Matches: 3

Recent: 1 new achievement today
```

### List All Achievements

```bash
reach achievements
```

Output shows locked and unlocked achievements with progress.

### Achievement Details

```bash
reach achievements show determinism_sage
```

## Programmatic Access

### Go API

```go
import "reach/services/runner/internal/arcade/gamification"

// Create engine
engine := gamification.NewAchievementEngine("~/.reach/profile/achievements.json")
engine.Load()

// Record events
unlocked := engine.RecordEvent("run.completed", map[string]any{
    "verified": true,
})

// Check progress
progress := engine.GetProgress()
fmt.Printf("Runs: %d\n", progress.Stats.TotalRuns)
```

### JavaScript SDK

```typescript
import { Achievements } from '@reach/sdk';

const achievements = new Achievements();
await achievements.load();

// Get profile
const profile = await achievements.getProfile();
console.log(`Unlocked: ${profile.unlockedCount}/${profile.totalAchievements}`);
```

## Web Surface

If running a web UI, achievements can be displayed:

```html
<div id="achievements">
  <h2>Achievements (3/10)</h2>
  <div class="achievement unlocked">
    <span class="icon">🚀</span>
    <span class="name">First Run</span>
    <span class="rarity common">Common</span>
  </div>
  <!-- ... -->
</div>
```

## Privacy

- Achievements are stored **locally only**
- No cloud sync or telemetry
- No personally identifiable information
- Safe to backup or delete

## Reset

To reset achievements:

```bash
rm ~/.reach/profile/achievements.json
```

Or programmatically:

```go
engine.Reset()
engine.Save()
```

## Implementation Notes

### Event Recording

The engine listens to execution events:

| Event | Achievement Progress |
|-------|---------------------|
| `run.completed` | totalRuns++ |
| `run.verified` | verifiedRuns++, consecutiveMatches++ |
| `run.mismatch` | consecutiveMatches = 0 |
| `capsule.created` | capsulesCreated++ |
| `pack.published` | packsPublished++ |
| `node.trusted` | trustedNodes++ |
| `run.edge_mode` | edgeModeRuns++ |
| `run.offline` | offlineRuns++ |

### Thread Safety

The achievement engine is thread-safe. Events can be recorded from multiple goroutines safely.

### Performance

- Minimal overhead: events are counted, not stored
- Lazy loading: achievements loaded on first access
- Efficient storage: JSON file only written on save
