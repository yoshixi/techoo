import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseModel } from '../../../core/common.core'
import { PutVaultModel, VaultResponseModel } from '../../../core/sync.core'

export const putVaultRoute = createRoute({
  method: 'put',
  path: '/v1/vault',
  summary: 'Create the encrypted sync vault',
  description: 'Stores the wrapped data key for this account. The passphrase never reaches the server. Fails when an active vault already exists.',
  request: {
    body: { content: { 'application/json': { schema: PutVaultModel } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: VaultResponseModel } }, description: 'Vault created' },
    400: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Bad request' },
    409: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'An active vault already exists' },
    503: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Sync storage is not configured' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const getVaultRoute = createRoute({
  method: 'get',
  path: '/v1/vault',
  summary: 'Read the encrypted sync vault',
  description: 'Returns the wrapped data key and the current sync head. The server cannot unwrap the key.',
  responses: {
    200: { content: { 'application/json': { schema: VaultResponseModel } }, description: 'Active vault' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'No active vault' },
    503: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Sync storage is not configured' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const resetVaultRoute = createRoute({
  method: 'post',
  path: '/v1/vault/reset',
  summary: 'Replace the encrypted sync vault',
  description: 'Retires the active vault, deletes its ciphertext log, and stores a new wrapped key. Devices that still hold the old vault id must join this vault.',
  request: {
    body: { content: { 'application/json': { schema: PutVaultModel } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: VaultResponseModel } }, description: 'New vault created' },
    400: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Bad request' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'No active vault' },
    409: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'The active vault changed while resetting' },
    503: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Sync storage is not configured' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})
