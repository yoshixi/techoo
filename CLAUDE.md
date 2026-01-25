# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shuchu is a task management application built as a monorepo with a Next.js backend API and an Electron desktop client. The project uses Turbo for build orchestration and pnpm for package management.

## Agent Notes
- Always run `pnpm run check-types` after making edits to ensure we keep the repo type-safe. Keep this as part of your default workflow.
- Put the implementation plans to agents/plans
- Put the general specifications to docs. The docs should work as guides for new developers. So it doesn't have to have too specific things. Ideal way is the developer should check docs first, then to nail down the specifications, they should find out the history from the agents/plans and codes.

## Development Environment

This project uses **devenv** for environment management. Before starting development:

```sh
devenv shell  # Enter the development environment
```

Devenv provides:
- Git, pnpm, and turso-cli
- Python environment for SQLite operations
- Custom task runners

## Common Commands

### Building and Running

```sh
# Start all apps in development mode (uses default database config)
pnpm run dev

# Start web app with local SQLite database
pnpm --filter web run dev:local

# Start web app with production Turso database (requires TURSO env vars)
pnpm --filter web run dev:prod

# Build all apps and packages
pnpm run build

# Run linting across all packages
pnpm run lint

# Type checking across all packages
pnpm run check-types

# Format code
pnpm run format
```

### Testing

```sh
# Run all tests
devenv shell -- pnpm run test

# Run tests for a specific package (using devenv tasks)
devenv tasks run web:test

# Watch mode for tests in web app
pnpm --filter web run test:watch
```

### Package Management

```sh
# Add a dependency to a specific package
pnpm --filter web add <package-name>
pnpm --filter electron add -D <package-name>
```

### Database Operations (Web App)

The web app uses Drizzle ORM with different strategies for local and production environments.

**Running the API server:**
```sh
# Run with local SQLite database (default for dev)
pnpm --filter web run dev:local

# Run with production Turso database (requires TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN)
pnpm --filter web run dev:prod
```

The server automatically selects the database based on environment variables:
- If `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` are set → Uses Turso
- Otherwise → Uses local SQLite at `./tmp/local.db`

**Local Development (SQLite):**
- Uses `drizzle:push:local` for fast iteration without migration history
- Configuration: `drizzle.config.local.ts` → `./tmp/local.db`

```sh
# Push schema changes directly to local database (recommended for local dev)
pnpm --filter web run drizzle:push:local

# Pull schema from local database
pnpm --filter web run drizzle:pull:local

# Open Drizzle Studio to view/edit data
pnpm --filter web run drizzle:studio:local
```

**Production (Turso):**
- Uses proper migrations for schema versioning and history
- Configuration: `drizzle.config.prod.ts` → Turso database
- Requires: `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` environment variables

```sh
# Generate migration files from schema changes
pnpm --filter web run drizzle:generate:prod

# Apply migrations to production database
pnpm --filter web run drizzle:migrate:prod
```

### Changing Database Schema

The workflow differs between local development and production environments:

#### Local Development Workflow (Fast Iteration)

For local development, use schema push for quick iteration without maintaining migration history:

1. **Modify the schema**
   - Edit `apps/web/app/db/schema/schema.ts` to add/modify/remove columns or tables

2. **Push changes to local database**
   ```sh
   # Enter devenv shell first
   devenv shell

   # Push schema changes directly to local database
   pnpm --filter web run drizzle:push:local
   ```

   This directly updates your local SQLite database without creating migration files.

3. **Verify the changes**
   - Test your application to ensure the schema changes work as expected
   - Use `pnpm --filter web run drizzle:studio:local` to inspect the database visually

#### Production Workflow (Migration-based)

For production, use proper migrations to maintain schema versioning and history:

1. **Modify the schema**
   - Edit `apps/web/app/db/schema/schema.ts` to add/modify/remove columns or tables

2. **Generate migration**
   ```sh
   # Enter devenv shell first
   devenv shell

   # Ensure TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN are set
   pnpm --filter web run drizzle:generate:prod
   ```

   This creates a new migration file in `drizzle/migrations/` with SQL statements representing your schema changes.

3. **Review the migration**
   - Check the generated SQL file in `drizzle/migrations/` to ensure it matches your intended changes
   - The migration file will have a name like `0001_<adjective>_<noun>.sql`

4. **Apply migration to production**
   ```sh
   # Still in devenv shell with TURSO credentials set
   pnpm --filter web run drizzle:migrate:prod
   ```

   This applies the migration to your Turso production database.

5. **Commit the migration file**
   - Add the migration file to git: `git add apps/web/drizzle/migrations/`
   - Commit with a descriptive message: `git commit -m "Add start_at column to tasks table"`

**Important notes:**
- **Local:** Use `drizzle:push:local` for fast iteration without migration history
- **Production:** Always use `drizzle:generate:prod` + `drizzle:migrate:prod` to maintain migration history
- Always run these commands within `devenv shell` to ensure the correct environment
- Never manually edit migration files after they've been generated
- Migration files must be committed to version control for production deployments
- Each environment uses a separate config file: `drizzle.config.local.ts` and `drizzle.config.prod.ts`

### Electron App

```sh
# Development
pnpm --filter electron run dev

# Development with API connection
pnpm --filter electron run dev:api

# Build for different platforms
pnpm --filter electron run build:mac
pnpm --filter electron run build:win
pnpm --filter electron run build:linux

# Generate TypeScript API client from OpenAPI schema
pnpm --filter electron run api:generate
```

## Architecture

### Monorepo Structure

- **apps/web**: Next.js application with Hono API backend
- **apps/electron**: Electron desktop application
- **apps/docs**: Documentation site
- **packages/ui**: Shared UI components
- **packages/eslint-config**: Shared ESLint configuration
- **packages/typescript-config**: Shared TypeScript configurations
- **scripts/openapischema-generator**: Generates OpenAPI schema from Hono routes

### Web App (Backend API)

The web app is a Next.js application that serves a Hono-based REST API at `/api`:

**Key directories:**
- `app/api/[[...route]]`: API implementation using Hono with OpenAPI
  - `routes/`: OpenAPI route definitions (using @hono/zod-openapi)
  - `handlers/`: Route handler implementations
  - `route.ts`: Main API entry point, exports `honoApp` for schema generation
- `app/core/`: Business logic layer
  - `*.core.ts`: Domain logic and business rules
  - `*.db.ts`: Database access layer using Drizzle ORM
- `app/db/schema/`: Drizzle ORM schema definitions

**API Pattern:**
1. Routes are defined with OpenAPI specifications in `routes/`
2. Handlers implement the business logic in `handlers/`
3. Handlers use core modules from `app/core/` for business logic
4. Core modules use `*.db.ts` files for database operations
5. OpenAPI documentation is available at `/api/doc`

**Database Schema:**
- `usersTable`: User information
- `tasksTable`: Task management with due dates, completion status, and timestamps
- `taskTimersTable`: Time tracking for tasks with start/end times

All tables use UUID v7 for IDs and Unix timestamps for time fields.

### Electron App

The Electron app consumes the web API via auto-generated TypeScript clients:

**Key directories:**
- `src/main/`: Electron main process (window management, IPC)
- `src/renderer/`: React frontend application
- `src/renderer/src/gen/api/`: Auto-generated API client from OpenAPI schema
- `src/preload/`: Electron preload scripts

**API Client Generation:**
1. `pnpm --filter electron run gen:openapi` generates `openapi.json` from the Hono app
2. `pnpm --filter electron run orval:generate` generates TypeScript clients using Orval
3. Orval uses SWR for React hooks and a custom mutator (`src/renderer/src/lib/api/mutator.ts`)

**Floating Windows:**
The Electron app supports floating windows for individual tasks. The main process manages window creation via IPC handlers (`create-floating-window`, `close-floating-window`).

### Shared Packages

- **packages/ui**: React components (likely shadcn/ui based components)
- **packages/eslint-config**: ESLint configuration for the monorepo
- **packages/typescript-config**: Base TypeScript configs (`base.json`, `nextjs.json`, `react-library.json`)

## Key Technologies

- **Turborepo**: Monorepo build system
- **Next.js 16**: Web framework for the API backend
- **Hono**: Fast web framework with OpenAPI support
- **Drizzle ORM**: TypeScript ORM for SQLite/Turso
- **Electron**: Desktop application framework
- **React 19**: UI framework
- **Tailwind CSS 4**: Styling
- **SWR**: Data fetching for React
- **Orval**: OpenAPI code generator
- **Vitest**: Testing framework
- **devenv**: Development environment manager (Nix-based)

## Planning Documentation

Planning documents should be placed in the `ai-docs/` directory.

## Development Logs

At the end of each session, create a dev-log in `apps/electron/dev-logs/` documenting:
- What was implemented
- Commands executed (especially for manual procedures like icon generation)

**File naming format:** `YYYY-MM-DD-$BRANCH_NAME-$WORKTITLE.md`

Example: `2026-01-12-shuchu-desktop-app-build-electron-release-workflow.md`

## Environment Variables

Required for production database operations:
- `TURSO_CONNECTION_URL`: Turso database connection URL
- `TURSO_AUTH_TOKEN`: Turso authentication token
- `TURSO_DATABASE_URL`: Alternative Turso database URL format

## Important Notes

- The project uses pnpm workspaces with specific package overrides for React 19 and esbuild
- Only specified dependencies (better-sqlite3, electron, esbuild, sharp) should be built from source
- Tests in Electron app are not yet implemented (`echo 'No tests for electron yet'`)
- API changes require regenerating the Electron client (`api:generate` command)
