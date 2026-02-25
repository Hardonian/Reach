# Reach: The Absolute State

## Product Overview

**The Pitch:** Reach is a deterministic control plane that enforces absolute state parity across distributed systems. It transforms messy, probabilistic cloud environments into rigid, replayable timelines where every byte is accounted for.

**For:** Systems Architects, SREs, and DevOps Engineers who value precision over polish and need to prove system integrity down to the hash.

**Device:** Mobile

**Design Direction:** **Technical Brutalism.** A raw, high-contrast aesthetic emphasizing the deterministic nature of the platform. Features mono-spaced headers, 1px hard borders, zero blur/shadows, and a pure black/white palette with sharp CMYK status accents. It feels inevitable, precise, and engineered.

**Inspired by:** Linear's internal tools (if stripped of all gradients), Teenage Engineering's OP-1 field manual, raw raw SQL terminal outputs.

---

## Screens

- **[01] OSS Landing:** Minimalist CLI-style intro, "Determinism Engine" manifesto, fast copy-paste install.
- **[02] Replay Explorer:** Timeline scrubber for system states with drift calculation.
- **[03] Governance Gate:** Policy enforcement dashboard with immediate "Kill/Pass" switches.
- **[04] Integrity & Provenance:** Dense data view combining evaluation metrics and artifact lineage.
- **[05] Tenant Inspector:** Security-focused view of RLS states and role isolation.
- **[06] Extension Registry:** Modular plugin list with checksum verification badges.
- **[07] Enterprise Portal:** Compliance dashboard shifting context from "Hacker" to "Auditor."

---

## Key Flows

**Flow: Resolving State Drift**

1.  User is on **Replay Explorer** -> sees `DRIFT DETECTED` warning (Magenta).
2.  User taps **Drift Segment** -> expands hash comparison view showing byte difference.
3.  User taps **Revert to Checksum** -> System executes rollback.
4.  **Result:** State returns to `0x0` variance. UI flashes Cyan confirmation.

**Flow: Enterprise Audit**

1.  User is on **Tenant Inspector** -> sees `RLS: LEAKING` badge on a specific shard.
2.  User taps **Shard ID** -> drills down to **Provenance Lineage** view.
3.  User identifies rogue artifact -> taps **Lock Gate**.
4.  **Result:** Shard isolation restored. UI updates to `SECURE` state.

---

<details>
<summary>Design System</summary>

## Color Palette

- **Primary:** `#000000` (Light Mode) / `#FFFFFF` (Dark Mode) - Borders, Text
- **Background:** `#FFFFFF` (Light Mode) / `#000000` (Dark Mode) - Canvas
- **Surface:** `#F4F4F4` (Light Mode) / `#111111` (Dark Mode) - Striped rows, active states
- **Accent Cyan:** `#00FFFF` - Success, Verified, Safe, Pass
- **Accent Magenta:** `#FF00FF` - Error, Drift, Fail, Danger
- **Accent Yellow:** `#FFFF00` - Warning, Pending, Replaying

_Note: In Dark Mode, swap Primary/Background. Accents remain constant for maximum contrast._

## Typography

- **Headings:** `JetBrains Mono`, 700, Uppercase, 14px-18px (The "Header" looks like code comments)
- **Body:** `Space Mono`, 400, 13px (High legibility, tabular figures essential)
- **Data/Code:** `IBM Plex Mono`, 400, 11px (Dense data display)
- **Labels:** `Inter`, 600, 10px (UI controls only, tiny uppercase)

**Style notes:**

- **0px Border Radius** on everything. Sharp corners only.
- **1px Solid Borders** define all structure. No whitespace separation.
- **CSS Grid** visible via borders. The layout _is_ the aesthetic.
- **Inverted Selection:** Active states invert colors (Black text on White -> White text on Black block).

## Design Tokens

```css
:root {
  --color-ink: #000000;
  --color-paper: #ffffff;
  --color-cyan: #00ffff;
  --color-magenta: #ff00ff;
  --color-yellow: #ffff00;
  --font-mono: "JetBrains Mono", monospace;
  --font-body: "Space Mono", monospace;
  --border-width: 1px;
  --spacing-unit: 4px;
}
```

</details>

---

<details>
<summary>Screen Specifications</summary>

### [01] OSS Landing

**Purpose:** Developer acquisition. Pure function over form.

**Layout:** Single column. Top-heavy with large ASCII/SVG logo.

**Key Elements:**

- **Hero:** "REACH: DETERMINISTIC CONTROL." `JetBrains Mono`, 24px, borders top/bottom.
- **Manifesto:** 3 bullet points. "01. NO DRIFT. 02. NO SURPRISES. 03. ABSOLUTE STATE."
- **CLI Block:** Black box (`#000`), White text (`#FFF`).
  - Copy: `curl -sL reach.sh | bash`
  - Action: Tap copies to clipboard. Flash Cyan border on tap.

**States:**

- **Default:** Static, high contrast.
- **Copied:** CLI Block inverts colors briefly.

**Interactions:**

- **Scroll:** Sticky header with `[ENTERPRISE ->]` link.

---

### [02] Replay Explorer

**Purpose:** Debugging timelines. Finding where reality diverged from expectation.

**Layout:** Vertical stack of time-slices.

**Key Elements:**

- **Header:** `REPLAY :: SESSION_ID: 8X99`
- **Timeline Rail:** Left vertical border. Ticks every 20px.
- **Event Row:**
  - **Timestamp:** `14:02:01.002` (Left)
  - **Hash:** `0x8f...e2` (Right, truncated)
  - **Drift Indicator:** If hash matches expected, empty circle. If mismatch, solid Magenta square.
- **Scrubber:** Fixed bottom bar. Drag to scrub through history.

**States:**

- **Drift Detected:** Row background becomes striped Magenta pattern.
- **Replaying:** Overlay text `REPLAYING...` in Yellow blinking box.

**Components:**

- **HashPill:** `IBM Plex Mono`, 10px. 1px border.

---

### [03] Governance Gate

**Purpose:** Policy enforcement.

**Layout:** Dense list of rules with binary switches.

**Key Elements:**

- **Gate Card:** Boxed area.
  - **Title:** `ALLOW_OUTBOUND_TRAFFIC`
  - **Status:** `PASS` (Cyan text) or `FAIL` (Magenta text).
- **Severity Gradient:** Not a gradient, but a stepped bar chart. 1 block = low, 5 blocks = critical.
- **Toggle Switch:** Rectangular. "ON" = Black fill. "OFF" = White fill. 1px border. No animation, instant snap.

**States:**

- **Locked:** Toggle has diagonal line through it.
- **Violation:** Border turns Magenta.

---

### [04] Integrity & Provenance

**Purpose:** Verify the "truth" of the system.

**Layout:** 2x2 Grid of data metrics followed by a tree view.

**Key Elements:**

- **Confidence Metric:** Large number `99.9%`. Underline in Cyan.
- **Grounding Indicator:** "ANCHORED" badge (Cyan background, Black text).
- **Artifact Chain:** Vertical line connecting boxes.
  - **Root:** `BUILD_ID: A1`
  - **Connector:** 1px line.
  - **Leaf:** `DEPLOY_ID: B2`

**Interactions:**

- **Tap Metric:** Expands `Evaluation Calculation` modal (full screen overlay, mono text).

---

### [05] Tenant Inspector

**Purpose:** Visualizing isolation between multi-tenant data.

**Layout:** Tiled grid representing database shards.

**Key Elements:**

- **Isolation Badge:** Top right. `RLS: ACTIVE` (Cyan border).
- **Shard Grid:** 3 columns. Each cell is a tenant.
  - **Cell Content:** Tenant ID (`T-800`).
  - **Privilege Level:** `READ` (Hollow), `WRITE` (Solid Fill).
- **Leak Warning:** If a tenant accesses another's data, a Magenta line connects the two cells.

**States:**

- **Select Mode:** Tapping a cell dims all non-related cells.
- **Breach:** Flashing Magenta border on the breached cell.

---

### [06] Extension Registry

**Purpose:** Add functionality without breaking determinism.

**Layout:** List view with metadata columns.

**Key Elements:**

- **Search:** Input field, top. `TYPE TO FILTER...`. No icon, just text.
- **Plugin Row:**
  - **Name:** `reach-sql-adapter`
  - **Tag:** `OSS` (Hollow border) or `ENT` (Solid Black border).
  - **Checksum:** `✔` (Cyan) or `✖` (Magenta).
- **Install Button:** Square button `[+]`. Becomes `[INSTALLED]` on click.

**States:**

- **Unverified:** Checksum icon is a `?` in Yellow.
- **Loading:** Progress bar fills the bottom border of the row 0% -> 100%.

---

### [07] Enterprise Portal

**Purpose:** Compliance and "Big Picture" view.

**Layout:** Dashboard. Information density is higher here.

**Key Elements:**

- **Audit Log Ticker:** Marquee text scrolling left. `USER_A ACCESSED GATE_B`.
- **Compliance Matrix:** Table.
  - Rows: `SOC2`, `GDPR`, `HIPAA`.
  - Columns: `STATUS`, `EVIDENCE`.
  - Cells: `PASS` (Cyan Block), `FAIL` (Magenta Block).
- **Export Report:** Button at bottom. `GENERATE PDF`.

**Responsive:**

- **Mobile:** Single column stacked.
- **Tablet:** Two columns (Logs left, Matrix right).

</details>

---

<details>
<summary>Build Guide</summary>

**Stack:** HTML + Tailwind CSS v3

**Build Order:**

1.  **[02] Replay Explorer:** Establishing the timeline grid and hash visualization is the hardest UI challenge. This defines the "Technical" aspect.
2.  **[03] Governance Gate:** Defines the interaction model (switches, states, alerts).
3.  **[01] OSS Landing:** Easiest, uses components from above, sets the public face.
4.  **[05] Tenant Inspector:** Complex grid logic, relies on established borders/spacing from Explorer.
5.  **[04] Integrity & Provenance:** Data visualization heavy.
6.  **[06] Extension Registry:** List view variations.
7.  **[07] Enterprise Portal:** Aggregation of previous components.

**Tailwind Config Nuances:**

- Disable all `shadows`.
- Set `border-radius` to `0`.
- Extend colors with specific `cyan: '#00FFFF'`, `magenta: '#FF00FF'`.
- Define custom `font-mono` stack.

</details>
