import { createRoute } from '@hono/zod-openapi'
import {
  TagListResponseModel,
  TagIdParamModel,
  TagResponseModel,
  CreateTagModel,
  UpdateTagModel
} from '../../../core/tags.core'
import { ErrorResponseModel } from '../../../core/common.core'

// GET /tags - List all tags
export const listTagsRoute = createRoute({
  method: 'get',
  path: '/tags',
  summary: 'Get all tags',
  description: 'Retrieve all tags for the current user',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TagListResponseModel
        }
      },
      description: 'Tags retrieved successfully'
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

// GET /tags/{id} - Get a specific tag
export const getTagRoute = createRoute({
  method: 'get',
  path: '/tags/{id}',
  summary: 'Get a tag',
  description: 'Retrieve a specific tag by ID',
  request: {
    params: TagIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TagResponseModel
        }
      },
      description: 'Tag retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Tag not found'
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

// POST /tags - Create a new tag
export const createTagRoute = createRoute({
  method: 'post',
  path: '/tags',
  summary: 'Create a tag',
  description: 'Create a new tag',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTagModel
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TagResponseModel
        }
      },
      description: 'Tag created successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Bad request - duplicate tag name or invalid input'
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

// PUT /tags/{id} - Update an existing tag
export const updateTagRoute = createRoute({
  method: 'put',
  path: '/tags/{id}',
  summary: 'Update a tag',
  description: 'Update an existing tag by ID',
  request: {
    params: TagIdParamModel,
    body: {
      content: {
        'application/json': {
          schema: UpdateTagModel
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TagResponseModel
        }
      },
      description: 'Tag updated successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Tag not found'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Bad request - duplicate tag name or invalid input'
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

// DELETE /tags/{id} - Delete a tag
export const deleteTagRoute = createRoute({
  method: 'delete',
  path: '/tags/{id}',
  summary: 'Delete a tag',
  description: 'Delete a tag by ID. This will also remove the tag from all associated tasks.',
  request: {
    params: TagIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TagResponseModel
        }
      },
      description: 'Tag deleted successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Tag not found'
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
