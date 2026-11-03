import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseModel } from '../../../core/common.core'
import {
  PullSyncOpsQueryModel,
  PullSyncOpsResponseModel,
  PushSyncOpsModel,
  PushSyncOpsResponseModel,
  SyncHeadResponseModel,
} from '../../../core/sync.core'

export const getSyncHeadRoute = createRoute({
  method: 'get',
  path: '/v1/sync',
  summary: 'Read the sync log head',
  description: 'Returns the active vault id and the hash chain head. Clients compare this with their cursor before pulling.',
  responses: {
    200: { content: { 'application/json': { schema: SyncHeadResponseModel } }, description: 'Sync head' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'No active vault' },
    503: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Sync storage is not configured' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const pushSyncOpsRoute = createRoute({
  method: 'post',
  path: '/v1/sync/ops',
  summary: 'Append encrypted sync ops',
  description: 'Stores ciphertext snapshots. A repeated clientOpId returns the sequence already assigned. The server does not decrypt the payload.',
  request: {
    body: { content: { 'application/json': { schema: PushSyncOpsModel } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: PushSyncOpsResponseModel } }, description: 'Ops appended or already stored' },
    400: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Bad request' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'No active vault' },
    409: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'vaultId is not the active vault' },
    503: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Sync storage is not configured or the append lost a race' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const pullSyncOpsRoute = createRoute({
  method: 'get',
  path: '/v1/sync/ops',
  summary: 'Pull encrypted sync ops',
  description: 'Returns ciphertext ops with seq greater than `after`, in order.',
  request: { query: PullSyncOpsQueryModel },
  responses: {
    200: { content: { 'application/json': { schema: PullSyncOpsResponseModel } }, description: 'Ops after the cursor' },
    400: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Bad request' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'No active vault' },
    409: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'vaultId is not the active vault' },
    503: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Sync storage is not configured' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})
