import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  listTagsRoute,
  getTagRoute,
  createTagRoute,
  updateTagRoute,
  deleteTagRoute
} from '../routes/tags'
import { getDb } from '../../../core/common.db'
import { getAllTags, getTagById, createTag, updateTag, deleteTag } from '../../../core/tags.db'

// Tag handlers
export const listTagsHandler: RouteHandler<typeof listTagsRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')

    const tags = await getAllTags(db, user.id)

    return c.json(
      {
        tags: tags,
        total: tags.length
      },
      200
    )
  } catch (error) {
    console.error('Error fetching tags:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch tags'
      },
      500
    )
  }
}

export const getTagHandler: RouteHandler<typeof getTagRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const tag = await getTagById(db, user.id, id)

    if (!tag) {
      return c.json(
        {
          error: 'Not found',
          message: 'Tag not found'
        },
        404
      )
    }

    return c.json({ tag }, 200)
  } catch (error) {
    console.error('Error fetching tag:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch tag'
      },
      500
    )
  }
}

export const createTagHandler: RouteHandler<typeof createTagRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const data = c.req.valid('json')

    const tag = await createTag(db, user.id, data)

    return c.json({ tag }, 201)
  } catch (error) {
    // Handle unique constraint violation (duplicate tag name)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as any)?.code || ''
    const errorName = (error as any)?.name || ''

    // Check the cause property for SQLite/D1 errors (Drizzle wraps the actual SQLite error)
    const cause = (error as any)?.cause
    const causeCode = cause?.code || ''
    const causeMessage = cause?.message || ''

    // Check for UNIQUE constraint violation in multiple ways
    // SQLite/D1 may throw different error formats
    if (errorMessage.toLowerCase().includes('unique') ||
        errorMessage.toLowerCase().includes('constraint') ||
        errorMessage.includes('UNIQUE constraint failed') ||
        errorCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
        errorCode === 'SQLITE_CONSTRAINT' ||
        errorCode === '2067' ||
        errorCode === 2067 ||
        errorName === 'SqliteError' ||
        causeCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
        causeCode === 'SQLITE_CONSTRAINT' ||
        causeMessage.includes('UNIQUE constraint failed')) {
      return c.json(
        {
          error: 'Bad request',
          message: 'A tag with this name already exists'
        },
        400
      )
    }

    console.error('Error creating tag:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to create tag'
      },
      500
    )
  }
}

export const updateTagHandler: RouteHandler<typeof updateTagRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    const tag = await updateTag(db, user.id, id, data)

    if (!tag) {
      return c.json(
        {
          error: 'Not found',
          message: 'Tag not found'
        },
        404
      )
    }

    return c.json({ tag }, 200)
  } catch (error) {
    // Handle unique constraint violation
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as any)?.code || ''
    const errorName = (error as any)?.name || ''

    // Check the cause property for SQLite/D1 errors (Drizzle wraps the actual SQLite error)
    const cause = (error as any)?.cause
    const causeCode = cause?.code || ''
    const causeMessage = cause?.message || ''

    // Check for UNIQUE constraint violation in multiple ways
    // SQLite/D1 may throw different error formats
    if (errorMessage.toLowerCase().includes('unique') ||
        errorMessage.toLowerCase().includes('constraint') ||
        errorMessage.includes('UNIQUE constraint failed') ||
        errorCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
        errorCode === 'SQLITE_CONSTRAINT' ||
        errorCode === '2067' ||
        errorCode === 2067 ||
        errorName === 'SqliteError' ||
        causeCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
        causeCode === 'SQLITE_CONSTRAINT' ||
        causeMessage.includes('UNIQUE constraint failed')) {
      return c.json(
        {
          error: 'Bad request',
          message: 'A tag with this name already exists'
        },
        400
      )
    }

    console.error('Error updating tag:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to update tag'
      },
      500
    )
  }
}

export const deleteTagHandler: RouteHandler<typeof deleteTagRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const tag = await deleteTag(db, user.id, id)

    if (!tag) {
      return c.json(
        {
          error: 'Not found',
          message: 'Tag not found'
        },
        404
      )
    }

    return c.json({ tag }, 200)
  } catch (error) {
    console.error('Error deleting tag:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete tag'
      },
      500
    )
  }
}
