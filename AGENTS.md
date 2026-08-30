# Repository Guidelines

## Development environment (read this first)

The repo defines its toolchain with **Nix flakes** (`flake.nix`). Run all project commands inside that environment so tool versions match and host shell hooks do not interfere.

- Interactive shell: `nix develop` (from the repo root)
- One-shot command: `nix develop --command pnpm run check-types`
- With [direnv](https://direnv.net/) + `use flake`, interactive shells are already in the dev env; for **non-interactive / agent runs**, still prefer `nix develop --command …`.

## Project structure

| Path | Purpose |
|---|---|
| `apps/backend` | Hono API (Cloudflare Workers + Drizzle ORM) |
| `apps/web` | Next.js frontend |
| `apps/mobile` | React Native / Expo app |
| `apps/electron` | Electron desktop app |
| `apps/docs` | Documentation site |
| `packages/ui` | Shared React components (shadcn/ui) |
| `packages/eslint-config` | Shared ESLint config |
| `packages/typescript-config` | Shared TypeScript configs |

## Common commands

Prefix with `nix develop --command` when not already inside `nix develop`.

```sh
pnpm run dev          # Start all apps (Turbo)
pnpm run dev-mobile   # Expo dev server (simulator: i for iOS, a for Android)
pnpm run build        # Build all apps/packages
pnpm run lint         # Lint all
pnpm run check-types  # Type-check all — run after every edit
pnpm run test         # Run all tests
pnpm run format       # Format with Prettier
```

Per-app:
```sh
pnpm --filter @apps/backend run dev   # API server (wrangler)
pnpm --filter web run dev             # Next.js frontend
pnpm --filter electron run dev        # Electron desktop
pnpm --filter mobile run dev          # Expo mobile
```

## Backend (apps/backend)

**Architecture:** Hono + `@hono/zod-openapi`, multi-tenant Turso/libSQL databases.

- **Main DB**: auth tables (users, sessions, accounts)
- **Tenant DBs** (per-user): domain data (todos, posts, notes, calendars)
- **Seed DB**: template cloned when provisioning new tenant DBs

**API pattern:**
- `src/app/api/[[...route]]/routes/` — OpenAPI route definitions
- `src/app/api/[[...route]]/handlers/` — route handlers
- `src/app/core/*.core.ts` — Zod models and business logic
- `src/app/core/*.db.ts` — database access layer
- `src/app/db/schema/schema.ts` — Drizzle schema

**Schema change workflow:**
1. Edit `src/app/db/schema/schema.ts`
2. `pnpm --filter @apps/backend run drizzle:generate` — commit the new SQL under `migrations/`
3. `pnpm --filter @apps/backend run migrate-all` — apply migrations to main, seed, and all tenant DBs (prod: GitHub Actions → **Migrate Production Databases**)
4. Restart the dev server

> Production uses `migrate-all.ts` (Drizzle migration files), not `drizzle:push`. Always generate a migration after schema edits or prod tenant DBs will miss new tables.
>
> The seed DB must always be updated first — new tenants are cloned from it.

**Tests:** Vitest, files named `*.test.ts` alongside handlers.
```sh
nix develop --command bash -c "cd apps/backend && npx vitest run"
```

**After API changes:** regenerate the Electron client:
```sh
pnpm --filter electron run api:generate
```

## Agent workflow

- **Always run `pnpm run check-types` after edits** to keep the repo type-safe.
- Use `nix develop --command …` for all shell commands in non-interactive contexts.

## Planning docs (`agents/plans/`)

Place ADR-style planning documents in `agents/plans/`.

**File naming:** `YYYY-MM-DD-<kebab-slug>.md` (e.g. `2026-07-19-favorite-list-posts.md`)

**Required sections:**
- **Date / Status / Branch** — frontmatter
- **Context** — why this change is needed, constraints
- **Decision** — what was decided (schema, API, file structure)
- **Consequences** — trade-offs, rejected alternatives

Docs in `docs/` are for new-developer guides and should stay high-level. For implementation specifics, link to the relevant `agents/plans/` ADR and source code.

## Environment variables

Required for production database operations:
- `TURSO_CONNECTION_URL`
- `TURSO_AUTH_TOKEN`
- `TURSO_ORG_SLUG`, `TURSO_GROUP`, `TURSO_GROUP_AUTH_TOKEN`
- `TURSO_SEED_DB_NAME`, `TURSO_TENANT_DB_URL`
