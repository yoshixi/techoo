import { z } from '@hono/zod-openapi'
import { TaskTimerModel } from './timers.core'
import { TaskCommentModel } from './comments.core'
import { TaskIdParamModel } from './tasks.core'

export const TaskActivityItemModel = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('timer'),
    data: TaskTimerModel
  }),
  z.object({
    type: z.literal('comment'),
    data: TaskCommentModel
  })
]).openapi('TaskActivityItem')

export const TaskActivitiesResponseModel = z.object({
  activities: z.array(TaskActivityItemModel).openapi({
    description: 'Timeline entries combining timers and comments in descending timestamp order'
  })
}).openapi('TaskActivitiesResponse')

export const TaskActivitiesParamModel = TaskIdParamModel.openapi('TaskActivitiesParam')

export type TaskActivityItem = z.infer<typeof TaskActivityItemModel>
export type TaskActivitiesResponse = z.infer<typeof TaskActivitiesResponseModel>
export type TaskActivitiesParam = z.infer<typeof TaskActivitiesParamModel>
