import { createRoute } from '@hono/zod-openapi'
import {
  PostListResponseModel,
  PostListsResponseModel,
  PostListIdParamModel,
  PostListItemParamModel,
  CreatePostListModel,
  AddPostToListModel,
} from '../../../core/post-lists.core'
import { PostIdParamModel } from '../../../core/posts.core'
import { ErrorResponseModel } from '../../../core/common.core'

export const favoritePostRoute = createRoute({
  method: 'post',
  path: '/v1/posts/{id}/favorite',
  summary: 'Favorite a post',
  request: { params: PostIdParamModel },
  responses: {
    204: { description: 'Favorited' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const unfavoritePostRoute = createRoute({
  method: 'delete',
  path: '/v1/posts/{id}/favorite',
  summary: 'Unfavorite a post',
  request: { params: PostIdParamModel },
  responses: {
    204: { description: 'Unfavorited' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const listPostListsRoute = createRoute({
  method: 'get',
  path: '/v1/post-lists',
  summary: 'List all post lists for the user',
  responses: {
    200: { content: { 'application/json': { schema: PostListsResponseModel } }, description: 'Lists retrieved' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const createPostListRoute = createRoute({
  method: 'post',
  path: '/v1/post-lists',
  summary: 'Create a post list',
  request: { body: { content: { 'application/json': { schema: CreatePostListModel } } } },
  responses: {
    201: { content: { 'application/json': { schema: PostListResponseModel } }, description: 'List created' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const deletePostListRoute = createRoute({
  method: 'delete',
  path: '/v1/post-lists/{id}',
  summary: 'Delete a post list',
  request: { params: PostListIdParamModel },
  responses: {
    204: { description: 'List deleted' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const addPostToListRoute = createRoute({
  method: 'post',
  path: '/v1/post-lists/{id}/posts',
  summary: 'Add a post to a list',
  request: {
    params: PostListIdParamModel,
    body: { content: { 'application/json': { schema: AddPostToListModel } } },
  },
  responses: {
    204: { description: 'Post added to list' },
    400: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Bad request' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})

export const removePostFromListRoute = createRoute({
  method: 'delete',
  path: '/v1/post-lists/{id}/posts/{postId}',
  summary: 'Remove a post from a list',
  request: { params: PostListItemParamModel },
  responses: {
    204: { description: 'Post removed from list' },
    404: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: ErrorResponseModel } }, description: 'Internal error' },
  },
})
