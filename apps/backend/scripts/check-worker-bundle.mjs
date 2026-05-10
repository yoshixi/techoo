import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const distDir = join(root, 'dist')

const BLOCKED_PATTERNS = [
  {
    pattern: '[unenv] https.request is not implemented yet!',
    reason: 'Worker bundle still contains the Node HTTPS transport path.',
  },
  {
    pattern: 'https.request',
    reason: 'Worker bundle still references Node https.request.',
  },
]

function listFiles(dir) {
  const entries = readdirSync(dir)
  const files = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      files.push(...listFiles(fullPath))
      continue
    }

    files.push(fullPath)
  }

  return files
}

function main() {
  let files
  try {
    files = listFiles(distDir).filter((file) => file.endsWith('.js'))
  } catch (error) {
    console.error(`Missing build output at ${distDir}. Run the backend production build first.`)
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  if (files.length === 0) {
    console.error(`No JavaScript assets found under ${distDir}.`)
    process.exit(1)
  }

  const violations = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')

    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (!source.includes(pattern)) continue
      violations.push({
        file: relative(root, file),
        pattern,
        reason,
      })
    }
  }

  if (violations.length > 0) {
    console.error('Blocked Node runtime markers found in the backend Worker bundle:\n')
    for (const violation of violations) {
      console.error(`- ${violation.file}`)
      console.error(`  pattern: ${violation.pattern}`)
      console.error(`  reason: ${violation.reason}`)
    }
    console.error(
      '\nThis usually means @libsql/client resolved to a Node build instead of the Worker-safe web/fetch build.'
    )
    process.exit(1)
  }

  console.log(`Worker bundle check passed (${files.length} JS asset${files.length === 1 ? '' : 's'} scanned).`)
}

main()
