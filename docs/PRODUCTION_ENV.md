# Production Env

Use these values in `Render` and `Cloudflare Pages`.

```env
PORT=3100
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@YOUR_PROJECT-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
VITE_API_BASE_URL=https://your-render-api.onrender.com
VITE_ARTSTRACE_API_KEY=your_project_public_api_key
```

- `DATABASE_URL` = pooled connection for app runtime.
- `DIRECT_URL` больше не нужен в Prisma 7 с текущей настройкой адаптера.
