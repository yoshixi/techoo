import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const distDir = join(root, 'dist')

const FATAL_PATTERNS = [
  {
    pattern: '[unenv] https.request is not implemented yet!',
    reason: 'Node HTTPS transport will crash in Cloudflare Workers.',
  },
  {
    pattern: '[unenv] fs.write is not implemented yet!',
    reason: 'Node fs.write will crash in Cloudflare Workers.',
  },
]

const WARNING_PATTERNS = [
  {
    pattern: 'https.request',
    reason: 'Suspicious Node HTTPS API reference found in Worker bundle.',
  },
  {
    pattern: 'fs.write',
    reason: 'Suspicious Node fs API reference found in Worker bundle.',
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

function scan(files, checks) {
  const matches = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')

    for (const { pattern, reason } of checks) {
      if (!source.includes(pattern)) continue
      matches.push({
        file: relative(root, file),
        pattern,
        reason,
      })
    }
  }

  return matches
}

function printMatches(header, matches) {
  console.error(`${header}\n`)
  for (const match of matches) {
    console.error(`- ${match.file}`)
    console.error(`  pattern: ${match.pattern}`)
    console.error(`  reason: ${match.reason}`)
  }
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

  const fatalMatches = scan(files, FATAL_PATTERNS)
  if (fatalMatches.length > 0) {
    printMatches('Fatal Cloudflare Worker compatibility markers found in backend bundle:', fatalMatches)
    process.exit(1)
  }

  const warningMatches = scan(files, WARNING_PATTERNS)
  if (warningMatches.length > 0) {
    printMatches('Warning: suspicious Node interface references found in backend bundle:', warningMatches)
    console.error('\nThese may be dormant code paths, but they should be reviewed before deployment.')
    return
  }

  console.log(`Worker compatibility audit passed (${files.length} JS asset${files.length === 1 ? '' : 's'} scanned).`)
}

main()
