# Browser SDK Refactor Plan

Goal: split `packages/browser/src/index.ts` into readable modules without changing SDK behavior.

## Rules

- Move in small steps.
- Keep public API unchanged: `init`, `setUser`, `clearUser`.
- Run browser package typecheck after every step.
- Do not combine refactor with behavior changes.

## Steps

1. Baseline
   - Run typecheck.
   - Confirm current exported API.

2. Types
   - Add `packages/browser/src/types.ts`.
   - Move `IngestEventInput`, `InitOptions`, `UserContext`, `Breadcrumb`, `NetworkRequest`.

3. Constants
   - Add `packages/browser/src/constants.ts`.
   - Move endpoint, limits, and replay defaults.

4. User/session state
   - Add `packages/browser/src/user.ts`.
   - Move `setUser`, `clearUser`, `getUserContext`, `getOrCreateSessionId`.

5. Breadcrumb and network buffers
   - Add `packages/browser/src/breadcrumbs.ts`.
   - Add `packages/browser/src/network.ts`.
   - Preserve buffer sizes and snapshot behavior.

6. Source parsing
   - Add `packages/browser/src/source.ts`.
   - Move stack parsing and source selection helpers.

7. Transport
   - Add `packages/browser/src/transport.ts`.
   - Move event upload, replay upload, and payload trimming.

8. Replay
   - Add `packages/browser/src/replay.ts`.
   - Move replay capture, trimming, and replay window logic.

## Verification

- `pnpm --filter arts-trace typecheck`
- Pack locally from `packages/browser`.
- Install packed tarball into a real test app.
- Trigger an error and confirm:
  - event is created
  - source location is preserved
  - replay uploads
  - network requests are captured
