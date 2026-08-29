import { access, chmod, readdir, readlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'node_modules/.bin')

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function fixBinPermissions() {
  let names
  try {
    names = await readdir(binDir)
  } catch {
    return
  }

  for (const name of names) {
    const linkPath = join(binDir, name)
    let target
    try {
      target = await readlink(linkPath)
    } catch {
      continue
    }

    const resolved = join(binDir, target)
    if (!resolved.endsWith('.js') || (await isExecutable(resolved))) {
      continue
    }

    await chmod(resolved, 0o755)
  }
}

await fixBinPermissions()
