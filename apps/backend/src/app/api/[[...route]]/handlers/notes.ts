import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  listNotesRoute,
  getNoteRoute,
  createNoteRoute,
  updateNoteRoute,
  deleteNoteRoute,
  convertNoteToTaskRoute
} from '../routes/notes'
import { getAllNotes, getNoteById, createNote, updateNote, deleteNote, archiveNote, recordConversion } from '../../../core/notes.db'
import { createTask } from '../../../core/tasks.db'

// Note handlers
export const listNotesHandler: RouteHandler<typeof listNotesRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { includeArchived } = c.req.valid('query')

    const notes = await getAllNotes(db, user.id, includeArchived)

    return c.json(
      {
        notes: notes,
        total: notes.length
      },
      200
    )
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to fetch notes')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch notes'
      },
      500
    )
  }
}

export const getNoteHandler: RouteHandler<typeof getNoteRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const note = await getNoteById(db, user.id, id)

    if (!note) {
      return c.json(
        {
          error: 'Not found',
          message: 'Note not found'
        },
        404
      )
    }

    return c.json({ note }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to fetch note')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch note'
      },
      500
    )
  }
}

export const createNoteHandler: RouteHandler<typeof createNoteRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const data = c.req.valid('json')

    const note = await createNote(db, user.id, data)

    return c.json({ note }, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to create note')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to create note'
      },
      500
    )
  }
}

export const updateNoteHandler: RouteHandler<typeof updateNoteRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    const note = await updateNote(db, user.id, id, data)

    if (!note) {
      return c.json(
        {
          error: 'Not found',
          message: 'Note not found'
        },
        404
      )
    }

    return c.json({ note }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to update note')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to update note'
      },
      500
    )
  }
}

export const deleteNoteHandler: RouteHandler<typeof deleteNoteRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const note = await deleteNote(db, user.id, id)

    if (!note) {
      return c.json(
        {
          error: 'Not found',
          message: 'Note not found'
        },
        404
      )
    }

    return c.json({ note }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to delete note')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete note'
      },
      500
    )
  }
}

export const convertNoteToTaskHandler: RouteHandler<typeof convertNoteToTaskRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const { startAt, endAt } = c.req.valid('json')

    // Get the note
    const existingNote = await getNoteById(db, user.id, id)
    if (!existingNote) {
      return c.json(
        {
          error: 'Not found',
          message: 'Note not found'
        },
        404
      )
    }

    // Create a task from the note
    const task = await createTask(db, user.id, {
      title: existingNote.title,
      description: existingNote.content || undefined,
      startAt,
      endAt
    })

    // Record the conversion
    await recordConversion(db, existingNote.id, task.id)

    // Archive the note
    const archivedNote = await archiveNote(db, user.id, existingNote.id)
    if (!archivedNote) {
      return c.json(
        {
          error: 'Internal server error',
          message: 'Failed to archive note after conversion'
        },
        500
      )
    }

    return c.json({ task, note: archivedNote }, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to convert note to task')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to convert note to task'
      },
      500
    )
  }
}
