# ArtsTrace Developer Guide

## 1) What this repo is

ArtsTrace is a lightweight error monitoring platform:

1. Browser SDK captures frontend errors.
2. API ingests and stores them.
3. Dashboard shows projects, issues, events, breadcrumbs, network, replay.

Monorepo layout:

- `apps/api` - NestJS API
- `apps/dashboard` - React dashboard (Vite + TanStack Router)
- `apps/playground` - local test app for SDK testing
- `packages/browser` - SDK package (`@artstrace/browser`)
- `packages/shared` - shared Zod schemas/types
- `packages/database` - Prisma schema/client/migrations

## 2) Quick start

From repo root:

```bash
pnpm i
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm dev:api
pnpm dev:dashboard
```

If needed, run playground too:

```bash
pnpm dev:playground
```

## 3) Environment

Root `.env` (example):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/artstrace?schema=public
PORT=3100
VITE_API_BASE_URL=http://localhost:3100
```

Notes:

- API reads `PORT` from `.env` (default `3100`).
- Dashboard reads `VITE_API_BASE_URL` for API requests.

## 4) Core flows

### 4.1 Error ingest

SDK (`packages/browser`) sends error payload to `POST /events`.

API (`apps/api`) flow:

1. Validate payload with shared schema.
2. Resolve `Project` by `apiKey`.
3. Compute issue fingerprint.
4. Upsert `Issue`.
5. Create `Event`.
6. Persist `Breadcrumb` and `NetworkRequest`.
7. Return `{ success: true, eventId }`.

### 4.2 Replay ingest

Replay is uploaded separately to avoid `pending` with large request bodies:

1. SDK sends small error request to `POST /events`.
2. API returns `eventId`.
3. SDK sends replay to `POST /events/:id/replay`.

This split is critical for browser reliability with `keepalive` limits.

## 5) API endpoints

Projects:

- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `POST /projects/:id/rotate-key`
- `DELETE /projects/:id`

Issues/events:

- `POST /events`
- `POST /events/:id/replay`
- `GET /projects/:id/issues`
- `GET /issues/:id`
- `GET /issues/:id/events`
- `GET /projects/:id/events`
- `GET /events/:id`

## 6) Database models (current)

Main models:

- `Project`
- `Issue`
- `Event`
- `Breadcrumb`
- `NetworkRequest`
- `ReplayChunk`

Source of truth:

- `packages/database/prisma/schema.prisma`

## 7) SDK usage in external app

Example:

```ts
import { init } from "@artstrace/browser";

init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3100/events"
});
```

## 8) Releasing SDK for local install

From `packages/browser`:

```bash
pnpm pack
```

Then in another project (example with yarn):

```bash
yarn add /absolute/path/to/arts-trace/packages/browser/artstrace-browser-<version>.tgz --force
```

Current package file list is restricted via `files` in `packages/browser/package.json`, so tarball does not include old tarballs.

## 9) Common troubleshooting

### 9.1 Dashboard gets HTML instead of JSON

Symptom:

- `Expected JSON ... got text/html`

Check:

1. Dashboard API base points to ArtsTrace API (`VITE_API_BASE_URL`).
2. API is running on the same port.
3. Port is not used by another app.

### 9.2 Events request stays pending

Check:

1. `POST /events` returns quickly with `eventId`.
2. Replay upload appears as separate `POST /events/:id/replay`.
3. API is up and CORS enabled.

### 9.3 Replay shows blank / 0:00

Check:

1. Reproduce with real interactions before triggering error.
2. Verify `POST /events/:id/replay` payload has `replayEvents.length > 0`.
3. Open a newly created event (old records may not have replay).

## 10) Daily dev commands

From root:

```bash
pnpm i
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm dev:api
pnpm dev:dashboard
pnpm typecheck
```

DB control:

```bash
pnpm db:down
```

## 11) Where to edit what

- API business logic:
  - `apps/api/src/app.service.ts`
- API routes:
  - `apps/api/src/app.controller.ts`
- SDK transport/capture:
  - `packages/browser/src/index.ts`
- Shared payload schemas:
  - `packages/shared/src/events.ts`
- DB schema/migrations:
  - `packages/database/prisma/schema.prisma`
- Dashboard pages:
  - `apps/dashboard/src/routes/*`
- Dashboard API client:
  - `apps/dashboard/src/lib.ts`
