import { z } from '@hono/zod-openapi'

// Watch channel model (for database records)
export const WatchChannelModel = z
  .object({
    id: z.string(),
    calendarId: z.string(),
    channelId: z.string(),
    resourceId: z.string(),
    providerType: z.string(),
    expiresAt: z.iso.datetime(),
    token: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .openapi('WatchChannel')

// Response model for watch channel creation
export const WatchChannelResponseModel = z
  .object({
    watchChannel: WatchChannelModel
  })
  .openapi('WatchChannelResponse')

// Response model for watch channel status
export const WatchChannelStatusModel = z
  .object({
    isWatching: z.boolean(),
    watchChannel: WatchChannelModel.nullable(),
    expiresIn: z.number().nullable().describe('Seconds until expiration')
  })
  .openapi('WatchChannelStatus')

// Response model for stopping watch
export const StopWatchResponseModel = z
  .object({
    success: z.boolean(),
    message: z.string()
  })
  .openapi('StopWatchResponse')

export type WatchChannel = z.infer<typeof WatchChannelModel>
