# API Integration – Technical Reference

This document captures how the Electron renderer consumes the Hono API and the build steps that keep the generated client in sync with the backend.

## Renderer Architecture

- `src/renderer/src/main-integrated.tsx` reads `VITE_USE_API` and switches between the offline `App` and the API backed `ApiApp`.
- `ApiApp` (`src/renderer/src/ApiApp.tsx`) renders a tabbed experience (Dashboard, Tasks, Timers) and hosts the integration demos.
- `HealthCheck`, `TaskManager`, `TimerManager`, and `Versions` (under `src/renderer/src/components/`) import the generated SWR hooks to interact with `/api/health`, `/api/tasks`, and `/api/timers`.
- All components are written with React 19 and shadcn/ui primitives, so they work in both Electron modes—the difference is purely whether SWR hits the network.

```
┌────────────┐      ┌──────────────┐      ┌────────────────────────┐
│ Hono API   │ ---> │ OpenAPI spec │ ---> │ orval generated client │
└────────────┘      └──────────────┘      └────────────┬───────────┘
                                                       │
                                          ┌────────────▼────────────┐
                                          │ ApiApp + child modules  │
                                          └─────────────────────────┘
```

## HTTP / Mutator Layer

`src/renderer/src/lib/api/mutator.ts` is the only hand-written component in the networking stack. Every generated hook calls `customInstance`, which wraps the native `fetch` API:

```ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api'

export const customInstance = <T>(config: CustomRequestConfig): Promise<T> => {
  const url = `${API_BASE_URL}${config.url}`
  const requestConfig: RequestInit = {
    method: config.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: config.data ? JSON.stringify(config.data) : undefined
  }

  return fetch(url, requestConfig).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
    }

    return response.headers.get('content-type')?.includes('application/json')
      ? response.json()
      : ((await response.text()) as T)
  })
}
```

Benefits of this approach:

- No axios/polyfill dependencies.
- Works inside the Electron renderer without Node globals.
- Centralized error normalization (every non‑2xx response becomes a thrown `Error`).

## Generated Sources

Running `pnpm run orval:generate` emits the client under `src/renderer/src/gen/api`:

```
src/renderer/src/gen/api/
├── endpoints/
│   └── techoAPI.gen.ts   # SWR hooks + request helpers
└── schemas/
    ├── *.ts               # DTO + schema typings
    └── index.ts
```

Hook naming mirrors the REST surface:

- `useGetApiTasks` – `GET /api/tasks`
- `usePostApiTasks` – `POST /api/tasks`
- `usePutApiTasksId` – `PUT /api/tasks/:id`
- `useDeleteApiTasksId` – `DELETE /api/tasks/:id`
- `useGetApiTimers`, `usePostApiTimers`, `useGetApiTasksTaskIdTimers`, etc.

Each hook exposes the SWR response (`data`, `error`, `isLoading`, `mutate`) while mutations expose `trigger`, `isMutating`, and `reset`.

## Orval Configuration

```ts
// apps/electron/orval.config.js
export default {
  api: {
    input: './openapi.json',
    output: {
      target: './src/renderer/src/gen/api/endpoints',
      schemas: './src/renderer/src/gen/api/schemas',
      fileExtension: '.gen.ts',
      client: 'swr',
      mode: 'split',
      override: {
        mutator: {
          path: './src/renderer/src/lib/api/mutator.ts',
          name: 'customInstance'
        }
      },
      clean: true,
      prettier: true
    }
  }
}
```

- `mode: 'split'` keeps endpoints and schemas in separate folders.
- `clean: true` wipes the old generated files on every run, so never keep hand-written code inside `src/renderer/src/gen/api`.
- The mutator lives outside the generated tree to avoid being deleted.

## Development Environment

This project requires [devenv](https://devenv.sh/) for a consistent development experience.

- **Shell**: Always work within the `devenv shell`.
- **Package Manager**: Use `pnpm` for all node-related tasks (install, run, build).

Refer to the root [DEV_ENVIROMENT.md](../../../DEV_ENVIROMENT.md) for detailed instructions.

## Scripts & Tooling

`apps/electron/package.json` exposes the relevant commands:

| Script | Purpose |
|--------|---------|
| `pnpm run gen:openapi` | Calls `@scripts/openapischema-generator` to emit `apps/electron/openapi.json`. |
| `pnpm run orval:generate` | Generates the SWR hooks + schema types. |
| `pnpm run api:generate` | Runs both commands sequentially. |
| `pnpm run orval:watch` | Watches the OpenAPI file and regenerates on change. |
| `pnpm run dev:api` | Copies `.env_api_example` to `.env` (sets `VITE_API_URL` + `VITE_USE_API=true`) and launches `electron-vite dev`. |
| `pnpm run dev` | Launches the renderer without modifying `.env` (offline mode by default). |

## Working With The Hooks

```tsx
import {
  useGetApiTasks,
  usePostApiTasks,
  type CreateTaskRequest
} from '../gen/api'

export function TaskManager(): JSX.Element {
  const { data: tasks, error, isLoading, mutate } = useGetApiTasks()
  const { trigger: createTask, isMutating } = usePostApiTasks()

  async function handleCreateTask(form: CreateTaskRequest) {
    await createTask({ data: form })
    mutate() // revalidate cache with server state
  }

  // …render loading state, errors, and the task list
}
```

- Pass `{ swr: { enabled: false } }` when a hook depends on user input (for example, defer `useGetApiTasksId` until an ID exists).
- All hooks return `mutate` so you can optimistically update or revalidate on demand.
- Mutations surface `isMutating` which the UI uses to disable buttons (`CreateTask` form, timer buttons, etc.).

## Error Handling & Resilience

- Loading skeletons appear while SWR resolves (`TaskManager`, `TimerManager`).
- Errors from SWR display inline with a retry affordance (call `mutate()`).
- Because every `fetch` failure throws, adding global toast/logging is as simple as wrapping the app in `SWRConfig` and defining `onError`.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module '../gen/api'` | Client not generated after a clean checkout | Run `pnpm run api:generate`. |
| API requests point to `http://localhost:5173` | Missing `.env` / wrong `VITE_API_URL` | Copy `.env_example` or adjust `.env`. |
| Requests fail with `fetch failed` | Backend not running or wrong port | Start `apps/backend` (`pnpm --filter @apps/backend dev`). |
| Mutator file missing during generation | File deleted while `clean` is enabled | Restore `src/renderer/src/lib/api/mutator.ts` before running Orval. |

Armed with these details you can confidently evolve both the backend schema and the Electron UI without re-learning the integration each time.
