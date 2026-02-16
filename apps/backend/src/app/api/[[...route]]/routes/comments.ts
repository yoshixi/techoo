import { createRoute } from '@hono/zod-openapi'
import {
  TaskCommentListResponseModel,
  TaskCommentResponseModel,
  TaskIdForCommentsParamModel,
  TaskCommentParamModel,
  CreateCommentModel,
  UpdateCommentModel
} from '../../../core/comments.core'
import { ErrorResponseModel } from '../../../core/common.core'

export const listTaskCommentsRoute = createRoute({
  method: 'get',
  path: '/tasks/{taskId}/comments',
  summary: 'List comments for a task',
  request: {
    params: TaskIdForCommentsParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskCommentListResponseModel
        }
      },
      description: 'Comments retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Task not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})

export const createTaskCommentRoute = createRoute({
  method: 'post',
  path: '/tasks/{taskId}/comments',
  summary: 'Create a comment for a task',
  request: {
    params: TaskIdForCommentsParamModel,
    body: {
      content: {
        'application/json': {
          schema: CreateCommentModel
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TaskCommentResponseModel
        }
      },
      description: 'Comment created successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Task not found'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Validation error'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})

export const getTaskCommentRoute = createRoute({
  method: 'get',
  path: '/tasks/{taskId}/comments/{commentId}',
  summary: 'Get a single task comment',
  request: {
    params: TaskCommentParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskCommentResponseModel
        }
      },
      description: 'Comment retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Task or comment not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})

export const updateTaskCommentRoute = createRoute({
  method: 'patch',
  path: '/tasks/{taskId}/comments/{commentId}',
  summary: 'Update a task comment',
  request: {
    params: TaskCommentParamModel,
    body: {
      content: {
        'application/json': {
          schema: UpdateCommentModel
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskCommentResponseModel
        }
      },
      description: 'Comment updated successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Task or comment not found'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Validation error'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})

export const deleteTaskCommentRoute = createRoute({
  method: 'delete',
  path: '/tasks/{taskId}/comments/{commentId}',
  summary: 'Delete a task comment',
  request: {
    params: TaskCommentParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskCommentResponseModel
        }
      },
      description: 'Comment deleted successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Task or comment not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})
