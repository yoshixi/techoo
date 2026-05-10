import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('Worker Runtime Smoke Test', () => {
  it('serves the health endpoint through the Worker entrypoint', async () => {
    const response = await SELF.fetch('http://example.com/api/health')

    expect(response.status).toBe(200)

    const data = await response.json() as { status: string; message: string }
    expect(data.status).toBe('ok')
    expect(data.message).toBe('Techo API is running')
  })
})
