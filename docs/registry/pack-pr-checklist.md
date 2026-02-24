# Pack Submission Checklist (PR)

- [ ] `pack.json` includes `metadata.name`, `metadata.version`, and `specVersion`/`spec_version`.
- [ ] Compatibility contract is declared (`reach_version_range`, `schema_version_range`).
- [ ] Pack validation passes: `reach pack validate <path>`.
- [ ] Pack lint passes: `reach pack lint <path>`.
- [ ] Pack tests pass: `reach pack test <path>`.
- [ ] Pack execution avoids nondeterministic APIs (`time.Now`, `Date.now`, `Math.random`, UUID/random sources).
- [ ] README includes usage, inputs, and deterministic behavior notes.
- [ ] Sample transcript is included or rationale provided.
