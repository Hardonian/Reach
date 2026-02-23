# ReadyLayer Founder Decision Framework (v1)

Every new feature or architectural change must be scored using this framework before implementation.

## 1. SCORING MATRIX (0-5 scale)

### Positive Leverage

- **Activation Acceleration**: Does this get a user to a "First Success" (Green Pass) in < 30 seconds?
- **Gate Leverage**: Does this deepen the defensibility of our Release Gates?
- **Monitoring Retention**: Does this provide a "Must-Check" reason for users to return daily?
- **Simulation Differentiation**: Does this make context-aware simulation easier than competitors?
- **Ecosystem Gravity**: Does this increase the value of existing Skills/Packs?
- **Monetization Leverage**: Is there a clear upgrade trigger linked to this feature?

### Negative Drag (Entropy)

- **Complexity Cost**: Points for new routes, new global state, or new external dependencies.
- **UI Surface Expansion**: Points for adding new buttons, menu items, or primary routes.
- **Engineering Load**: Relative difficulty of implementation vs available bandwidth.

## 2. THE FORMULA

**Net Score = (Positive Leverage Sum) - (Negative Drag Sum)**

| Net Score | Verdict                                              |
| :-------- | :--------------------------------------------------- |
| **> 25**  | **GO**: High-compounding priority.                   |
| **15–24** | **DEFER**: Re-evaluate if complexity can be reduced. |
| **< 15**  | **KILL**: Strategic drift detected.                  |

## 3. AUTO-KILL CONDITIONS (Non-Negotiable)

- Propose a new top-level navigation route (without killing one).
- Introduce a dependency that increases cold-start time by >100ms.
- Feature requires non-deterministic execution logic.
- UI violates paragraph length or action density rules.

## 4. EXAMPLE PROPOSAL

### Feature: "Auto-Fix Suggestion for Path Violations"

- Activation: 5 (Fast path to success)
- Gate Leverage: 4 (Makes gates more useful)
- Monitoring: 2
- Simulation: 1
- Ecosystem: 3
- Monetization: 2
- **Pos Subtotal: 17**
- Complexity: 1
- UI Expansion: 1
- Engineering: 2
- **Neg Subtotal: 4**
- **Net Score: 13** -> _Result: DEFER. Needs consolidation into existing Studio Shell._
