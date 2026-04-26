import { createRoute } from '@hono/zod-openapi'
import {
  PostListResponseModel,
  PostResponseModel,
  PostQueryParamsModel,
  PostIdParamModel,
  CreatePostModel,
  UpdatePostModel,
} from '../../../core/posts.core'
import { ErrorResponseModel } from '../../../core/common.core'

export const listPostsRoute = createRoute({
  method: 'get',
  path: '/v1/posts',
  summary: 'List posts',
  description:
    'List posts with linked events and todos. Use `from`+`to` for a time window, or `limit`+`offset` (newest first, paginated) for all posts.',
  request: { query: PostQueryParamsModel },
  responses: {
    200: { content: { 'application/json': { schema: PostListResponseModel } }, description: 'Posts retrieved' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const createPostRoute = createRoute({
  method: 'post',
  path: '/v1/posts',
  summary: 'Create a post',
  request: { body: { content: { 'application/json': { schema: CreatePostModel } } } },
  responses: {
    201: { content: { 'application/json': { schema: PostResponseModel } }, description: 'Post created' },
    400: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Bad request' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const updatePostRoute = createRoute({
  method: 'patch',
  path: '/v1/posts/{id}',
  summary: 'Update a post',
  request: {
    params: PostIdParamModel,
    body: { content: { 'application/json': { schema: UpdatePostModel } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: PostResponseModel } }, description: 'Post updated' },
    400: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Bad request' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const deletePostRoute = createRoute({
  method: 'delete',
  path: '/v1/posts/{id}',
  summary: 'Delete a post',
  request: { params: PostIdParamModel },
  responses: {
    200: { content: { 'application/json': { schema: PostResponseModel } }, description: 'Post deleted' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})
