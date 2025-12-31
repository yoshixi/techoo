# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: Next.js web app and API routes. Core logic in `apps/web/app/core`, DB schema in `apps/web/app/db`, and tests under `apps/web/**/**/*.test.ts`.
- `apps/electron`: Electron + React app (main, preload, renderer). Renderer UI lives in `apps/electron/src/renderer/src`.
- `apps/docs`: Next.js docs site.
- `packages/ui`: Shared UI components.
- `packages/eslint-config` and `packages/typescript-config`: Shared lint/TS configs.
- `scripts/openapischema-generator`: OpenAPI schema generator.
- `ai-docs`: Planning docs and project notes.

## Build, Test, and Development Commands
- `devenv shell`: Enter the dev environment required by this repo.
- `devenv shell -- pnpm run dev`: Run all apps via Turbo from the repo root.
- `devenv shell -- pnpm run build`: Build all apps/packages via Turbo.
- `devenv shell -- pnpm run lint`: Lint all apps/packages via Turbo.
- `devenv shell -- pnpm run test`: Run all tests via Turbo (currently mainly `apps/web`).
- `devenv tasks run web:test`: Example of a custom devenv task for web tests.
- `devenv shell -- pnpm --filter web dev`: Run only the web app (port 3000). `--filter docs` uses port 3001.
- `devenv shell -- pnpm --filter electron dev`: Run the Electron app locally.

## Coding Style & Naming Conventions
- TypeScript-first, React/Next for web/docs, Electron + Vite for desktop.
- Use 2-space indentation (Prettier default). Run `pnpm run format` at the root or `pnpm --filter electron format`.
- ESLint is enforced per app; prefer shared configs under `packages/eslint-config`.
- Naming: React components in `PascalCase.tsx`, utilities in `camelCase.ts`, tests end with `.test.ts`.

## Testing Guidelines
- Web app tests use Vitest (`apps/web/vitest.config.ts`).
- Naming: `*.test.ts` in `apps/web` (e.g., `apps/web/app/api/**/tasks.test.ts`).
- Run web tests: `pnpm --filter web test` or `pnpm --filter web test:watch`.
- No formal coverage threshold is configured; keep coverage meaningful when adding features.

## Commit & Pull Request Guidelines
- Recent history shows short, descriptive messages (no strict convention). Prefer imperative summaries like “Add timer API validation”.
- PRs should describe scope, link related issues, and include screenshots for UI changes (web/docs/electron).

## Configuration & Data
- Example env files: `apps/web/.env.local.example` and `apps/web/.env.production.example`.
- Drizzle migrations live under `apps/web/drizzle/migrations`. Use `pnpm --filter web drizzle:push` for local schema updates.

## Agent Notes
- Place planning documents in `ai-docs/` as requested in `README.md`.
