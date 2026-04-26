import { eq, and, desc } from 'drizzle-orm'
import { notesTable, type SelectNote } from '../db/schema/schema'
import { type DB } from './common.db'
import { unixToIso } from './common.core'
import type { Note, CreateNote, UpdateNote } from './notes.core'

function convertDbNoteToApi(row: SelectNote): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? null,
    pinned: row.pinned,
    created_at: unixToIso(row.createdAt),
    updated_at: unixToIso(row.updatedAt),
  }
}

export async function getNotesPage(
  db: DB,
  userId: number,
  limit: number,
  offset: number
): Promise<{ notes: Note[]; has_more: boolean }> {
  const take = limit + 1
  const rows = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.userId, userId))
    .orderBy(desc(notesTable.pinned), desc(notesTable.updatedAt))
    .limit(take)
    .offset(offset)

  const hasMore = rows.length > limit
  const slice = hasMore ? rows.slice(0, limit) : rows
  return { notes: slice.map(convertDbNoteToApi), has_more: hasMore }
}

export async function getNoteById(db: DB, userId: number, noteId: number): Promise<Note | null> {
  const [row] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, userId)))

  return row ? convertDbNoteToApi(row) : null
}

export async function createNote(db: DB, userId: number, data: CreateNote): Promise<Note> {
  const now = Math.floor(Date.now() / 1000)

  const [row] = await db.insert(notesTable).values({
    userId,
    title: data.title.trim(),
    body: data.body?.trim() || null,
    pinned: 0,
    createdAt: now,
    updatedAt: now,
  }).returning()

  if (!row) throw new Error('Failed to create note')
  return convertDbNoteToApi(row)
}

export async function updateNote(db: DB, userId: number, noteId: number, data: UpdateNote): Promise<Note | null> {
  const existing = await getNoteById(db, userId, noteId)
  if (!existing) return null

  const now = Math.floor(Date.now() / 1000)
  const updateData: Record<string, unknown> = { updatedAt: now }

  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.body !== undefined) updateData.body = data.body === null ? null : data.body.trim()
  if (data.pinned !== undefined) updateData.pinned = data.pinned

  const [row] = await db
    .update(notesTable)
    .set(updateData)
    .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, userId)))
    .returning()

  return row ? convertDbNoteToApi(row) : null
}

export async function deleteNote(db: DB, userId: number, noteId: number): Promise<Note | null> {
  const existing = await getNoteById(db, userId, noteId)
  if (!existing) return null

  await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, userId)))

  return existing
}
