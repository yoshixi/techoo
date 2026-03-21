import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })

const seedDbUrl = process.env.TURSO_SEED_DB_URL
const groupAuthToken = process.env.TURSO_GROUP_AUTH_TOKEN

if (!seedDbUrl || !groupAuthToken) {
  throw new Error('TURSO_SEED_DB_URL and TURSO_GROUP_AUTH_TOKEN are required for seed DB config')
}

console.log(`[drizzle-config-seed] Using seed database: ${seedDbUrl}`)

export default defineConfig({
  schema: './src/app/db/schema/schema.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: seedDbUrl,
    authToken: groupAuthToken,
  },
})
