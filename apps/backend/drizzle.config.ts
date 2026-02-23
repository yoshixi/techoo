import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })

const hasTursoConfig = process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN
const useLocalDb = !hasTursoConfig

console.log(`[drizzle-config] Using ${useLocalDb ? 'local SQLite' : 'Turso'} database`)

export default defineConfig({
  schema: './src/app/db/schema/schema.ts',
  out: './migrations',
  ...(useLocalDb
    ? {
        dialect: 'sqlite',
        dbCredentials: {
          url: './tmp/local.db'
        }
      }
    : {
        dialect: 'turso',
        dbCredentials: {
          url: process.env.TURSO_CONNECTION_URL!,
          authToken: process.env.TURSO_AUTH_TOKEN!
        }
      })
})
