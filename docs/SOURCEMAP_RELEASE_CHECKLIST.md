# ArtsTrace Sourcemap Release Checklist

## Goal

Show correct original source file, line, and column in ArtsTrace for production errors.

## Required Flow Per Deploy

1. Build frontend with sourcemaps enabled.
2. Use a unique `release` value for this deploy (recommended: commit SHA).
3. Initialize SDK with the same `release`.
4. Upload generated `.map` files to ArtsTrace API `/sourcemaps` using the same `release`.

If `release` is missing or mismatched, symbolication will be wrong.

## Frontend Requirements

### 1) SDK init

```ts
init({
  apiKey: import.meta.env.VITE_ARTSTRACE_API_KEY,
  endpoint: import.meta.env.VITE_ARTSTRACE_ENDPOINT,
  release: import.meta.env.VITE_APP_RELEASE,
});
```

### 2) Vite sourcemap

```ts
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
});
```

## CI/CD Requirements (GitLab)

Set release from CI:

```bash
export VITE_APP_RELEASE=$CI_COMMIT_SHA
```

Build and upload sequence:

```bash
yarn
yarn build
node scripts/upload-artstrace-sourcemaps.mjs
```

## Upload Payload Format

Endpoint: `POST {ARTSTRACE_API_BASE}/sourcemaps`

```json
{
  "apiKey": "PROJECT_API_KEY",
  "release": "COMMIT_SHA_OR_VERSION",
  "fileName": "main.abc123.js",
  "content": "{...full sourcemap json...}"
}
```

Notes:

- `fileName` must match filename from stack frame (`main.abc123.js`, without query/hash).
- `release` must exactly match SDK `release`.

## ArtsTrace API Requirements

- `POST /sourcemaps` endpoint enabled.
- `SourceMap` table exists and migrations applied.

## Verification After Deploy

1. Trigger a test error in production-like environment.
2. Open event in dashboard.
3. Check source location:
   - expected: original source file (e.g. `src/...`) and correct line/column
   - not expected: only bundled file like `main.abc123.js:1:12345`

## Common Failure Cases

- No sourcemaps generated (`build.sourcemap` is false).
- Sourcemaps not uploaded.
- `release` differs between SDK and upload.
- Wrong `fileName` sent during upload.
- Endpoint points to wrong API host.

## Later (When Package Is Published to npm)

After publishing `@artstrace/browser`, keep the same process:

- install/update package
- keep `release` in SDK init
- keep sourcemap upload step in CI/CD

Publishing to npm does not remove the need for sourcemap upload.
