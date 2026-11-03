export type PullFault =
  | 'limit-1'
  | 'reverse'
  | 'drop-first'
  | 'tamper-ciphertext'
  | 'tamper-prev-hash'
  | 'tamper-head'
  | 'pretend-caught-up'

const GENESIS_HASH = '0'.repeat(64)

export interface PushedBatch {
  vaultId: string
  ops: Array<{
    clientOpId: string
    recordId: string
    deviceId: string
    nonce: string
    ciphertext: string
  }>
}

interface WireOp {
  seq: number
  clientOpId: string
  recordId: string
  deviceId: string
  nonce: string
  ciphertext: string
  prevHash: string
}

/** Per-device faults applied to that device's fetch, in front of the real worker. */
export class Faults {
  offline = false
  dropPushAcks = 0
  pull: PullFault | null = null
  /** Cursor a `pretend-caught-up` fault reports, so a retry pushes before it pulls. */
  caughtUpSeq = 0
  caughtUpHash = GENESIS_HASH
  pushes: PushedBatch[] = []
  pullCount = 0
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function flipBase64(value: string): string {
  const chars = value.split('')
  const index = chars.findIndex((char) => char !== '=')
  if (index < 0) return value
  const current = chars[index]
  chars[index] = current === 'A' ? 'B' : 'A'
  return chars.join('')
}

function mutateOps(ops: WireOp[], fault: PullFault): WireOp[] {
  if (fault === 'limit-1') return ops.slice(0, 1)
  if (fault === 'reverse') return [...ops].reverse()
  if (fault === 'drop-first') return ops.slice(1)
  if (fault === 'tamper-ciphertext') {
    return ops.map((op, index) =>
      index === ops.length - 1 ? { ...op, ciphertext: flipBase64(op.ciphertext) } : op,
    )
  }
  if (fault === 'tamper-prev-hash') {
    return ops.map((op, index) =>
      index === 0 ? { ...op, prevHash: 'ab'.repeat(32) } : op,
    )
  }
  return ops
}

/**
 * Fetch wrapper that can drop a push acknowledgement, page one op at a time,
 * reorder a pull, or rewrite ciphertext, prevHash, or headHash.
 * The worker itself is left unchanged.
 */
export function createFaultingFetch(faults: Faults): typeof fetch {
  return async (input, init) => {
    if (faults.offline) throw new TypeError('network request failed')
    const url = requestUrl(input)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (method === 'POST' && url.includes('/v1/sync/ops')) {
      if (typeof init?.body === 'string') faults.pushes.push(JSON.parse(init.body) as PushedBatch)
      const response = await fetch(input, init)
      if (faults.dropPushAcks > 0 && response.ok) {
        faults.dropPushAcks -= 1
        await response.arrayBuffer()
        throw new TypeError('network request failed')
      }
      return response
    }

    const response = await fetch(input, init)
    if (!response.ok || !faults.pull) return response

    if (faults.pull === 'pretend-caught-up') {
      if (method === 'GET' && url.includes('/v1/sync/ops')) {
        return Response.json({ ops: [], headSeq: faults.caughtUpSeq }, { status: response.status })
      }
      if (method === 'GET' && /\/v1\/sync(\?|$)/.test(url)) {
        const json = (await response.json()) as { vaultId?: string }
        return Response.json(
          { ...json, headSeq: faults.caughtUpSeq, headHash: faults.caughtUpHash },
          { status: response.status },
        )
      }
    }

    if (method === 'GET' && url.includes('/v1/sync/ops') && faults.pull !== 'tamper-head') {
      faults.pullCount += 1
      const json = (await response.json()) as { ops: WireOp[]; headSeq: number }
      return Response.json({ ...json, ops: mutateOps(json.ops, faults.pull) }, { status: response.status })
    }

    if (method === 'GET' && /\/v1\/sync(\?|$)/.test(url) && faults.pull === 'tamper-head') {
      const json = (await response.json()) as { headHash?: string }
      return Response.json({ ...json, headHash: 'f'.repeat(64) }, { status: response.status })
    }

    return response
  }
}
