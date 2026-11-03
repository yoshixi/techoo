import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { unstable_dev, type Unstable_DevWorker } from 'wrangler'
import { JWT_ISSUER, JWT_SECRET } from './jwt'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/backend',
)

const workerBindings = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  BETTER_AUTH_SECRET: 'e2ee-integration-better-auth-secret-32',
  BETTER_AUTH_URL: JWT_ISSUER,
  JWT_SECRET,
  GOOGLE_CLIENT_ID: 'e2ee-integration-google-client-id',
  GOOGLE_CLIENT_SECRET: 'e2ee-integration-google-client-secret',
  GOOGLE_REDIRECT_URI: `${JWT_ISSUER}/api/auth/callback/google`,
  TRUSTED_ORIGINS: 'http://127.0.0.1',
  TURSO_MAIN_DB_URL: 'file:/tmp/techoo-e2ee-integration-main.db',
  TURSO_MAIN_DB_AUTH_TOKEN: 'unused-for-file-urls',
  TURSO_ORG_SLUG: 'test-org',
  TURSO_API_TOKEN: 'fake-api-token',
  TURSO_GROUP: 'default',
  TURSO_GROUP_AUTH_TOKEN: 'fake-group-auth-token',
  TURSO_SEED_DB_NAME: 'seed',
  TURSO_TENANT_DB_URL: 'file:/tmp/techoo-e2ee-{tenant}.db',
}

export interface SyncWorker {
  origin: string
  stop: () => Promise<void>
}

/**
 * Boot the Hono worker the way `wrangler dev` does, with a throwaway local D1.
 * Miniflare's D1 binding does not apply `migrations_dir` on its own, so the
 * SQL is applied with `wrangler d1 migrations apply --local` into the same
 * persistence directory before the server starts listening.
 */
export async function startSyncWorker(): Promise<SyncWorker> {
  const persistTo = await mkdtemp(path.join(tmpdir(), 'techoo-e2ee-d1-'))
  const configPath = path.join(backendRoot, 'wrangler.jsonc')
  const wranglerBin = path.join(path.dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js')

  await execFileAsync(
    process.execPath,
    [
      wranglerBin,
      'd1',
      'migrations',
      'apply',
      'techoo-sync',
      '--local',
      '--persist-to',
      persistTo,
      '--config',
      configPath,
    ],
    {
      cwd: backendRoot,
      env: { ...process.env, CI: '1' },
      maxBuffer: 8 * 1024 * 1024,
    },
  )

  const worker: Unstable_DevWorker = await unstable_dev(path.join(backendRoot, 'src/index.tsx'), {
    config: configPath,
    persistTo,
    ip: '127.0.0.1',
    local: true,
    logLevel: 'error',
    vars: workerBindings,
    experimental: {
      disableExperimentalWarning: true,
      disableDevRegistry: true,
      showInteractiveDevSession: false,
    },
  })

  const origin = `http://${worker.address}:${worker.port}`
  const health = await fetch(`${origin}/api/health`)
  if (!health.ok) {
    const body = await health.text()
    await worker.stop()
    await rm(persistTo, { recursive: true, force: true })
    throw new Error(`sync worker health check failed (${health.status}): ${body}`)
  }

  return {
    origin,
    async stop() {
      await worker.stop()
      await rm(persistTo, { recursive: true, force: true })
    },
  }
}
