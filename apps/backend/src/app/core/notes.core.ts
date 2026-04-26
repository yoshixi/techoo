import { z } from '@hono/zod-openapi'
import { IdSchema, Rfc3339Schema } from './common.core'

export const NoteModel = z.object({
  id: IdSchema,
  title: z.string().openapi({ example: 'Quick idea about auth flow' }),
  body: z.string().nullable().openapi({ description: 'Full Markdown content' }),
  pinned: z.number().int().min(0).max(1).openapi({ description: '1 = pinned to top' }),
  created_at: Rfc3339Schema,
  updated_at: Rfc3339Schema,
}).openapi('Note')

export const CreateNoteModel = z.object({
  title: z.string().min(1).max(200).openapi({ example: 'Meeting notes' }),
  body: z.string().optional(),
}).openapi('CreateNote')

export const UpdateNoteModel = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().nullable().optional(),
  pinned: z.number().int().min(0).max(1).optional(),
}).openapi('UpdateNote')

export const NoteIdParamModel = z.object({
  id: IdSchema.openapi({ param: { name: 'id', in: 'path' } }),
}).openapi('NoteIdParam')

export const NoteQueryParamsModel = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().openapi({
    description: 'Max notes to return (default 100, max 500)',
  }),
  offset: z.coerce.number().int().min(0).optional().openapi({
    description: 'Skip this many notes (same order: pinned first, then updated_at desc)',
  }),
}).openapi('NoteQueryParams')

export const NoteListResponseModel = z.object({
  data: z.array(NoteModel),
  has_more: z.boolean().optional(),
}).openapi('NoteListResponse')

export const NoteResponseModel = z.object({
  data: NoteModel,
}).openapi('NoteResponse')

export type Note = z.infer<typeof NoteModel>
export type CreateNote = z.infer<typeof CreateNoteModel>
export type UpdateNote = z.infer<typeof UpdateNoteModel>
