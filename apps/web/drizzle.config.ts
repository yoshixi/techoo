import { defineConfig } from 'drizzle-kit';

// Use different configurations for development vs production
const isDevelopment = process.env.NODE_ENV !== 'production';
const hasTursoConfig = process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN;

const useLocalDB = isDevelopment || !hasTursoConfig;
console.log(`Drizzle Config: Using ${useLocalDB ? 'local SQLite' : 'Turso'} database`);

export default defineConfig({
  schema: './app/db/schema/schema.ts',
  out: './drizzle/migrations',

  // Use SQLite for local development, Turso for production
  ...(useLocalDB ? {
        // Local development - SQLite
        dialect: 'sqlite',
        dbCredentials: {
          url: './tmp/local.db'
        },
      }
    : {
        // Production - Turso
        dialect: 'turso',
        dbCredentials: {
          url: process.env.TURSO_CONNECTION_URL!,
          authToken: process.env.TURSO_AUTH_TOKEN!,
        },
      }
  ),
});