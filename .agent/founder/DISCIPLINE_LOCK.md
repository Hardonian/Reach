# ReadyLayer Permanent Discipline Lock

This document is the "Constitution" of the ReadyLayer repository. Violating these rules is treated as a critical system failure.

## 1. THE RULE OF 6

Global navigation cannot exceed 6 primary items. To add 1, you must kill 1.

## 2. NO UI PLACEHOLDERS

No "Coming Soon" text. No empty state placeholders. Every pixel must be backed by real deterministic data or a specific `HeroMedia` asset.

## 3. ABSOLUTE DETERMINISM

If a feature cannot produce a deterministic, verifiable audit trail (e.g. Merkle root), it cannot be part of the Core Suite. It belongs in the "Experimental Lab" (outside the primary app).

## 4. DESIGN TOKEN SOVEREIGNTY

Ad-hoc CSS, hardcoded Tailwind colors, or inline styles are prohibited. All UI must derive from `arcade-tokens.css`.

## 5. RECOVERY PROTOCOLS

When technical debt exceeds 15% of the sprint velocity:

- All feature work stops.
- 100% of bandwidth moves to **Refactoring & De-Entropy**.
- "Zombie Code" (code with zero execution paths) is purged immediately.

## 6. 12-MONTH NORTH STAR

ReadyLayer is a **Reliability Engine**, not a productivity suite. If a feature makes users "work" instead of "verifying," it is a breach of strategic alignment.
