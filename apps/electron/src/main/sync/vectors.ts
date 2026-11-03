import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { JsonValue } from './payload'
import type { MergeRecord } from './merge'
import type { RecordKind } from './protocol'

export interface VectorRecord {
  name: string
  kind: RecordKind
  recordId: string
  deviceId: string
  clientOpId: string
  deleted: boolean
  updatedAt: string
  fields: { [key: string]: JsonValue }
  plaintext: string
  aad: string
  nonceHex: string
  nonceBase64: string
  ciphertextBase64: string
}

export interface VectorChainOp {
  seq: number
  recordId: string
  deviceId: string
  clientOpId: string
  prevHash: string
  hash: string
  preimage: string
  ciphertextBase64: string
}

export interface VectorMergeCase {
  name: string
  localDeviceId: string
  orderIndependent: boolean
  start: MergeRecord | null
  incoming: MergeRecord[]
  expect: {
    title: string | null
    deleted: boolean
    updatedAt: string
    originSeq: number
    originDeviceId: string
    dirty: boolean
  }
}

export interface TestVectors {
  protocol: string
  passphrase: string
  wrongPassphrase: string
  kdf: { N: number; r: number; p: number; keyLen: number }
  saltBase64: string
  wrappingKeyBase64: string
  wrongPassphraseWrappingKeyBase64: string
  dataKeyBase64: string
  wrap: { aad: string; nonceBase64: string; wrappedKeyBase64: string }
  normalization: {
    composed: string
    decomposedCodePoints: number[]
    wrappingKeyBase64: string
  }
  records: VectorRecord[]
  chain: { genesis: string; ops: VectorChainOp[] }
  tampered: {
    recordId: string
    nonceBase64: string
    ciphertextBase64: string
    hash: string
  }
  wrongAad: { recordId: string }
  mergeCases: VectorMergeCase[]
}

export function loadTestVectors(): TestVectors {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'vectors', 'test-vectors.json')
  return JSON.parse(readFileSync(path, 'utf8')) as TestVectors
}
