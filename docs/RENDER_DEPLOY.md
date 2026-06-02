# Render Deploy

Deploy `apps/api` as a Render Web Service.

## Service settings

- **Root Directory**: repo root
- **Build Command**: `pnpm i --frozen-lockfile && pnpm db:generate`
- **Start Command**: `pnpm --filter @artstrace/api start`
- **Runtime**: Node

Make sure `pnpm-lock.yaml` is committed to GitHub.

## Environment variables

```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@YOUR_PROJECT-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
PORT=3100
```

## After deploy

- Run migrations against Neon.
- Copy the public Render URL into `VITE_API_BASE_URL` for Cloudflare Pages.
- Use the same API URL in the browser SDK `endpoint`.
