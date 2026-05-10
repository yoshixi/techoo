import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const candidates = [
  path.resolve(__dirname, '../node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.mjs'),
  path.resolve(__dirname, '../../../node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.mjs'),
]

for (const target of candidates) {
  if (!fs.existsSync(target)) continue

  const source = fs.readFileSync(target, 'utf8')
  if (!source.includes('z.ostring()')) continue

  const patched = source.replaceAll('z.ostring()', 'z.string().optional()')
  if (patched !== source) {
    fs.writeFileSync(target, patched)
  }
}
