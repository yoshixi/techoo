# Electron + Hono API Integration

The Electron renderer embeds two experiences:

- `src/renderer/src/App.tsx` provides the original offline task UI backed by local state.
- `src/renderer/src/ApiApp.tsx` wires the UI to the Hono API through auto‑generated SWR hooks and a custom `fetch` mutator.

`src/renderer/src/main-integrated.tsx` decides which UI to render by reading `VITE_USE_API`. When `VITE_USE_API=true`, the renderer shows the API driven experience and surfaces a little `API MODE` badge in the top‑right corner so you always know which mode is active.

## Runtime Modes

```tsx
// src/renderer/src/main-integrated.tsx
const USE_API = import.meta.env.VITE_USE_API === 'true'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {USE_API ? <ApiApp /> : <App />}
  </React.StrictMode>
)
```

- `pnpm run dev` – runs the offline UI (`VITE_USE_API` defaults to `false`).
- `pnpm run dev:api` / `pnpm run start:api` – copies `.env.api` to `.env` and boots the renderer with API mode enabled.

## Setup Checklist

> [!IMPORTANT]
> This project uses **devenv**. Before starting, ensure you have entered the development environment by running `devenv shell` at the project root. All Node.js commands (like `pnpm`) should be executed within this shell. Refer to [DEV_ENVIROMENT.md](../../../DEV_ENVIROMENT.md) for more details.

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Run the Hono backend** (from `apps/backend`) so `http://localhost:8787/api` is reachable.
3. **Create a `.env` file** or copy `.env.example` and set:
   ```env
   VITE_API_URL=http://localhost:8787/api
   VITE_USE_API=true
   ```
4. **Generate the OpenAPI client** whenever backend contracts change:
   ```bash
   pnpm run api:generate          # runs gen:openapi + orval:generate
   ```
5. **Start the Electron app** in API mode to exercise the integration:
   ```bash
   pnpm run dev:api
   ```

## Generated Client Layout

The API client lives under `src/renderer/src/gen/api`:

```
src/renderer/src/gen/api/
├── endpoints/
│   └── shuchuAPI.gen.ts      # SWR hooks + fetchers (auto-generated)
└── schemas/
    ├── *.ts                  # Strongly typed schema slices (auto-generated)
    └── index.ts
```
The custom fetch client that powers those hooks lives next door in `src/renderer/src/lib/api/mutator.ts` so Orval never overwrites it.

Whenever you regenerate the client, Orval rewrites the `endpoints/` and `schemas/` files so the renderer immediately picks up the latest hooks and DTO types.

### Custom fetch client

`src/renderer/src/lib/api/mutator.ts` defines the shared HTTP client that Orval plugs into every hook:

```ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api'

export const customInstance = <T>(config: CustomRequestConfig): Promise<T> => {
  const url = `${API_BASE_URL}${config.url}`
  const requestConfig: RequestInit = {
    method: config.method || 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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

Because we lean on the native `fetch` API there is no extra HTTP client dependency and everything works inside the renderer without special Electron shims.

## Integration Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ApiApp` | `src/renderer/src/ApiApp.tsx` | Hosts the dashboard tabs and wires child components together. |
| `HealthCheck` | `src/renderer/src/components/HealthCheck.tsx` | Polls `/api/health` with `useGetApiHealth` and reports connection status. |
| `TaskManager` | `src/renderer/src/components/TaskManager.tsx` | Full CRUD UI using `useGetApiTasks`, `usePostApiTasks`, `usePutApiTasksId`, and `useDeleteApiTasksId`. |
| `TimerManager` | `src/renderer/src/components/TimerManager.tsx` | Fetches timers globally or per task via `useGetApiTimers` / `useGetApiTasksTaskIdTimers` and starts timers with `usePostApiTimers`. |
| `Versions` | `src/renderer/src/components/Versions.tsx` | Shows the runtime versions (handy for support/debugging). |

The hooks expose SWR primitives (`data`, `error`, `isLoading`, `mutate`, `trigger`) so components gain caching, background revalidation, optimistic updates, and request deduping out of the box.

### Fetching data

```tsx
import { useGetApiTasks } from '../gen/api'

export function TaskList(): JSX.Element {
  const { data: tasks, error, isLoading, mutate } = useGetApiTasks()

  if (isLoading) return <Skeleton />
  if (error) return <ErrorState retry={() => mutate()} />

  return (
    <ul>
      {tasks?.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}
```

### Mutating with SWR

```tsx
const { trigger: createTask, isMutating } = usePostApiTasks()

async function handleCreateTask(form: CreateTaskRequest) {
  await createTask({ data: form })
  mutateTasks() // Provided by useGetApiTasks
}
```

### Handling timers

`TimerManager` accepts an optional `taskId` prop so you can reuse it within task detail views. When provided, it switches to the nested route `GET /api/tasks/:taskId/timers`; otherwise it lists everything via `GET /api/timers`.

## Development Workflow

1. **Edit the Hono API** inside `apps/web` (routes + Zod schemas).
2. **Regenerate the OpenAPI schema**: `pnpm run gen:openapi`.
3. **Regenerate the client**: `pnpm run orval:generate` (or `pnpm run api:generate` to run both).
4. **Use the new hooks/types** in the renderer – TypeScript will highlight everything that needs to be updated.
5. **Test in API mode** with `pnpm run dev:api`.

`pnpm run orval:watch` is also available if you prefer regenerating the client automatically while iterating on the backend schema.

## Troubleshooting

- **API requests fail immediately** – confirm the backend is running, `VITE_API_URL` points to the correct host, and you launched the renderer with `VITE_USE_API=true`.
- **Type errors after backend changes** – rerun `pnpm run api:generate` so the generated hooks match the latest schema.
- **Missing mutator errors while generating** – ensure `src/renderer/src/lib/api/mutator.ts` exists before running Orval (the config references it).
- **Stale `.env` values** – `dev:api` copies `.env.api` into `.env` every time; delete `.env` or update it manually if you need a different target server.

With this setup the Electron renderer stays fully type-safe, relies on the native `fetch` API for HTTP calls, and can pivot between offline and API-backed modes without touching the code.***
