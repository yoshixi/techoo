import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './src/index.tsx',
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          NODE_ENV: 'test',
          LOG_LEVEL: 'silent',
          BETTER_AUTH_SECRET: 'test-better-auth-secret-at-least-32-characters-long',
          BETTER_AUTH_URL: 'http://localhost:8787',
          JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
          GOOGLE_CLIENT_ID: 'test-google-client-id',
          GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
          GOOGLE_REDIRECT_URI: 'http://localhost:8787/api/auth/callback/google',
          TRUSTED_ORIGINS: 'http://localhost',
          TURSO_MAIN_DB_URL: 'file:/tmp/techoo-worker-default.db',
          TURSO_MAIN_DB_AUTH_TOKEN: 'unused-for-file-urls',
          TURSO_ORG_SLUG: 'test-org',
          TURSO_API_TOKEN: 'fake-api-token',
          TURSO_GROUP: 'default',
          TURSO_GROUP_AUTH_TOKEN: 'fake-group-auth-token',
          TURSO_SEED_DB_NAME: 'seed',
          TURSO_TENANT_DB_URL: 'file:/tmp/{tenant}.db',
        },
      },
    }),
  ],
  test: {
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    include: ['test/**/*.worker.test.ts'],
  },
})
