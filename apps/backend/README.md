```txt
pnpm install
pnpm dev
```

Configure the D1 binding in `wrangler.jsonc` before running `pnpm dev` (Wrangler emulator).

## Deploy (Cloudflare Workers)

From the repo root:

```txt
pnpm --filter @apps/backend run deploy
```

Set required secrets (Cloudflare):

```txt
cd apps/backend
pnpm exec wrangler secret put TURSO_CONNECTION_URL --config wrangler.jsonc
pnpm exec wrangler secret put TURSO_AUTH_TOKEN --config wrangler.jsonc
pnpm exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.jsonc
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc

```

For custom domains, configure `routes` and `zone_name` in `wrangler.jsonc`.

## Schema & Migrations

Generate a new migration from the backend schema:

```txt
pnpm run drizzle:generate
```

Push schema changes (no migration history) to local D1 (uses Wrangler's sqlite file):

```txt
pnpm run drizzle:push:local
```

Push schema changes (no migration history) to remote D1 (requires API credentials):

```txt
pnpm run drizzle:push:remote
```

Required environment variables for remote push:
`CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`.

Apply migrations via Wrangler:

```txt
pnpm run drizzle:migrate:local
pnpm run drizzle:migrate:remote
```

## Test Database

Core/db tests use SQLite (no Wrangler required). API handler tests use Miniflare D1.

SQLite test env:

```txt
DB_PROVIDER=sqlite
SQLITE_URL=file::memory:?cache=shared
```

Apply migrations to local D1:

```txt
pnpm run drizzle:migrate:local
```

For production (remote) D1, use:

```txt
pnpm run drizzle:migrate:remote
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
