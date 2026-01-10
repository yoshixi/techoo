# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shuchu is a task management application built as a monorepo with a Next.js backend API and an Electron desktop client. The project uses Turbo for build orchestration and pnpm for package management.

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
# Start all apps in development mode
pnpm run dev

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

The web app uses Drizzle ORM with SQLite (local) or Turso (production):

```sh
# Generate migrations
pnpm --filter web run drizzle:generate

# Apply migrations
pnpm --filter web run drizzle:migrate

# Push schema directly to database
pnpm --filter web run drizzle:push

# Pull schema from remote database
pnpm --filter web run drizzle:pull

# Production commands (requires TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN)
pnpm --filter web run drizzle:push:prod
pnpm --filter web run drizzle:generate:prod
```

Database configuration automatically switches between local SQLite (`./tmp/local.db`) and Turso based on environment variables.

### Changing Database Schema

When making changes to the database schema, follow this workflow to ensure migrations are properly created and applied:

1. **Modify the schema**
   - Edit `apps/web/app/db/schema/schema.ts` to add/modify/remove columns or tables
   - Example: Adding a new column to the `tasksTable`

2. **Generate migration**
   ```sh
   # Enter devenv shell first
   devenv shell

   # Generate migration from schema changes
   pnpm --filter web run drizzle:generate
   ```

   This creates a new migration file in `drizzle/migrations/` with SQL statements representing your schema changes.

3. **Review the migration**
   - Check the generated SQL file in `drizzle/migrations/` to ensure it matches your intended changes
   - The migration file will have a name like `0001_<adjective>_<noun>.sql`

4. **Apply migration to database**
   ```sh
   # Still in devenv shell
   pnpm --filter web run drizzle:migrate
   ```

   This applies the migration to your configured database (local SQLite or Turso based on environment variables).

5. **Verify the changes**
   - Test your application to ensure the schema changes work as expected
   - Check that API endpoints correctly handle the new/modified fields

**Important notes:**
- Always run these commands within `devenv shell` to ensure the correct environment
- Use the npm scripts (`pnpm --filter web run drizzle:*`) rather than running `drizzle-kit` directly
- Migration files are automatically created based on the difference between your schema and the database
- For production databases, ensure `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` are set before running migrations
- Never manually edit migration files after they've been applied to a database
- Keep migration files in version control to maintain schema history

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
