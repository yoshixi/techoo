import { SyncRequestError } from './errors'
import type { KdfParams } from './protocol'

export interface PutVaultBody {
  salt: string
  kdf: 'scrypt'
  kdfParams: KdfParams
  wrappedKey: string
  wrappedKeyNonce: string
}

export interface VaultDocument extends PutVaultBody {
  vaultId: string
  headSeq: number
  headHash: string
}

export interface SyncHeadDocument {
  vaultId: string
  headSeq: number
  headHash: string
}

export interface WireOpInput {
  clientOpId: string
  recordId: string
  deviceId: string
  nonce: string
  ciphertext: string
}

export interface WirePushedOp {
  clientOpId: string
  seq: number
  prevHash: string
}

export interface WireOp extends WireOpInput {
  seq: number
  prevHash: string
}

export interface SyncTransport {
  getVault(): Promise<VaultDocument | null>
  putVault(body: PutVaultBody): Promise<VaultDocument>
  resetVault(body: PutVaultBody): Promise<VaultDocument>
  getHead(): Promise<SyncHeadDocument>
  pushOps(body: { vaultId: string; ops: WireOpInput[] }): Promise<{ ops: WirePushedOp[] }>
  pullOps(query: {
    vaultId: string
    after: number
    limit: number
  }): Promise<{ ops: WireOp[]; headSeq: number }>
}

export interface FetchTransportOptions {
  /** Origin plus `/api`, for example `http://localhost:8787/api`. */
  apiBaseUrl: string
  getToken: () => string | null | Promise<string | null>
  fetchImpl?: typeof fetch
}

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null
}

async function errorFrom(response: Response): Promise<SyncRequestError> {
  let code: string | null = null
  let message = response.statusText || `HTTP ${response.status}`
  try {
    const body = (await response.json()) as unknown
    if (isRecord(body)) {
      if (typeof body.error === 'string' && body.error.length > 0) message = body.error
      if (typeof body.code === 'string') code = body.code
    }
  } catch {
    // The body was not JSON. The status text is enough.
  }
  return new SyncRequestError(response.status, code, message)
}

function requireString(body: { [key: string]: unknown }, key: string): string {
  const value = body[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new SyncRequestError(500, null, `sync response is missing ${key}`)
  }
  return value
}

function requireNumber(body: { [key: string]: unknown }, key: string): number {
  const value = body[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new SyncRequestError(500, null, `sync response is missing ${key}`)
  }
  return value
}

function parseKdf(value: unknown): KdfParams {
  if (!isRecord(value)) throw new SyncRequestError(500, null, 'kdf params are missing')
  const N = value.N
  const r = value.r
  const p = value.p
  if (typeof N !== 'number' || typeof r !== 'number' || typeof p !== 'number') {
    throw new SyncRequestError(500, null, 'kdf params are incomplete')
  }
  const keyLen = value.keyLen
  return {
    N,
    r,
    p,
    ...(typeof keyLen === 'number' ? { keyLen } : {})
  }
}

export function parseVaultDocument(value: unknown): VaultDocument {
  if (!isRecord(value)) throw new SyncRequestError(500, null, 'vault response was not an object')
  if (value.kdf !== 'scrypt') throw new SyncRequestError(500, null, 'vault kdf is not scrypt')
  return {
    vaultId: requireString(value, 'vaultId'),
    salt: requireString(value, 'salt'),
    kdf: 'scrypt',
    kdfParams: parseKdf(value.kdfParams),
    wrappedKey: requireString(value, 'wrappedKey'),
    wrappedKeyNonce: requireString(value, 'wrappedKeyNonce'),
    headSeq: requireNumber(value, 'headSeq'),
    headHash: requireString(value, 'headHash')
  }
}

function parseOp(value: unknown): WireOp {
  if (!isRecord(value)) throw new SyncRequestError(500, null, 'sync op was not an object')
  return {
    seq: requireNumber(value, 'seq'),
    clientOpId: requireString(value, 'clientOpId'),
    recordId: requireString(value, 'recordId'),
    deviceId: requireString(value, 'deviceId'),
    nonce: requireString(value, 'nonce'),
    ciphertext: requireString(value, 'ciphertext'),
    prevHash: requireString(value, 'prevHash')
  }
}

export function createFetchTransport(options: FetchTransportOptions): SyncTransport {
  const fetchImpl = options.fetchImpl ?? fetch
  const root = options.apiBaseUrl.replace(/\/$/, '')

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = await options.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    try {
      return await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'network request failed'
      throw new SyncRequestError(0, 'offline', message)
    }
  }

  return {
    async getVault(): Promise<VaultDocument | null> {
      const response = await send('GET', '/v1/vault')
      if (response.status === 404) return null
      if (!response.ok) throw await errorFrom(response)
      return parseVaultDocument(await response.json())
    },
    async putVault(body: PutVaultBody): Promise<VaultDocument> {
      const response = await send('PUT', '/v1/vault', body)
      if (!response.ok) throw await errorFrom(response)
      return parseVaultDocument(await response.json())
    },
    async resetVault(body: PutVaultBody): Promise<VaultDocument> {
      const response = await send('POST', '/v1/vault/reset', body)
      if (!response.ok) throw await errorFrom(response)
      return parseVaultDocument(await response.json())
    },
    async getHead(): Promise<SyncHeadDocument> {
      const response = await send('GET', '/v1/sync')
      if (!response.ok) throw await errorFrom(response)
      const body = (await response.json()) as unknown
      if (!isRecord(body)) throw new SyncRequestError(500, null, 'sync head was not an object')
      return {
        vaultId: requireString(body, 'vaultId'),
        headSeq: requireNumber(body, 'headSeq'),
        headHash: requireString(body, 'headHash')
      }
    },
    async pushOps(body): Promise<{ ops: WirePushedOp[] }> {
      const response = await send('POST', '/v1/sync/ops', body)
      if (!response.ok) throw await errorFrom(response)
      const parsed = (await response.json()) as unknown
      if (!isRecord(parsed) || !Array.isArray(parsed.ops)) {
        throw new SyncRequestError(500, null, 'push response was missing ops')
      }
      return {
        ops: parsed.ops.map((entry) => {
          if (!isRecord(entry)) throw new SyncRequestError(500, null, 'pushed op was not an object')
          return {
            clientOpId: requireString(entry, 'clientOpId'),
            seq: requireNumber(entry, 'seq'),
            prevHash: requireString(entry, 'prevHash')
          }
        })
      }
    },
    async pullOps(query): Promise<{ ops: WireOp[]; headSeq: number }> {
      const params = new URLSearchParams({
        vaultId: query.vaultId,
        after: String(query.after),
        limit: String(query.limit)
      })
      const response = await send('GET', `/v1/sync/ops?${params.toString()}`)
      if (!response.ok) throw await errorFrom(response)
      const parsed = (await response.json()) as unknown
      if (!isRecord(parsed) || !Array.isArray(parsed.ops)) {
        throw new SyncRequestError(500, null, 'pull response was missing ops')
      }
      return {
        ops: parsed.ops.map(parseOp),
        headSeq: requireNumber(parsed, 'headSeq')
      }
    }
  }
}
