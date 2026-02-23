# Plugin Cookbook

Step-by-step recipes for common plugin patterns.

## Recipes

### a) Add a Deterministic Check
Learn to implement custom validation logic that maintains determinism guarantees.

**File:** [recipe-a-deterministic-check.md](recipe-a-deterministic-check.md)  
**Time:** 15 minutes  
**Difficulty:** Beginner

---

### b) Add a New Junction Template
Create reusable decision templates that can be instantiated multiple times.

**File:** [recipe-b-junction-template.md](recipe-b-junction-template.md)  
**Time:** 20 minutes  
**Difficulty:** Intermediate

---

### c) Add an Evidence Metadata Enricher
Augment evidence with computed metadata like source credibility or confidence scores.

**File:** [recipe-c-evidence-enricher.md](recipe-c-evidence-enricher.md)  
**Time:** 15 minutes  
**Difficulty:** Beginner

---

### d) Add an Export Bundle Augmentor
Extend export bundles with additional computed data or custom formats.

**File:** [recipe-d-export-augmentor.md](recipe-d-export-augmentor.md)  
**Time:** 25 minutes  
**Difficulty:** Intermediate

---

### e) Add a Policy Validator Hook
Implement custom policy enforcement that runs at decision checkpoints.

**File:** [recipe-e-policy-validator.md](recipe-e-policy-validator.md)  
**Time:** 30 minutes  
**Difficulty:** Advanced

---

### f) Add a Metrics Contributor
Add custom telemetry and metrics collection for observability.

**File:** [recipe-f-metrics-contributor.md](recipe-f-metrics-contributor.md)  
**Time:** 20 minutes  
**Difficulty:** Intermediate

---

### g) Add a Safe CLI Extension Command
Extend the Reach CLI with new subcommands that follow safety patterns.

**File:** [recipe-g-cli-extension.md](recipe-g-cli-extension.md)  
**Time:** 25 minutes  
**Difficulty:** Intermediate

---

### h) Add a Formatter/Serializer Extension
Create custom output formats for decisions and evidence.

**File:** [recipe-h-formatter-extension.md](recipe-h-formatter-extension.md)  
**Time:** 20 minutes  
**Difficulty:** Beginner

---

## Common Patterns

All recipes follow these principles:

1. **Determinism First** - Same input always produces same output
2. **No Secrets** - Plugins work without network or credentials
3. **Testable** - Each recipe includes a verification step
4. **Documented** - Clear comments and README

## Getting Help

- Run `./reach plugins validate <path>` to check your plugin
- See `../template/` for the base structure
- File issues at https://github.com/reach/reach/issues
