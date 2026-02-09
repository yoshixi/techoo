import useSWR, { type SWRResponse } from 'swr'
import { customInstance } from '../lib/api/mutator'

export interface TaskComment {
  id: number
  taskId: number
  authorId: number
  body: string
  createdAt: string
  updatedAt: string
}

export interface TaskCommentListResponse {
  comments: TaskComment[]
  total: number
}

export interface TaskCommentResponse {
  comment: TaskComment
}

const commentsKey = (taskId: number) => ['/api/tasks', taskId, 'comments'] as const

const fetchTaskComments = (taskId: number) => {
  return customInstance<TaskCommentListResponse>({
    url: `/api/tasks/${taskId}/comments`,
    method: 'GET'
  })
}

export const createTaskComment = (taskId: number, body: string) => {
  return customInstance<TaskCommentResponse>({
    url: `/api/tasks/${taskId}/comments`,
    method: 'POST',
    data: { body }
  })
}

export type UseTaskCommentsResult = SWRResponse<TaskCommentListResponse, unknown>

export const useTaskComments = (taskId?: number): UseTaskCommentsResult => {
  return useSWR(taskId ? commentsKey(taskId) : null, () => fetchTaskComments(taskId!))
}
