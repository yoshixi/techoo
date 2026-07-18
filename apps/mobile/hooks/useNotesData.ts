import { useCallback } from 'react'
import { useSWRConfig } from 'swr'
import {
  deleteApiV1NotesId,
  postApiV1Notes,
  patchApiV1NotesId,
  useGetApiV1Notes,
} from '@/gen/api/endpoints/techooAPI.gen'
import type { GetApiV1NotesParams, Note } from '@/gen/api/schemas'
import { toRfc3339 } from '@/lib/time'

const NOTES_PAGE: GetApiV1NotesParams = { limit: 500, offset: 0 }

export function splitNoteText(text: string): { title: string; body: string | null } {
  const lines = text.split('\n')
  const title = (lines[0] || '').trim() || 'Untitled'
  const rest = lines.slice(1).join('\n').trim()
  return { title, body: rest || null }
}

export function mergeNoteText(note: Note): string {
  if (note.body?.trim()) return `${note.title}\n${note.body}`
  return note.title
}

export interface UseNotesDataReturn {
  notes: Note[]
  notesLoading: boolean
  notesError: unknown
  mutateNotes: ReturnType<typeof useGetApiV1Notes>['mutate']
  handleCreateNote: (text: string) => Promise<void>
  handleUpdateNote: (noteId: number, text: string) => Promise<void>
  handleDeleteNote: (noteId: number) => Promise<void>
  handleTogglePin: (noteId: number, pinned: number) => Promise<void>
  refreshNotes: () => Promise<void>
}

export function useNotesData(): UseNotesDataReturn {
  const { mutate: globalMutate } = useSWRConfig()
  const {
    data: notesResponse,
    error: notesError,
    isLoading: notesLoading,
    mutate: mutateNotes,
  } = useGetApiV1Notes(NOTES_PAGE)

  const notes = notesResponse?.data ?? []

  const refreshNotes = useCallback(async () => {
    await globalMutate(
      (key) => Array.isArray(key) && key[0] === '/api/v1/notes',
      undefined,
      { revalidate: true }
    )
  }, [globalMutate])

  const handleCreateNote = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return
      const { title, body } = splitNoteText(text)
      const nowIso = toRfc3339(new Date())
      const tempId = -Math.abs(Date.now())

      const optimisticNote: Note = {
        id: tempId,
        title,
        body,
        pinned: 0,
        created_at: nowIso,
        updated_at: nowIso,
      }

      mutateNotes(
        (currentData) => {
          if (!currentData) return { data: [optimisticNote] }
          return { data: [optimisticNote, ...currentData.data] }
        },
        { revalidate: false }
      )

      try {
        await postApiV1Notes({ title, body: body ?? undefined })
        await mutateNotes()
      } catch (err) {
        await mutateNotes()
        throw err
      }
    },
    [mutateNotes]
  )

  const handleUpdateNote = useCallback(
    async (noteId: number, text: string): Promise<void> => {
      const { title, body } = splitNoteText(text)
      const nowIso = toRfc3339(new Date())

      mutateNotes(
        (currentData) => {
          if (!currentData) return currentData
          return {
            data: currentData.data.map((n) =>
              n.id === noteId ? { ...n, title, body, updated_at: nowIso } : n
            ),
          }
        },
        { revalidate: false }
      )

      try {
        await patchApiV1NotesId(noteId, { title, body })
        await mutateNotes()
      } catch (err) {
        await mutateNotes()
        throw err
      }
    },
    [mutateNotes]
  )

  const handleDeleteNote = useCallback(
    async (noteId: number): Promise<void> => {
      mutateNotes(
        (currentData) => {
          if (!currentData) return currentData
          return { data: currentData.data.filter((n) => n.id !== noteId) }
        },
        { revalidate: false }
      )
      try {
        await deleteApiV1NotesId(noteId)
      } catch (err) {
        await mutateNotes()
        throw err
      }
    },
    [mutateNotes]
  )

  const handleTogglePin = useCallback(
    async (noteId: number, pinned: number): Promise<void> => {
      try {
        await patchApiV1NotesId(noteId, { pinned })
        await mutateNotes()
      } catch (err) {
        await mutateNotes()
        throw err
      }
    },
    [mutateNotes]
  )

  return {
    notes,
    notesLoading,
    notesError,
    mutateNotes,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleTogglePin,
    refreshNotes,
  }
}
