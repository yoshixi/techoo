import { defineConfig } from 'drizzle-kit';

// Production configuration
// Uses migrations for proper schema versioning and history
if (!process.env.TURSO_CONNECTION_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN must be set for production config');
}

console.log(`database URL: ${process.env.TURSO_CONNECTION_URL}`)

export default defineConfig({
  schema: './app/db/schema/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
