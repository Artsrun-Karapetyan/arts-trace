# ArtsTrace Developer Guide

## 1) What this repo is

ArtsTrace is a lightweight error monitoring and manual bug reporting platform:

1. Browser SDK captures frontend errors, breadcrumbs, network requests, replay, and manual reports.
2. API validates payloads, stores project data, issues, events, comments, replay, sourcemaps, and team access.
3. Dashboard shows projects, issues, events, source context, network details, replay, comments, team, invites, and settings.

Monorepo layout:

- `apps/api` - NestJS API
- `apps/dashboard` - React dashboard (Vite + TanStack Router)
- `apps/playground` - local test app for SDK testing
- `packages/browser` - browser SDK package (`arts-trace`)
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

Optional playground:

```bash
pnpm dev:playground
```

## 3) Environment

Root `.env` example:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/artstrace?schema=public
PORT=3100
VITE_API_BASE_URL=http://localhost:3100
```

Production env example:

```env
PORT=3100
DATABASE_URL=postgresql://...pooled...neon.tech/...?...sslmode=require
DIRECT_URL=postgresql://...direct...neon.tech/...?...sslmode=require
VITE_API_BASE_URL=https://your-render-api.onrender.com
VITE_ARTSTRACE_API_KEY=your_project_public_api_key
```

Notes:

- API reads `PORT` from `.env` and defaults to `3100`.
- Dashboard reads `VITE_API_BASE_URL`.
- External apps initialize SDK with project `apiKey` and `/events` endpoint.
- Render deploy should run `pnpm db:migrate:deploy && pnpm db:generate`.

## 4) Daily commands

```bash
pnpm i
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm dev:api
pnpm dev:dashboard
pnpm typecheck
```

Other DB commands:

```bash
pnpm db:migrate:deploy
pnpm db:migrate:new <name>
pnpm db:seed
pnpm db:down
```

## 5) Core flows

### 5.1 Error ingest

SDK sends error payload to `POST /events`.

API flow:

1. Validate payload with `packages/shared/src/events.ts`.
2. Resolve `Project` by public `apiKey`.
3. Compute issue fingerprint from message/stack.
4. Upsert `Issue`.
5. Create `Event`.
6. Persist breadcrumbs, network requests, source context, and replay chunks.
7. Return `{ success: true, eventId }`.

### 5.2 Replay ingest

Replay is uploaded separately:

1. SDK sends compact error request to `POST /events`.
2. API returns `eventId`.
3. SDK sends replay to `POST /events/:id/replay`.

This avoids browser `keepalive` body-size limits.

Default replay window:

- `15s` before error
- `2s` after error

SDK options:

```ts
init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3100/events",
  replayPreErrorMs: 15000,
  replayPostErrorMs: 2000
});
```

### 5.3 Sourcemaps and source context

External apps should build with sourcemaps and upload `.js.map` files to `POST /sourcemaps` using the same `release` passed to `init`.

When sourcemaps include source content, API resolves original file/line/column and stores `Event.sourceContext`, so dashboard can show nearby code lines.

See also:

- `docs/SOURCEMAP_RELEASE_CHECKLIST.md`

### 5.4 Manual bug reports

SDK supports manual bug reports from the external app:

- `mountReportBugButton()`
- `openReportDialog()`
- `captureScreenshot()`
- `reportBug()`

Current behavior:

1. User clicks `Report bug`.
2. A small right-side drawer opens.
3. User clicks `Take screenshot`.
4. SDK shows an in-tab crosshair overlay.
5. User drags to select only the needed page area.
6. Selected area appears in preview.
7. User can add `Highlight`, `Circle`, or `Note`.
8. SDK sends payload to `POST /manual-reports`.

Important:

- SDK does not use Chrome `getDisplayMedia` share picker for this flow.
- The screenshot selection happens inside the current tab.

Example:

```ts
import { init, mountReportBugButton } from "arts-trace";

init({
  apiKey: import.meta.env.VITE_ARTSTRACE_API_KEY,
  endpoint: import.meta.env.VITE_ARTSTRACE_ENDPOINT,
  release: import.meta.env.VITE_APP_RELEASE
});

mountReportBugButton({
  label: "Report bug"
});
```

With target:

```ts
mountReportBugButton({
  target: "#topbar-actions",
  label: "Report bug"
});
```

`target` is the DOM element/selector where the SDK should insert the button. If omitted, the SDK creates a floating bottom-right button.

## 6) Auth, team, and permissions

Dashboard auth endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/logout`

User profile:

- Register supports optional `name`.
- Profile page allows editing display name.
- Comments and team displays use user name first, then email fallback.

Project access:

- Project owner is shown separately in Team.
- Owner cannot be removed or have role changed.
- Members can be added through invite link or by existing user email.

Roles:

- `MAINTAINER` - full control: invites, roles, member removal, settings, delete project.
- `MEMBER` - project access without team/settings management.
- `VIEWER` - read-only project access.

Invite flow:

1. Maintainer creates invite with email and role.
2. UI shows copyable invite link.
3. Invite page pre-fills/locks expected email.
4. After login/register, invite accept adds user to project team.

## 7) Issue workflow

Issues support:

- status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `IGNORED`
- priority: `LOW`, `MEDIUM`, `HIGH`, `HIGHEST`
- assignee from project team members
- comments, newest first, with `See more` / `See less`
- delete one issue, delete shown issues, delete all issues

Workflow fields are editable inline in issue detail and issue table.

## 8) API endpoints

Public ingest:

- `POST /events`
- `POST /events/:id/replay`
- `POST /sourcemaps`
- `POST /manual-reports`

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/logout`

Projects:

- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `POST /projects/:id/rotate-key`
- `DELETE /projects/:id`

Team and invites:

- `GET /projects/:id/members`
- `POST /projects/:id/members`
- `POST /projects/:id/members/existing`
- `PATCH /projects/:projectId/members/:memberId`
- `DELETE /projects/:projectId/members/:memberId`
- `GET /projects/:id/invites`
- `POST /projects/:id/invites`
- `GET /invites/:token`
- `POST /invites/:token/accept`

Issues/events:

- `GET /projects/:id/issues`
- `GET /issues/:id`
- `PATCH /issues/:id`
- `DELETE /issues/:id`
- `DELETE /projects/:id/issues`
- `GET /issues/:id/events`
- `GET /projects/:id/events`
- `GET /events/:id`
- `GET /issues/:id/comments`
- `POST /issues/:id/comments`

## 9) Database models

Main models:

- `User`
- `Session`
- `Project`
- `ProjectMember`
- `ProjectInvite`
- `Issue`
- `IssueComment`
- `ManualReport`
- `Event`
- `Breadcrumb`
- `NetworkRequest`
- `ReplayChunk`
- `SourceMap`

Source of truth:

- `packages/database/prisma/schema.prisma`

Important notes:

- `ManualReport` stores title, description, screenshot data, annotations, URL, user agent, and optional reporter id.
- `Issue` currently does not require a `type` column.
- Manual reports are associated to issues through `ManualReport.issueId`.

## 10) SDK usage

Basic external app setup:

```ts
import { init } from "arts-trace";

init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3100/events",
  release: "local-dev",
  replayPreErrorMs: 15000,
  replayPostErrorMs: 2000
});
```

User context:

```ts
import { setUser, clearUser } from "arts-trace";

setUser({
  id: "user-id",
  name: "User Name",
  role: "QA"
});

clearUser();
```

Manual reports:

```ts
import { mountReportBugButton, openReportDialog, reportBug } from "arts-trace";

mountReportBugButton();

openReportDialog();

await reportBug({
  title: "Button is misplaced",
  description: "The submit button appears outside the form",
  url: window.location.href,
  userAgent: navigator.userAgent
});
```

Current local package version in this repo:

- `packages/browser/package.json` -> `0.1.25`

## 11) Releasing SDK

From `packages/browser`:

```bash
pnpm pack
```

Install tarball in another project:

```bash
yarn add /absolute/path/to/arts-trace/packages/browser/arts-trace-<version>.tgz --force
```

For npm publish:

```bash
npm publish --access public
```

Package files are controlled by `files` in `packages/browser/package.json`.

## 12) Common troubleshooting

### 12.1 Dashboard gets HTML instead of JSON

Check:

1. `VITE_API_BASE_URL` points to ArtsTrace API.
2. API is running on expected port.
3. Another app is not using the API port.

### 12.2 Events request stays pending

Check:

1. `POST /events` returns quickly with `eventId`.
2. Replay upload appears as separate `POST /events/:id/replay`.
3. API is running and CORS allows the external app origin.

### 12.3 CORS credentials error

If request uses credentials, API cannot return `Access-Control-Allow-Origin: *`.

Fix API CORS to return the exact allowed origin, for example:

- `http://localhost:3000`
- `https://bnk-dev.asd.am`

### 12.4 Sourcemap line is wrong

Check:

1. External app uses same `release` in `init` and sourcemap upload.
2. Build has `sourcemap: true`.
3. Uploaded `.map` file matches deployed JS filename.
4. The error was created after the sourcemap upload.

### 12.5 Manual report returns 404

Check:

1. SDK endpoint is `/events`, for example `https://api.example.com/events`.
2. API exposes `POST /manual-reports`.
3. SDK version includes `getApiRoot(endpoint)` behavior.

### 12.6 Manual report returns DB error

Check:

1. Run `pnpm db:migrate:deploy`.
2. Run `pnpm db:generate`.
3. Confirm `ManualReport` table exists.
4. Do not rely on `Issue.type`; current schema does not require it.

### 12.7 Prisma client missing

Symptom:

- `Cannot find module '.prisma/client/default'`

Fix:

```bash
pnpm db:generate
```

If `npx` tries to hit the network, run the local Prisma binary or restore dependencies first.

### 12.8 Replay shows blank / 0:00

Check:

1. Reproduce with real interactions before triggering error.
2. Verify replay payload has `replayEvents.length > 0`.
3. Open a newly created event.

### 12.9 Network request details missing

Check:

1. Apply DB migrations.
2. Generate new events after migration.
3. Old events may only have legacy network fields.

## 13) Where to edit what

- API routes: `apps/api/src/app.controller.ts`
- API business logic: `apps/api/src/app.service.ts`
- Auth: `apps/api/src/auth.service.ts`, `apps/api/src/auth.controller.ts`
- Dashboard API client/types: `apps/dashboard/src/lib.ts`
- Dashboard routes: `apps/dashboard/src/routes`
- Browser SDK init/error capture/manual report UI: `packages/browser/src/index.ts`
- Browser SDK report button: `packages/browser/src/report-bug.ts`
- Browser SDK transport/replay/network/breadcrumbs: `packages/browser/src`
- Shared schemas: `packages/shared/src`
- Prisma schema/migrations: `packages/database/prisma`
