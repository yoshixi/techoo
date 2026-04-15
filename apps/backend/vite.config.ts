import { createRequire } from 'node:module'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import ssrPlugin from 'vite-ssr-components/plugin'

const require = createRequire(import.meta.url)

/**
 * Default `pino` resolves to the Node build (SonicBoom → fs.write). That throws
 * `[unenv] fs.write is not implemented yet!` on Cloudflare Workers. Alias to
 * `pino/browser` (console-only) so source can stay `import pino from 'pino'` like main.
 *
 * Default `@libsql/client` resolves to the Node HTTP stack (`https.request`), which
 * throws `[unenv] https.request is not implemented yet!` on Workers. The `web` build
 * uses fetch (tenanso, drizzle, main-db). Scripts and Vitest resolve `@libsql/client`
 * normally via Node and are unaffected by this Vite bundle alias.
 */
export default defineConfig({
  plugins: [cloudflare(), ssrPlugin()],
  resolve: {
    alias: {
      pino: require.resolve('pino/browser'),
      '@libsql/client': require.resolve('@libsql/client/web'),
    },
  },
})
