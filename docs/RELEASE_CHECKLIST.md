# Release Checklist Use this checklist before creating a release tag.

- [ ] `VERSION` updated
- [ ] `CHANGELOG.md` updated
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] `./reach release-check` passes
- [ ] Security-impact changes reviewed
- [ ] Release artifacts and checksums validated
- [ ] Tag created: `v$(cat VERSION)`
