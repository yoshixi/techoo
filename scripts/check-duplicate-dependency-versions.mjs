/**
 * Fail if pnpm-lock.yaml lists more than one resolved semver for a watched package
 * under `packages:` (duplicate installs). Run from repo root, e.g.:
 *   nix develop --command pnpm run check:dup-deps
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Edit this list when another native / bundler-sensitive dep must stay single-version. */
const WATCH_PACKAGES = ['@libsql/client']

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractPackagesBlock(lockText) {
  const needle = '\npackages:\n'
  const start = lockText.indexOf(needle)
  if (start === -1) {
    throw new Error('pnpm-lock.yaml: missing packages: section')
  }
  const from = start + needle.length
  const tail = lockText.slice(from)
  const snap = tail.indexOf('\nsnapshots:\n')
  const end = snap === -1 ? tail.length : snap
  return tail.slice(0, end)
}

function resolvedSemversInPackagesBlock(packagesBlock, packageName) {
  const re = new RegExp(`^  ['"]${escapeRe(packageName)}@([^'"(]+)`, 'gm')
  const versions = new Set()
  let match
  while ((match = re.exec(packagesBlock)) !== null) {
    versions.add(match[1].trim())
  }
  return [...versions].sort()
}

function main() {
  const lockPath = join(root, 'pnpm-lock.yaml')
  const lockText = readFileSync(lockPath, 'utf8')
  const packagesBlock = extractPackagesBlock(lockText)

  const failures = []
  for (const name of WATCH_PACKAGES) {
    const versions = resolvedSemversInPackagesBlock(packagesBlock, name)
    if (versions.length === 0) {
      failures.push(`${name}: not found in lockfile packages: (typo or not installed?)`)
    } else if (versions.length > 1) {
      failures.push(`${name}: multiple resolved versions in pnpm-lock.yaml — ${versions.join(', ')}`)
    }
  }

  if (failures.length) {
    console.error('Duplicate or missing watched dependencies:\n')
    for (const line of failures) console.error(`  - ${line}`)
    console.error(
      '\nAlign declared ranges (e.g. match tenanso’s @libsql/client) and run `pnpm install` from the repo root.'
    )
    process.exit(1)
  }

  for (const name of WATCH_PACKAGES) {
    const versions = resolvedSemversInPackagesBlock(packagesBlock, name)
    console.log(`${name}: single resolved version ${versions[0]} (ok)`)
  }
}

main()
