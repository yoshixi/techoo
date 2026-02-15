import { defineConfig } from 'drizzle-kit'
import type { Config } from 'drizzle-kit'
import { execSync } from 'child_process'

const schema = './src/app/db/schema/schema.ts'
const out = './migrations'

const mode = process.env.DRIZZLE_ENV ?? process.env.ENV ?? process.env.Env ?? 'local'

const getLocalSqlitePath = () => {
  const cmd =
    "find .wrangler/state/v3/d1/miniflare-D1DatabaseObject -type f -name '*.sqlite' -print -quit"
  const sqlitePath = execSync(cmd).toString().trim()
  if (!sqlitePath) {
    throw new Error('Local D1 sqlite file not found. Run `wrangler d1 migrations apply --local` once to initialize it.')
  }
  return sqlitePath
}

let config: Config

if (mode === 'local') {
  const sqlitePath = getLocalSqlitePath()
  console.log(`[drizzle-config] Using local D1 sqlite file: ${sqlitePath}`)
  config = defineConfig({
    schema,
    out,
    dialect: 'sqlite',
    dbCredentials: {
      url: sqlitePath,
    },
  })
} else {
  console.log('[drizzle-config] Using remote D1 HTTP driver')
  config = defineConfig({
    schema,
    out,
    dialect: 'sqlite',
    driver: 'd1-http',
    dbCredentials: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      databaseId: process.env.D1_DATABASE_ID!,
      token: process.env.CLOUDFLARE_API_TOKEN!,
    },
  })
}

export default config
