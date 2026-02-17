# Arcade QA Checklist

## 1. Environment & Build

- [ ] `apps/arcade` builds successfully (`npm run build`).
- [ ] No lint errors in `apps/arcade`.
- [ ] No type errors in `apps/arcade` (`tsc`).

## 2. Mobile UX

- [ ] Open Arcade on mobile device or simulated viewport.
- [ ] Verify content fits within screen width (no horizontal scroll).
- [ ] Verify tap targets are at least 44x44px.
- [ ] Verify bottom navigation is reachable with one thumb.
- [ ] Verify "Run" button is prominent and accessible.

## 3. Execution (Simulated)

- [ ] Select "Hello Reach" pack.
- [ ] Click "Run Now".
- [ ] Verify timeline animation plays smoothly.
- [ ] Verify "Success" status appears at end.
- [ ] Try to run "System Access" (Unsafe pack).
- [ ] Verify it is blocked (button disabled or API rejects).

## 4. Sharing

- [ ] After a successful run, click "Share".
- [ ] Verify "Run Card Link Copied" alert.
- [ ] Paste link in a new incognito window.
- [ ] Verify the Shared Run Card loads correct pack info.
- [ ] Verify timeline events match the original run.
- [ ] Verify NO secret keys/tokens are visible in URL or UI.

## 5. Protocol Integrity

- [ ] Verify Arcade does not import `services/runner` directly.
- [ ] Verify `lib/packs.ts` explicitly marks `arcadeSafe` boolean.
- [ ] Verify API route checks `arcadeSafe` flag before execution.
