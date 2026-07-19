import { z } from '@hono/zod-openapi'
import { IdSchema } from './common.core'

export const PostListModel = z.object({
  id: IdSchema,
  name: z.string(),
  created_at: z.number().int(),
}).openapi('PostList')

export const CreatePostListModel = z.object({
  name: z.string().min(1).max(100),
}).openapi('CreatePostList')

export const PostListIdParamModel = z.object({
  id: IdSchema.openapi({ param: { name: 'id', in: 'path' } }),
}).openapi('PostListIdParam')

export const PostListItemParamModel = z.object({
  id: IdSchema.openapi({ param: { name: 'id', in: 'path' } }),
  postId: IdSchema.openapi({ param: { name: 'postId', in: 'path' } }),
}).openapi('PostListItemParam')

export const AddPostToListModel = z.object({
  post_id: IdSchema,
}).openapi('AddPostToList')

export const PostListResponseModel = z.object({
  data: PostListModel,
}).openapi('PostListResponse')

export const PostListsResponseModel = z.object({
  data: z.array(PostListModel),
}).openapi('PostListsResponse')

export type PostList = z.infer<typeof PostListModel>
export type CreatePostList = z.infer<typeof CreatePostListModel>
export type AddPostToList = z.infer<typeof AddPostToListModel>
