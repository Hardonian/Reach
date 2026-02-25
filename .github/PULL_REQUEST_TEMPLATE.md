## Description

<!-- Brief description of the changes -->

## Type of Change

<!-- Check relevant options -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring (no functional changes)
- [ ] CI/CD improvement
- [ ] Other (please describe):

## Verification

<!-- All PRs must pass these checks before merging -->

- [ ] `npm run typecheck` passes
- [ ] `npm run lint:structure` passes
- [ ] `npm run format:check` passes
- [ ] `npm test` passes
- [ ] `npm run verify:determinism` passes (if touching core engine)

## Determinism Check

<!-- If your changes touch the decision engine or hashing -->

- [ ] My changes do not introduce non-deterministic behavior
- [ ] I have not used `time.Now()`, `Math.random()`, or similar in deterministic paths
- [ ] I have not modified hashing algorithms or replay semantics

## Testing

<!-- Describe how you tested your changes -->

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed (describe below)

## Documentation

- [ ] README updated (if user-facing changes)
- [ ] CHANGELOG.md updated (for notable changes)
- [ ] Inline comments added for complex logic

## Related Issues

<!-- Link to related issues using "Fixes #123" or "Relates to #456" -->

Fixes #

## Screenshots / Output

<!-- If applicable, add screenshots or command output -->

## Additional Notes

<!-- Any additional context or notes for reviewers -->
