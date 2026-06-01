# Module 19 — Infrastructure & Deployment

## 1. Nx Monorepo Structure

```
maple-loom-handmade-workspace/
  apps/
    api/           # NestJS REST API (port 3002)
    client/        # Next.js 15 storefront (port 3000)
    admin/         # Next.js 15 admin panel (port 3001)
  libs/
    shared/
      types/       # @mlh/types — shared TypeScript types
      api-client/  # @mlh/api-client — fetch client + hooks
    ui/            # @mlh/ui — shared React component library
  prisma/
    schema.prisma
    seed.ts
    seed-mongo.ts
    prisma.config.ts
  .claude/specs/   # This directory
```

## 2. Package Manager & Versions

| Tool | Version |
|---|---|
| pnpm | 11.0.9 |
| Node.js | 20+ |
| Nx | 22.7.2 |
| TypeScript | 5.7.2 |
| Next.js | 15.x |
| NestJS | 10.x |
| Prisma | 7.x (driver adapter) |
| Mongoose | 8.x |

## 3. Railway Deployment

### Services
| Service | Config |
|---|---|
| API | NestJS, port 3002, Dockerfile or Nixpacks |
| Client | Next.js, port 3000, Nixpacks |
| Admin | Next.js, port 3001, Nixpacks |
| PostgreSQL | Railway managed |
| Redis | Railway managed |

### Environment Variables (Railway)
- `DATABASE_URL` — Railway PostgreSQL connection string
- `MONGODB_URI` — MongoDB Atlas `mongodb+srv://` URI
- `REDIS_URL` — Railway Redis URL
- `NEXT_PUBLIC_API_URL` — API public URL (NO /api/v1 suffix)
- `CORS_ORIGINS` — comma-separated allowed origins
- All secret keys (JWT, Stripe, SendGrid, etc.)

### CORS Fix for Production
```
CORS_ORIGINS="https://mapleloomhandmade.com,https://admin.mapleloomhandmade.com"
```
Do NOT use `origin: '*'` with `credentials: true`.

### apiClient URL Fix
`NEXT_PUBLIC_API_URL` must NOT include `/api/v1` suffix.
The `apiClient` strips it and re-adds it internally:
```typescript
let baseUrl = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002')
  .replace(/\/api\/v1\/?$/, '');
```

## 4. MongoDB Atlas

### Connection
- SRV URI: `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/`
- UDP port 53 may be blocked in Railway/cloud environments
- Solution: DNS-over-HTTPS (DoH) via `dns.google/resolve`

### DoH Resolution (in main.ts)
```typescript
async function resolveMongoSrvUri(uri: string): Promise<string> {
  // Resolves _mongodb._tcp.<host> SRV record via HTTPS
  // Rewrites to direct mongodb:// connection string
  // Used in: main.ts (API), seed.ts, seed-mongo.ts
}
```

## 5. Nx Commands

```bash
# Run tasks
pnpm nx serve api           # Start API dev server
pnpm nx serve client        # Start client dev server
pnpm nx build api           # Build API
pnpm nx build client        # Build client
pnpm nx lint api            # Lint API
pnpm nx test api            # Test API
pnpm nx affected --target=build  # Build only affected projects

# Generate (always use nx-generate skill first)
pnpm nx g @nx/nest:module    # Add NestJS module
pnpm nx g @nx/next:page      # Add Next.js page
```

## 6. Dev Environment

### Required Services (local dev)
| Service | How | Port |
|---|---|---|
| PostgreSQL | Railway or local Docker | 5432 |
| MongoDB | Atlas (cloud) | — |
| Redis | Optional (DISABLE_QUEUE=true to skip) | 6379 |
| MinIO (S3) | Docker (`minio/minio`) | 9000 |
| MailHog | Docker (`mailhog/mailhog`) | 1025/8025 |

### DISABLE_QUEUE=true
When Redis is not available locally:
- Set `DISABLE_QUEUE=true` in `.env`
- `DevBullModule` provides no-op queue tokens
- RedisService `available` flag prevents connection errors from crashing API
- `uncaughtException` handler catches Redis ECONNREFUSED

## 7. CI/CD

- Git: GitHub repository
- Railway auto-deploy on push to `main` branch
- Build command: `pnpm nx build <app>`
- Start command: `node dist/apps/<app>/main.js` (API) or `pnpm next start` (Next)

## 8. Environment Files

| File | Purpose |
|---|---|
| `.env` | Local development (gitignored, contains real creds) |
| `.env.example` | Template (committed, no real creds) |
| Railway UI | Production secrets (never in git) |

## 9. Cloudflare R2 (Storage)

- Dev: MinIO (S3-compatible) at `http://localhost:9000`
- Prod: Cloudflare R2
- Config: AWS SDK with custom endpoint (`AWS_S3_ENDPOINT`)
- Bucket: `mlh-assets`
- CDN URL: `CDN_URL` env var (dev: `http://localhost:9000/mlh-assets`)
- Subfolders: `uploads/temp/`, `uploads/`, `previews/`, `templates/`
