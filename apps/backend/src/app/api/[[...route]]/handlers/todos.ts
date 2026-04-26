import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { listTodosRoute, createTodoRoute, updateTodoRoute, deleteTodoRoute } from '../routes/todos'
import {
  getTodosByRange,
  getIncompleteTodos,
  getIncompleteTodosWithBounds,
  getIncompleteTodosInRange,
  createTodo,
  updateTodo,
  deleteTodo
} from '../../../core/todos.db'
import { clampGenericListLimit } from '../../../core/list-limits'

export const listTodosHandler: RouteHandler<typeof listTodosRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { from, to, done, limit } = c.req.valid('query')
    const lim = clampGenericListLimit(limit ?? undefined)

    let todos
    if (done === 'false') {
      if (from !== undefined && to !== undefined) {
        todos = await getIncompleteTodosInRange(db, user.id, from, to, lim)
      } else if (from !== undefined || to !== undefined) {
        todos = await getIncompleteTodosWithBounds(db, user.id, from, to, lim)
      } else {
        todos = await getIncompleteTodos(db, user.id, lim)
      }
    } else {
      todos = await getTodosByRange(db, user.id, from, to, lim)
    }

    return c.json({ data: todos }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to fetch todos')
    return c.json({ error: 'Failed to fetch todos' }, 500)
  }
}

export const createTodoHandler: RouteHandler<typeof createTodoRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const data = c.req.valid('json')
    const todo = await createTodo(db, user.id, data)
    return c.json({ data: todo }, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to create todo')
    return c.json({ error: 'Failed to create todo' }, 500)
  }
}

export const updateTodoHandler: RouteHandler<typeof updateTodoRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const todo = await updateTodo(db, user.id, id, data)
    if (!todo) return c.json({ error: 'Todo not found' }, 404)
    return c.json({ data: todo }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to update todo')
    return c.json({ error: 'Failed to update todo' }, 500)
  }
}

export const deleteTodoHandler: RouteHandler<typeof deleteTodoRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const todo = await deleteTodo(db, user.id, id)
    if (!todo) return c.json({ error: 'Todo not found' }, 404)
    return c.json({ data: todo }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to delete todo')
    return c.json({ error: 'Failed to delete todo' }, 500)
  }
}
