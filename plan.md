# ArtsTrace MVP Plan

## Goal

Capture a frontend JavaScript error and display it in the dashboard:

`throw new Error("ArtsTrace Test")` on a test site must appear in ArtsTrace UI.

## Scope (MVP)

- No auth
- No billing
- No session replay
- No AI features
- Seed one test project with public API key

## Monorepo Setup

- Package manager: `pnpm` workspace
- Language: TypeScript everywhere

Structure:

```txt
artstrace/
  apps/
    dashboard/
    api/
  packages/
    browser/
    shared/
    database/
  package.json
  pnpm-workspace.yaml
```

## Tech Stack

- `apps/dashboard`: Vite + React + TypeScript
- `apps/api`: NestJS + TypeScript
- `packages/browser`: browser SDK (`@artstrace/browser`)
- `packages/shared`: shared Zod schemas + shared types
- `packages/database`: Prisma schema + Prisma client
- DB: PostgreSQL (local Docker now, Neon/Supabase later)

## Phase 1 (MVP): Error Ingestion + Dashboard

### 1) Browser SDK (`packages/browser`)

Public API:

```ts
import { init } from "@artstrace/browser";

init({ apiKey: "project_public_api_key" });
```

Capture:

- `window.addEventListener("error", ...)`
- `window.addEventListener("unhandledrejection", ...)`

Send to API:

- `POST /events`

Payload:

```ts
{
  apiKey: string;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
}
```

### 2) API (`apps/api`)

Endpoints:

- `POST /events`
- `GET /projects`
- `GET /projects/:id/events`
- `GET /events/:id`

`POST /events` behavior:

- Validate request with shared Zod schema
- Find `Project` by `apiKey`
- Persist `Event` in PostgreSQL
- Return `{ success: true }`

### 3) Database (`packages/database`)

Initial Prisma models:

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  apiKey    String   @unique
  createdAt DateTime @default(now())

  events    Event[]
}

model Event {
  id        String   @id @default(cuid())

  projectId String
  project   Project @relation(fields: [projectId], references: [id])

  message   String
  stack     String?
  url       String
  userAgent String?

  createdAt DateTime @default(now())
}
```

Seed data:

- One `Project` row with known `apiKey` for local testing

### 4) Dashboard (`apps/dashboard`)

Routes:

- `/projects`
- `/projects/:id/events`
- `/events/:id`

Views:

- Projects list:
  - project name
  - total errors
  - errors today
- Events list:
  - message
  - url
  - createdAt
- Event detail:
  - message
  - stack
  - url
  - userAgent
  - createdAt

## Phase 1 Acceptance Criteria

- Browser SDK sends errors to `POST /events`
- API validates and stores events
- Seeded project API key works end-to-end
- Triggering `throw new Error("ArtsTrace Test")` shows up in dashboard

## Phase 2: Error Grouping

Add `Issue` model and link events to issue.

```prisma
model Issue {
  id          String   @id @default(cuid())

  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])

  fingerprint String
  message     String

  count       Int      @default(1)
  firstSeen   DateTime @default(now())
  lastSeen    DateTime @default(now())

  events      Event[]
}

model Event {
  id        String   @id @default(cuid())

  projectId String
  project   Project @relation(fields: [projectId], references: [id])

  issueId   String?
  issue     Issue?  @relation(fields: [issueId], references: [id])

  message   String
  stack     String?
  url       String
  userAgent String?

  createdAt DateTime @default(now())
}
```

Fingerprint (initial):

- `hash(message + firstStackLine)`

Dashboard change:

- Default list should show Issues first, not raw events

## Phase 3: Breadcrumbs

SDK captures pre-error actions:

- page navigation
- click events
- console errors
- manual breadcrumb API

Example:

```ts
ArtsTrace.addBreadcrumb({
  type: "click",
  message: "Clicked Add To Cart",
});
```

DB model:

```prisma
model Breadcrumb {
  id        String   @id @default(cuid())

  eventId   String
  event     Event    @relation(fields: [eventId], references: [id])

  type      String
  message   String
  data      Json?

  createdAt DateTime @default(now())
}
```

## Phase 4: Network Monitoring

Capture request metadata:

- `fetch` and `XMLHttpRequest`
- method
- url
- status
- duration

Default privacy rule:

- Do not capture sensitive request/response bodies

DB model:

```prisma
model NetworkRequest {
  id        String   @id @default(cuid())

  eventId   String
  event     Event    @relation(fields: [eventId], references: [id])

  method    String
  url       String
  status    Int?
  duration  Int?

  createdAt DateTime @default(now())
}
```

## Phase 5: Session Replay

Use `rrweb` with privacy-first defaults.

Mask by default:

- password fields
- input/textarea content
- emails
- phone numbers
- card-like numbers

## Build Order (Suggested)

1. Monorepo scaffold (`apps/*`, `packages/*`)
2. Shared schemas/types (`packages/shared`)
3. Prisma schema + migration + seed (`packages/database`)
4. API ingest + read endpoints (`apps/api`)
5. Browser SDK capture + transport (`packages/browser`)
6. Dashboard routes + pages (`apps/dashboard`)
7. End-to-end local test with one seeded project

## Фаза 6: Дорожная карта премиум-функций

### 1. 💻 Открытие в локальной IDE (Глубокие ссылки / Deep Links)
*   **Что**: Добавление небольших интерактивных кнопок IDE рядом с путями к файлам в интерфейсе дашборда.
*   **Почему**: Клик по кнопке в браузере мгновенно открывает соответствующий файл, строку и колонку в вашей локальной среде — **Cursor / VS Code** (`vscode://`) или **WebStorm** (`webstorm://`), так как разработчики исправляют ошибки именно локально, а не в вебе GitHub/GitLab.

### 2. 👥 Отслеживание влияния на пользователей (User Impact)
*   **Что**: Отслеживание и отображение количества уникальных пользователей, столкнувшихся с каждой ошибкой (через ID пользователя или хэш сессии).
*   **Почему**: Помогает приоритизировать баги на основе реального количества пострадавших людей, а не только общего числа событий.

### 3. 🗺 Поддержка Source Maps (Карты источников)
*   **Что**: Возможность загрузки продакшн-файлов `.map`.
*   **Почему**: Автоматически дешифрует минифицированные и сжатые стек-трейсы продакшена, преобразуя их обратно в исходные читаемые файлы, строки и колонки.

### 4. 📊 Аналитика распределения устройств и браузеров
*   **Что**: Отображение наглядных графиков (например, пончиковых диаграмм) распределения:
    *   Браузеров (Chrome, Safari, Firefox)
    *   Операционных систем (macOS, Windows, iOS, Android)
    *   Типов устройств (ПК, смартфоны)
*   **Почему**: Позволяет моментально определить, специфичен ли баг для какого-то конкретного окружения (например, воспроизводится только в Safari на iOS).

### 5. 🛠 Управление статусами и ответственные (Issue Workflow)
*   **Что**: Управление жизненным циклом ошибки (`Open` ➡️ `In Progress` ➡️ `Resolved` ➡️ `Ignored`) и назначение ответственных разработчиков.
*   **Почему**: Удобная совместная работа команды над исправлением багов.

### 6. 🚨 Оповещения в реальном времени (Slack / Telegram / Email)
*   **Что**: Мгновенные уведомления в рабочие чаты (Slack, Telegram, Discord) или на почту при появлении новых критических ошибок или резком всплеске активности багов.
*   **Почему**: Мгновенная реакция команды на инциденты без необходимости постоянно проверять дашборд.



