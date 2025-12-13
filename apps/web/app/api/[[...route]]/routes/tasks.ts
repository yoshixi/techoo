import { createRoute } from '@hono/zod-openapi'
import {
  TaskQueryParamsModel,
  TaskListResponseModel,
  ErrorResponseModel,
  TaskIdParamModel,
  TaskResponseModel,
  CreateTaskModel,
  UpdateTaskModel
} from '../../../models'

// GET /tasks - List all tasks with optional filtering
export const listTasksRoute = createRoute({
  method: 'get',
  path: '/tasks',
  summary: 'Get all tasks',
  description: 'Retrieve all tasks with optional status filtering',
  request: {
    query: TaskQueryParamsModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskListResponseModel
        }
      },
      description: 'Tasks retrieved successfully'
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

// GET /tasks/{id} - Get a specific task
export const getTaskRoute = createRoute({
  method: 'get',
  path: '/tasks/{id}',
  summary: 'Get a task',
  description: 'Retrieve a specific task by ID',
  request: {
    params: TaskIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskResponseModel
        }
      },
      description: 'Task retrieved successfully'
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

// POST /tasks - Create a new task
export const createTaskRoute = createRoute({
  method: 'post',
  path: '/tasks',
  summary: 'Create a task',
  description: 'Create a new task',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTaskModel
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TaskResponseModel
        }
      },
      description: 'Task created successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Bad request'
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

// PUT /tasks/{id} - Update an existing task
export const updateTaskRoute = createRoute({
  method: 'put',
  path: '/tasks/{id}',
  summary: 'Update a task',
  description: 'Update an existing task by ID',
  request: {
    params: TaskIdParamModel,
    body: {
      content: {
        'application/json': {
          schema: UpdateTaskModel
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskResponseModel
        }
      },
      description: 'Task updated successfully'
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
      description: 'Bad request'
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

// DELETE /tasks/{id} - Delete a task
export const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/tasks/{id}',
  summary: 'Delete a task',
  description: 'Delete a task by ID',
  request: {
    params: TaskIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskResponseModel
        }
      },
      description: 'Task deleted successfully'
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