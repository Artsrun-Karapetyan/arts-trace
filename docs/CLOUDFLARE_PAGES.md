# Cloudflare Pages Deploy

Deploy `apps/dashboard` as a Cloudflare Pages project.

## Build settings

- **Framework preset**: Vite
- **Root directory**: repo root
- **Build command**: `pnpm i --frozen-lockfile && pnpm --filter @artstrace/dashboard build`
- **Build output directory**: `apps/dashboard/dist`

## Environment variables

```env
VITE_API_BASE_URL=https://arts-trace-api.onrender.com
```

## Notes

- `apps/dashboard/public/_redirects` is needed for client-side routes.
- The dashboard package uses `VITE_API_BASE_URL` at build time.
