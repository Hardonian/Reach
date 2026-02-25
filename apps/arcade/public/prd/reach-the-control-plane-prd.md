# Reach: The Control Plane

## Product Overview

**The Pitch:** Reach is the immutable source of truth for deterministic infrastructure states. It eliminates configuration drift by providing a cryptographic, replayable history of every deployment decision, turning chaotic cloud environments into auditable, predictable systems.

**For:** DevOps Engineers, SREs, and Compliance Officers who demand mathematical certainty in their infrastructure, not "eventual consistency."

**Device:** Mobile

**Design Direction:** **Surgical Precision.** A "Refined Enterprise" aesthetic characterized by layered monochromatic surfaces, razor-sharp borders, and high-contrast data visualization. It avoids startup whimsy in favor of dense, actionable information density.

**Inspired by:** Linear Mobile (layout mechanics), Stripe Dashboard (typographic hierarchy), Vercel (monochromatic precision).

---

## Screens

- **Ops Center (Home):** Real-time pulse of system health and active deployment replays.
- **Replay Timeline:** Deep-dive forensic view of a specific deployment hash with drift analysis.
- **Governance Gate:** Control interface for policy enforcement and severity thresholds.
- **Integrity Monitor:** Data-dense dashboard for evaluation confidence and grounding metrics.
- **Lineage Inspector:** Visual artifact chain mapping source code to deployed infrastructure.
- **Extension Hub:** Marketplace and manager for verified plugins and RLS isolation.

---

## Key Flows

**Flow: Investigating Drift**

1. User is on **Ops Center** -> sees "Drift Detected" alert on `prod-us-east-1`.
2. User taps alert card -> navigates to **Replay Timeline**.
3. User scrubs timeline -> identifies exact hash where drift occurred.
4. User taps "View Diff" -> Overlay compares Expected vs. Actual state.
5. User taps "Revert to Hash" -> System initiates rollback.

---

<details>
<summary>Design System</summary>

## Color Palette

- **Primary:** `#111827` (Dark Gray) - Main navigational elements, primary text.
- **Background:** `#F9FAFB` (Off-white) - Page background, creates "paper" feel.
- **Surface:** `#FFFFFF` (White) - Cards, elevated sections.
- **Surface Highlight:** `#F3F4F6` (Cool Gray) - Hover states, secondary backgrounds.
- **Accent:** `#4F46E5` (Electric Indigo) - Key actions, active states, focus rings.
- **Critical:** `#DC2626` (Red) - Drift alerts, failure traces.
- **Success:** `#059669` (Emerald) - Passing checks, verified hashes.
- **Border:** `#E5E7EB` (Gray 200) - Hairline dividers.

**Dark Mode Mapping:**

- Background: `#0B0C10`
- Surface: `#16181D`
- Primary Text: `#F3F4F6`
- Border: `#27272A`

## Typography

**Font:** `Geist Sans` (primary), `JetBrains Mono` (code/hashes).

- **Display:** Geist Sans, 600, 24px, -0.02em tracking.
- **Heading:** Geist Sans, 500, 18px, -0.01em tracking.
- **Body:** Geist Sans, 400, 15px, 150% line height.
- **Mono (Hash):** JetBrains Mono, 400, 12px, tabular nums.
- **Label:** Geist Sans, 500, 11px, Uppercase, 1px letter spacing.

**Style notes:**

- **Layering:** Depth is achieved through borders (`1px solid var(--border)`) and extremely subtle shadows (`0 1px 2px 0 rgb(0 0 0 / 0.05)`).
- **Corner Radius:** `6px` for inner elements, `12px` for cards. Tight and engineered.
- **Negative Space:** Dense data requires breathing room. 16px padding minimum on containers.

## Design Tokens

```css
:root {
  --color-primary: #111827;
  --color-bg: #f9fafb;
  --color-surface: #ffffff;
  --color-accent: #4f46e5;
  --color-border: #e5e7eb;
  --font-sans: "Geist Sans", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius-sm: 6px;
  --radius-md: 12px;
  --spacing-unit: 4px;
}
```

</details>

---

<details>
<summary>Screen Specifications</summary>

### 1. Ops Center (Home)

**Purpose:** The "Pilot's View." High-level status of all governed environments.

**Layout:** Single column vertical stack. Sticky header with search/context switch.

**Key Elements:**

- **System Pulse Header:** Large status indicator (Green/Yellow/Red). Text: "All Systems Deterministic" or "3 Drifts Detected".
- **Environment Cards:** List of monitored environments (e.g., `prod`, `staging`).
  - **Left:** Status dot + Environment Name.
  - **Right:** Last Sync Time (e.g., "2m ago").
  - **Bottom:** Mini sparkline graph showing drift percentage over 24h.
- **Active Replays:** "Live" section showing currently executing deployment hashes. Animated progress bar.

**States:**

- **Empty:** "No Environments Linked. Initialize via CLI." with code snippet box.
- **Loading:** Skeleton pulses on cards.
- **Error:** "Connection Lost" banner, sticky top.

**Components:**

- **EnvCard:** Full width, white bg, 1px border.
- **Sparkline:** 24px height, stroke 1.5px, accent color.

**Interactions:**

- **Tap Card:** Slide transition to **Replay Timeline** for that environment.

---

### 2. Replay Timeline

**Purpose:** Forensic analysis of state changes over time.

**Layout:** Vertical timeline with sticky date headers.

**Key Elements:**

- **Hash Scrubber:** Top section. Horizontal scrollable bar of commit hashes (`8f3a2...`).
- **State Snapshot:** Central card showing the "World View" at that specific hash.
- **Diff View:**
  - **Additions:** Green background lines.
  - **Removals:** Red strikethrough lines.
- **Drift Indicator:** Pill badge `Drift: 0.0%` (Green) or `Drift: 12.4%` (Red).

**Components:**

- **TimelineNode:** Circle on left vertical line. Filled = Deployment, Hollow = Drift Check.
- **CodeBlock:** JetBrains Mono, dark bg (even in light mode), syntax highlighting.

**Interactions:**

- **Tap Hash:** Updates the State Snapshot below instantly.
- **Long Press Hash:** Copies full SHA-256 to clipboard.

---

### 3. Governance Gate Control

**Purpose:** Configuration of the "rules of the road" for deployments.

**Layout:** Settings-style list with toggle controls and deep-dive drawers.

**Key Elements:**

- **Gate Preset Selector:** Horizontal scroll pills: `Strict`, `Permissive`, `Audit-Only`.
- **Policy List:**
  - **Item:** "No Public S3 Buckets".
  - **Control:** iOS-style toggle switch (Accent color).
  - **Severity:** Gradient bar (Low -> Critical).
- **Failure Traces:** Collapsible section showing last 5 failures blocked by these gates.

**States:**

- **Saving:** Toggle spins, briefly disables interaction.

**Interactions:**

- **Slide Severity:** Finger drag on gradient bar adjusts weight of the rule.

---

### 4. Integrity Monitor

**Purpose:** Visualization of the mathematical confidence in the current state.

**Layout:** Grid of data widgets (2x2) followed by a list.

**Key Elements:**

- **Confidence Score:** Large donut chart. Center text: "99.9%".
- **Grounding Indicator:** Status row. "Anchored to: GitHub/main". Icon: Anchor.
- **Weighted Metrics:** List of factors contributing to score (e.g., "Tests Passed", "Manual Approval").
  - **Visual:** Progress bar for each metric relative to total weight.

**Components:**

- **DataWidget:** Square card, strong border, label top-left, big data center.

---

### 5. Lineage Inspector

**Purpose:** Prove the provenance of a deployment artifact.

**Layout:** Tree-structure visualization (vertical flow).

**Key Elements:**

- **Artifact Node:** The deployed binary/container.
- **Connection Lines:** SVG paths tracing back up.
- **Source Node:** The Git commit.
- **Build Node:** The CI job (Github Actions/Jenkins).
- **Fingerprint Match:** Floating bottom bar: "SHA-256 Match Verified". Green check.

**Interactions:**

- **Tap Node:** Expands metadata sheet (Author, Time, Signature).

---

### 6. Extension Hub

**Purpose:** Manage plugins and ensure tenant isolation.

**Layout:** App-store style list.

**Key Elements:**

- **Registry List:**
  - **Icon:** Plugin logo.
  - **Meta:** Name + Version.
  - **Badges:** `OSS` (Gray badge) or `Enterprise` (Indigo badge).
  - **Status:** `Active` / `Install`.
- **Isolation Inspector:** Tab at top.
- **RLS Viewer:** Shows Row Level Security policies applied by extensions.
  - **Visual:** "Lock" icon next to protected data models.

**Components:**

- **PluginRow:** 64px height, icon left, action button right.

</details>

---

<details>
<summary>Build Guide</summary>

**Stack:** HTML + Tailwind CSS v3

**Build Order:**

1. **Ops Center:** Defines the core navigation shell, typography stack, and card components.
2. **Replay Timeline:** Establishes the complex data visualization and interaction patterns (scrubbing/diffing).
3. **Governance Gate:** Implements form controls and state management.
4. **Integrity Monitor:** Focuses on charting and dense data display.
5. **Lineage Inspector:** Custom SVG drawing and recursive layout logic.
6. **Extension Hub:** List views and modal interactions.

</details>
