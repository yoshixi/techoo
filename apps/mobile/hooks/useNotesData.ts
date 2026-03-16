import { useCallback } from 'react'
import { useSWRConfig } from 'swr'
import {
  deleteApiNotesId,
  postApiNotes,
  putApiNotesId,
  postApiNotesIdTaskConversions,
  useGetApiNotes,
} from '@/gen/api/endpoints/techoAPI.gen'
import type { Note } from '@/gen/api/schemas'

/** Split raw text into title (first line) and content (rest). */
export function splitNoteText(text: string): { title: string; content: string | null } {
  const lines = text.split('\n')
  const title = (lines[0] || '').trim() || 'Untitled'
  const rest = lines.slice(1).join('\n').trim()
  return { title, content: rest || null }
}

/** Merge title and content back into a single text block. */
export function mergeNoteText(note: Note): string {
  if (note.content) return `${note.title}\n${note.content}`
  return note.title
}

export interface UseNotesDataReturn {
  notes: Note[]
  notesLoading: boolean
  notesError: unknown
  mutateNotes: ReturnType<typeof useGetApiNotes>['mutate']
  handleCreateNote: (text: string) => void
  handleUpdateNote: (noteId: number, text: string) => void
  handleDeleteNote: (noteId: number) => Promise<void>
  handleArchiveNote: (noteId: number) => Promise<void>
  handleConvertToTask: (noteId: number, schedule?: { startAt?: string; endAt?: string }) => Promise<void>
  refreshNotes: () => Promise<void>
}

export function useNotesData(options?: { includeArchived?: boolean }): UseNotesDataReturn {
  const { mutate: globalMutate } = useSWRConfig()
  const {
    data: notesResponse,
    error: notesError,
    isLoading: notesLoading,
    mutate: mutateNotes,
  } = useGetApiNotes(
    options?.includeArchived ? { includeArchived: 'true' } : undefined
  )

  const notes = notesResponse?.notes ?? []

  const refreshNotes = useCallback(async () => {
    await globalMutate(
      (key) => Array.isArray(key) && key[0] === '/api/notes',
      undefined,
      { revalidate: true }
    )
  }, [globalMutate])

  const handleCreateNote = useCallback((text: string) => {
    if (!text.trim()) return

    const { title, content } = splitNoteText(text)
    const now = new Date().toISOString()
    const tempId = -Date.now()

    const optimisticNote: Note = {
      id: tempId,
      title,
      content,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    mutateNotes(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          notes: [optimisticNote, ...currentData.notes],
          total: currentData.total + 1,
        }
      },
      { revalidate: false }
    )

    postApiNotes({ title, content: content ?? undefined })
      .then((response) => {
        mutateNotes(
          (currentData) => {
            if (!currentData) return currentData
            return {
              ...currentData,
              notes: currentData.notes.map((n) => (n.id === tempId ? response.note : n)),
            }
          },
          { revalidate: false }
        )
      })
      .catch((error) => {
        console.error('Failed to create note:', error)
        mutateNotes(
          (currentData) => {
            if (!currentData) return currentData
            return {
              ...currentData,
              notes: currentData.notes.filter((n) => n.id !== tempId),
              total: currentData.total - 1,
            }
          },
          { revalidate: false }
        )
      })
  }, [mutateNotes])

  const handleUpdateNote = useCallback((noteId: number, text: string) => {
    const { title, content } = splitNoteText(text)

    mutateNotes(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          notes: currentData.notes.map((n) =>
            n.id === noteId ? { ...n, title, content, updatedAt: new Date().toISOString() } : n
          ),
        }
      },
      { revalidate: false }
    )

    putApiNotesId(noteId, { title, content })
      .then(() => mutateNotes())
      .catch((error) => {
        console.error('Failed to update note:', error)
        mutateNotes()
      })
  }, [mutateNotes])

  const handleDeleteNote = useCallback(async (noteId: number): Promise<void> => {
    mutateNotes(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          notes: currentData.notes.filter((n) => n.id !== noteId),
          total: currentData.total - 1,
        }
      },
      { revalidate: false }
    )

    try {
      await deleteApiNotesId(noteId)
    } catch (error) {
      console.error('Failed to delete note:', error)
      await mutateNotes()
    }
  }, [mutateNotes])

  const handleArchiveNote = useCallback(async (noteId: number): Promise<void> => {
    mutateNotes(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          notes: currentData.notes.filter((n) => n.id !== noteId),
          total: currentData.total - 1,
        }
      },
      { revalidate: false }
    )

    try {
      await putApiNotesId(noteId, { archivedAt: new Date().toISOString() })
    } catch (error) {
      console.error('Failed to archive note:', error)
      await mutateNotes()
    }
  }, [mutateNotes])

  const handleConvertToTask = useCallback(async (noteId: number, schedule?: { startAt?: string; endAt?: string }): Promise<void> => {
    mutateNotes(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          notes: currentData.notes.filter((n) => n.id !== noteId),
          total: currentData.total - 1,
        }
      },
      { revalidate: false }
    )

    try {
      await postApiNotesIdTaskConversions(noteId, {
        startAt: schedule?.startAt,
        endAt: schedule?.endAt,
      })
      // Also invalidate tasks cache
      await globalMutate(
        (key) => Array.isArray(key) && key[0] === '/api/tasks',
        undefined,
        { revalidate: true }
      )
    } catch (error) {
      console.error('Failed to convert note to task:', error)
      await mutateNotes()
    }
  }, [mutateNotes, globalMutate])

  return {
    notes,
    notesLoading,
    notesError,
    mutateNotes,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleArchiveNote,
    handleConvertToTask,
    refreshNotes,
  }
}
