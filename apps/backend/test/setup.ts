import { vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import fs from 'fs'

beforeAll(() => {
  const tmpDir = './tmp/dbtests'
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true })
  }
})

const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  vi.clearAllMocks()
})

vi.setConfig({ testTimeout: 30000 })

afterAll(() => {
  const tmpDir = './tmp/dbtests'
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
