import { eq, and, sql, or, isNull } from 'drizzle-orm'
import { todosTable, type SelectTodo } from '../db/schema/schema'
import { type DB } from './common.db'
import { unixToIso } from './common.core'
import type { Todo, CreateTodo, UpdateTodo } from './todos.core'

function convertDbTodoToApi(row: SelectTodo): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    starts_at: row.startsAt != null ? unixToIso(row.startsAt) : null,
    ends_at: row.endsAt != null ? unixToIso(row.endsAt) : null,
    is_all_day: row.isAllDay,
    done: row.done,
    done_at: row.doneAt != null ? unixToIso(row.doneAt) : null,
    created_at: unixToIso(row.createdAt),
  }
}

export async function getTodosByRange(
  db: DB,
  userId: number,
  from: number | undefined,
  to: number | undefined,
  limitRows: number
): Promise<Todo[]> {
  const conditions = [eq(todosTable.userId, userId)]
  // Single-day (and similar) windows should include unscheduled inbox todos (null starts_at),
  // matching getIncompleteTodosInRange behavior but without filtering by done.
  if (from !== undefined && to !== undefined) {
    conditions.push(
      sql`(${todosTable.startsAt} IS NULL OR (${todosTable.startsAt} >= ${from} AND ${todosTable.startsAt} < ${to}))`
    )
  } else {
    if (from !== undefined) {
      conditions.push(sql`${todosTable.startsAt} >= ${from}`)
    }
    if (to !== undefined) {
      conditions.push(sql`${todosTable.startsAt} < ${to}`)
    }
  }

  const rows = await db
    .select()
    .from(todosTable)
    .where(and(...conditions))
    .orderBy(sql`${todosTable.startsAt} IS NULL`, todosTable.startsAt, todosTable.createdAt)
    .limit(limitRows)

  return rows.map(convertDbTodoToApi)
}

export async function getIncompleteTodos(db: DB, userId: number, limitRows: number): Promise<Todo[]> {
  return getIncompleteTodosWithBounds(db, userId, undefined, undefined, limitRows)
}

export async function getIncompleteTodosWithBounds(
  db: DB,
  userId: number,
  from: number | undefined,
  to: number | undefined,
  limitRows: number
): Promise<Todo[]> {
  const conditions = [eq(todosTable.userId, userId), eq(todosTable.done, 0)]

  if (from !== undefined && to !== undefined) {
    conditions.push(
      or(
        isNull(todosTable.startsAt),
        and(sql`${todosTable.startsAt} >= ${from}`, sql`${todosTable.startsAt} < ${to}`)
      )!
    )
  } else {
    if (from !== undefined) {
      conditions.push(sql`${todosTable.startsAt} >= ${from}`)
    }
    if (to !== undefined) {
      conditions.push(sql`${todosTable.startsAt} < ${to}`)
    }
  }

  const rows = await db
    .select()
    .from(todosTable)
    .where(and(...conditions))
    .orderBy(sql`${todosTable.startsAt} IS NULL`, todosTable.startsAt, todosTable.createdAt)
    .limit(limitRows)

  return rows.map(convertDbTodoToApi)
}

/** Incomplete todos whose start falls in [from, to), plus unscheduled (`starts_at` null) inbox items. */
export async function getIncompleteTodosInRange(
  db: DB,
  userId: number,
  from: number,
  to: number,
  limitRows: number
): Promise<Todo[]> {
  return getIncompleteTodosWithBounds(db, userId, from, to, limitRows)
}

export async function getTodoById(db: DB, userId: number, todoId: number): Promise<Todo | null> {
  const [row] = await db
    .select()
    .from(todosTable)
    .where(and(eq(todosTable.id, todoId), eq(todosTable.userId, userId)))

  return row ? convertDbTodoToApi(row) : null
}

export async function createTodo(db: DB, userId: number, data: CreateTodo): Promise<Todo> {
  const now = Math.floor(Date.now() / 1000)

  const [row] = await db.insert(todosTable).values({
    userId,
    title: data.title.trim(),
    description: data.description?.trim() ?? null,
    startsAt: data.starts_at ?? null,
    endsAt: data.ends_at ?? null,
    isAllDay: data.is_all_day ?? 0,
    done: 0,
    createdAt: now,
  }).returning()

  if (!row) throw new Error('Failed to create todo')
  return convertDbTodoToApi(row)
}

export async function updateTodo(db: DB, userId: number, todoId: number, data: UpdateTodo): Promise<Todo | null> {
  const existing = await getTodoById(db, userId, todoId)
  if (!existing) return null

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.description !== undefined) {
    updateData.description =
      data.description === null || data.description === '' ? null : data.description.trim()
  }
  if (data.starts_at !== undefined) updateData.startsAt = data.starts_at
  if (data.ends_at !== undefined) updateData.endsAt = data.ends_at
  if (data.is_all_day !== undefined) updateData.isAllDay = data.is_all_day
  if (data.done !== undefined) {
    updateData.done = data.done
    updateData.doneAt = data.done === 1 ? Math.floor(Date.now() / 1000) : null
  }

  const [row] = await db
    .update(todosTable)
    .set(updateData)
    .where(and(eq(todosTable.id, todoId), eq(todosTable.userId, userId)))
    .returning()

  return row ? convertDbTodoToApi(row) : null
}

export async function deleteTodo(db: DB, userId: number, todoId: number): Promise<Todo | null> {
  const existing = await getTodoById(db, userId, todoId)
  if (!existing) return null

  await db
    .delete(todosTable)
    .where(and(eq(todosTable.id, todoId), eq(todosTable.userId, userId)))

  return existing
}
