/**
 * Regenerates vectors/test-vectors.json from the sync implementation.
 * Run from the repo root:
 *   pnpm --filter electron exec vite-node src/main/sync/vectors/generate.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  chainHash,
  chainPreimage,
  deriveWrappingKey,
  sealRecord,
  toBase64,
  wrapDataKey
} from '../crypto'
import { encodePayload, type JsonValue } from '../payload'
import { GENESIS_HASH, WRAP_AAD, recordAad, type RecordKind } from '../protocol'

const passphrase = 'correct horse battery staple'
const wrongPassphrase = 'wrong passphrase'
const kdf = { N: 16384, r: 8, p: 1, keyLen: 32 }
const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
const dataKey = Buffer.from(
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  'hex'
)
const wrapNonce = Buffer.from('c0c1c2c3c4c5c6c7c8c9cacb', 'hex')

const deviceA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const deviceB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const noteId = '11111111-1111-4111-8111-111111111111'
const todoId = '22222222-2222-4222-8222-222222222222'
const mergeId = '33333333-3333-4333-8333-333333333333'

interface Sample {
  name: string
  kind: RecordKind
  recordId: string
  deviceId: string
  clientOpId: string
  deleted: boolean
  updatedAt: string
  fields: { [key: string]: JsonValue }
  nonce: Buffer
}

const samples: Sample[] = [
  {
    name: 'note',
    kind: 'note',
    recordId: noteId,
    deviceId: deviceA,
    clientOpId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    deleted: false,
    updatedAt: '2026-11-03T03:00:00.000Z',
    fields: {
      body: 'Buy milk',
      createdAt: '2026-11-03T03:00:00.000Z',
      pinned: false,
      title: 'Milk'
    },
    nonce: Buffer.from('d0d1d2d3d4d5d6d7d8d9dadb', 'hex')
  },
  {
    name: 'todo',
    kind: 'todo',
    recordId: todoId,
    deviceId: deviceA,
    clientOpId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    deleted: false,
    updatedAt: '2026-11-03T03:05:00.000Z',
    fields: {
      createdAt: '2026-11-03T03:05:00.000Z',
      done: false,
      isAllDay: false,
      title: 'Walk'
    },
    nonce: Buffer.from('e0e1e2e3e4e5e6e7e8e9eaeb', 'hex')
  },
  {
    name: 'note-tombstone',
    kind: 'note',
    recordId: noteId,
    deviceId: deviceB,
    clientOpId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    deleted: true,
    updatedAt: '2026-11-03T04:00:00.000Z',
    fields: {},
    nonce: Buffer.from('f0f1f2f3f4f5f6f7f8f9fafb', 'hex')
  }
]

function noteFields(title: string): { [key: string]: JsonValue } {
  return {
    body: title,
    createdAt: '2026-11-03T03:00:00.000Z',
    pinned: false,
    title
  }
}

function record(input: {
  updatedAt: string
  deviceId: string
  seq: number
  dirty: boolean
  deleted: boolean
  title: string
}): {
  recordId: string
  kind: 'note'
  deleted: boolean
  updatedAt: string
  originSeq: number
  originDeviceId: string
  dirty: boolean
  fields: { [key: string]: JsonValue }
} {
  return {
    recordId: mergeId,
    kind: 'note',
    deleted: input.deleted,
    updatedAt: input.updatedAt,
    originSeq: input.seq,
    originDeviceId: input.deviceId,
    dirty: input.dirty,
    fields: input.deleted ? {} : noteFields(input.title)
  }
}

function build(): unknown {
  const wrappingKey = deriveWrappingKey(passphrase, salt, kdf)
  const wrongWrappingKey = deriveWrappingKey(wrongPassphrase, salt, kdf)
  const composed = 'caf\u00e9'
  const normalizationKey = deriveWrappingKey(composed, salt, kdf)
  const wrapped = wrapDataKey(wrappingKey, dataKey, wrapNonce)

  const sealed = samples.map((sample) => {
    const plaintext = encodePayload({
      v: 1,
      kind: sample.kind,
      recordId: sample.recordId,
      deleted: sample.deleted,
      updatedAt: sample.updatedAt,
      fields: sample.fields
    })
    const ciphertext = sealRecord(dataKey, sample.recordId, plaintext, sample.nonce)
    return {
      ...sample,
      plaintext,
      aad: recordAad(sample.recordId),
      ciphertext
    }
  })

  let prevHash = GENESIS_HASH
  const chainOps = sealed.map((sample, index) => {
    const seq = index + 1
    const ciphertext = toBase64(sample.ciphertext)
    const preimage = chainPreimage(prevHash, seq, sample.recordId, ciphertext)
    const hash = chainHash(prevHash, seq, sample.recordId, ciphertext)
    const op = {
      seq,
      recordId: sample.recordId,
      deviceId: sample.deviceId,
      clientOpId: sample.clientOpId,
      prevHash,
      hash,
      preimage,
      ciphertextBase64: ciphertext
    }
    prevHash = hash
    return op
  })

  const tampered = Buffer.from(sealed[0].ciphertext)
  tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0x01
  const tamperedCiphertext = toBase64(tampered)
  const tamperedHash = chainHash(GENESIS_HASH, 1, sealed[0].recordId, tamperedCiphertext)

  const at = '2026-11-03T03:00:00.000Z'
  const later = '2026-11-03T03:05:00.000Z'

  return {
    protocol: 'techoo-e2ee-sync-v1',
    passphrase,
    wrongPassphrase,
    kdf,
    saltHex: salt.toString('hex'),
    saltBase64: toBase64(salt),
    wrappingKeyBase64: toBase64(wrappingKey),
    wrongPassphraseWrappingKeyBase64: toBase64(wrongWrappingKey),
    dataKeyHex: dataKey.toString('hex'),
    dataKeyBase64: toBase64(dataKey),
    wrap: {
      aad: WRAP_AAD,
      nonceHex: wrapNonce.toString('hex'),
      nonceBase64: toBase64(wrapNonce),
      wrappedKeyBase64: toBase64(wrapped)
    },
    normalization: {
      composed,
      decomposedCodePoints: [0x63, 0x61, 0x66, 0x65, 0x0301],
      wrappingKeyBase64: toBase64(normalizationKey)
    },
    records: sealed.map((sample) => ({
      name: sample.name,
      kind: sample.kind,
      recordId: sample.recordId,
      deviceId: sample.deviceId,
      clientOpId: sample.clientOpId,
      deleted: sample.deleted,
      updatedAt: sample.updatedAt,
      fields: sample.fields,
      plaintext: sample.plaintext,
      aad: sample.aad,
      nonceHex: sample.nonce.toString('hex'),
      nonceBase64: toBase64(sample.nonce),
      ciphertextBase64: toBase64(sample.ciphertext)
    })),
    chain: {
      genesis: GENESIS_HASH,
      ops: chainOps
    },
    tampered: {
      recordId: sealed[0].recordId,
      nonceBase64: toBase64(sealed[0].nonce),
      ciphertextBase64: tamperedCiphertext,
      hash: tamperedHash,
      breaksPrevHashOfSeq: 2
    },
    wrongAad: {
      recordId: 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    },
    mergeCases: [
      {
        name: 'newer-updatedAt-wins',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: at,
          deviceId: deviceA,
          seq: 1,
          dirty: false,
          deleted: false,
          title: 'A'
        }),
        incoming: [
          record({
            updatedAt: later,
            deviceId: deviceB,
            seq: 2,
            dirty: false,
            deleted: false,
            title: 'B'
          })
        ],
        expect: {
          title: 'B',
          deleted: false,
          updatedAt: later,
          originSeq: 2,
          originDeviceId: deviceB,
          dirty: false
        }
      },
      {
        name: 'older-updatedAt-loses',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: later,
          deviceId: deviceA,
          seq: 2,
          dirty: false,
          deleted: false,
          title: 'B'
        }),
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceB,
            seq: 4,
            dirty: false,
            deleted: false,
            title: 'A'
          })
        ],
        expect: {
          title: 'B',
          deleted: false,
          updatedAt: later,
          originSeq: 2,
          originDeviceId: deviceA,
          dirty: false
        }
      },
      {
        name: 'deviceId-tiebreak',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: at,
          deviceId: deviceA,
          seq: 9,
          dirty: false,
          deleted: false,
          title: 'A'
        }),
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceB,
            seq: 1,
            dirty: false,
            deleted: false,
            title: 'B'
          })
        ],
        expect: {
          title: 'B',
          deleted: false,
          updatedAt: at,
          originSeq: 1,
          originDeviceId: deviceB,
          dirty: false
        }
      },
      {
        name: 'seq-tiebreak',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: at,
          deviceId: deviceA,
          seq: 1,
          dirty: false,
          deleted: false,
          title: 'A'
        }),
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceA,
            seq: 2,
            dirty: false,
            deleted: false,
            title: 'B'
          })
        ],
        expect: {
          title: 'B',
          deleted: false,
          updatedAt: at,
          originSeq: 2,
          originDeviceId: deviceA,
          dirty: false
        }
      },
      {
        name: 'total-tie-keeps-stored',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: at,
          deviceId: deviceA,
          seq: 2,
          dirty: false,
          deleted: false,
          title: 'stored'
        }),
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceA,
            seq: 2,
            dirty: false,
            deleted: false,
            title: 'replay'
          })
        ],
        expect: {
          title: 'stored',
          deleted: false,
          updatedAt: at,
          originSeq: 2,
          originDeviceId: deviceA,
          dirty: false
        }
      },
      {
        name: 'newer-tombstone-deletes',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: at,
          deviceId: deviceA,
          seq: 1,
          dirty: false,
          deleted: false,
          title: 'A'
        }),
        incoming: [
          record({
            updatedAt: later,
            deviceId: deviceB,
            seq: 2,
            dirty: false,
            deleted: true,
            title: ''
          })
        ],
        expect: {
          title: null,
          deleted: true,
          updatedAt: later,
          originSeq: 2,
          originDeviceId: deviceB,
          dirty: false
        }
      },
      {
        name: 'older-tombstone-does-not-delete',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: later,
          deviceId: deviceA,
          seq: 3,
          dirty: false,
          deleted: false,
          title: 'kept'
        }),
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceB,
            seq: 4,
            dirty: false,
            deleted: true,
            title: ''
          })
        ],
        expect: {
          title: 'kept',
          deleted: false,
          updatedAt: later,
          originSeq: 3,
          originDeviceId: deviceA,
          dirty: false
        }
      },
      {
        name: 'out-of-order-pulls-converge',
        localDeviceId: deviceA,
        orderIndependent: true,
        start: null,
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceA,
            seq: 1,
            dirty: false,
            deleted: false,
            title: 'older'
          }),
          record({
            updatedAt: later,
            deviceId: deviceB,
            seq: 2,
            dirty: false,
            deleted: false,
            title: 'newer'
          })
        ],
        expect: {
          title: 'newer',
          deleted: false,
          updatedAt: later,
          originSeq: 2,
          originDeviceId: deviceB,
          dirty: false
        }
      },
      {
        name: 'idempotent-replay',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: null,
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceA,
            seq: 1,
            dirty: false,
            deleted: false,
            title: 'once'
          }),
          record({
            updatedAt: at,
            deviceId: deviceA,
            seq: 1,
            dirty: false,
            deleted: false,
            title: 'once'
          })
        ],
        expect: {
          title: 'once',
          deleted: false,
          updatedAt: at,
          originSeq: 1,
          originDeviceId: deviceA,
          dirty: false
        }
      },
      {
        name: 'synced-replay-beats-unpushed-same-timestamp',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: at,
          deviceId: deviceA,
          seq: 0,
          dirty: true,
          deleted: false,
          title: 'local'
        }),
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceA,
            seq: 4,
            dirty: false,
            deleted: false,
            title: 'synced'
          })
        ],
        expect: {
          title: 'synced',
          deleted: false,
          updatedAt: at,
          originSeq: 4,
          originDeviceId: deviceA,
          dirty: false
        }
      },
      {
        name: 'newer-unpushed-local-wins',
        localDeviceId: deviceA,
        orderIndependent: false,
        start: record({
          updatedAt: later,
          deviceId: deviceA,
          seq: 0,
          dirty: true,
          deleted: false,
          title: 'local'
        }),
        incoming: [
          record({
            updatedAt: at,
            deviceId: deviceB,
            seq: 5,
            dirty: false,
            deleted: false,
            title: 'remote'
          })
        ],
        expect: {
          title: 'local',
          deleted: false,
          updatedAt: later,
          originSeq: 0,
          originDeviceId: deviceA,
          dirty: true
        }
      }
    ]
  }
}

const target = join(dirname(fileURLToPath(import.meta.url)), 'test-vectors.json')
writeFileSync(target, `${JSON.stringify(build(), null, 2)}\n`)
console.log(target)
