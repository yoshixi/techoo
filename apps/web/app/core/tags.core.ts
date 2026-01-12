import { z } from '@hono/zod-openapi'
import { UUIDSchema } from './common.core'

// Base tag model
export const TagModel = z.object({
  id: UUIDSchema.openapi({
    description: 'Unique identifier for the tag'
  }),
  name: z.string().min(1).max(50).openapi({
    description: 'Name of the tag',
    example: 'urgent'
  }),
  createdAt: z.iso.datetime().openapi({
    description: 'Timestamp when the tag was created',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.iso.datetime().openapi({
    description: 'Timestamp when the tag was last updated',
    example: '2024-01-01T15:30:00.000Z'
  })
}).openapi('Tag')

// Create tag input model
export const CreateTagModel = z.object({
  name: z.string().min(1, 'Tag name is required').max(50).openapi({
    description: 'Name of the tag',
    example: 'urgent'
  })
}).openapi('CreateTag')

// Update tag input model
export const UpdateTagModel = z.object({
  name: z.string().min(1).max(50).optional().openapi({
    description: 'Name of the tag',
    example: 'high-priority'
  })
}).openapi('UpdateTag')

// Tag list response model
export const TagListResponseModel = z.object({
  tags: z.array(TagModel).openapi({
    description: 'List of tags'
  }),
  total: z.number().int().min(0).openapi({
    description: 'Total number of tags',
    example: 5
  })
}).openapi('TagListResponse')

// Single tag response model
export const TagResponseModel = z.object({
  tag: TagModel
}).openapi('TagResponse')

// Path parameter models
export const TagIdParamModel = z.object({
  id: UUIDSchema.openapi({
    description: 'Tag ID',
    param: {
      name: 'id',
      in: 'path'
    }
  })
}).openapi('TagIdParam')

// Export types
export type Tag = z.infer<typeof TagModel>
export type CreateTag = z.infer<typeof CreateTagModel>
export type UpdateTag = z.infer<typeof UpdateTagModel>
export type TagListResponse = z.infer<typeof TagListResponseModel>
export type TagResponse = z.infer<typeof TagResponseModel>
export type TagIdParam = z.infer<typeof TagIdParamModel>
