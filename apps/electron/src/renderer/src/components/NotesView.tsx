import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Archive, ArrowRightLeft, Trash2 } from 'lucide-react'
import { CharacterIllustration } from './CharacterIllustration'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Dialog, DialogContent } from './ui/dialog'
import { TaskTimeRangePicker } from './TaskTimeRangePicker'
import { useNotesData } from '../hooks/useNotesData'
import { mergeNoteText } from '../hooks/useNotesData'
import type { Note } from '../gen/api'

/** Hook: auto-resize a textarea to fit its content. */
function useAutoResize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}

/** The composer textarea at the top -- auto-creates a note on blur. */
function NoteComposer({
  onCreate
}: {
  onCreate: (text: string) => void
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutoResize(ref, value)

  const handleBlur = useCallback(() => {
    if (!value.trim()) return
    onCreate(value)
    setValue('')
  }, [value, onCreate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!value.trim()) return
      onCreate(value)
      setValue('')
    }
  }, [value, onCreate])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="What's on your mind?"
      rows={1}
      className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  )
}

/** A single note card -- unified textarea editing, first line = title. */
function NoteCard({
  note,
  onUpdate,
  onDelete,
  onArchive,
  onConvertToTask
}: {
  note: Note
  onUpdate: (noteId: number, text: string) => void
  onDelete: (noteId: number) => void
  onArchive: (noteId: number) => void
  onConvertToTask: (note: Note) => void
}): React.JSX.Element {
  const merged = mergeNoteText(note)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(merged)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useAutoResize(textareaRef, editValue)

  // Sync when note changes from server
  useEffect(() => {
    if (!isEditing) {
      setEditValue(mergeNoteText(note))
    }
  }, [note, isEditing])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    const trimmed = editValue.trim()
    if (!trimmed) return
    if (trimmed !== merged.trim()) {
      onUpdate(note.id, editValue)
    }
  }, [editValue, merged, note.id, onUpdate])

  const updatedDate = new Date(note.updatedAt)
  const dateStr = updatedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timeStr = updatedDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const isArchived = !!note.archivedAt

  return (
    <div className={`rounded-lg border bg-card p-4 space-y-2 ${isArchived ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              rows={1}
              className="w-full resize-none bg-transparent text-sm focus-visible:outline-none [&::first-line]:font-semibold"
            />
          ) : (
            <button
              className="text-sm text-left w-full cursor-text"
              onClick={() => {
                const text = mergeNoteText(note)
                setEditValue(text)
                setIsEditing(true)
                // Resize textarea and place cursor at the end after render
                requestAnimationFrame(() => {
                  const el = textareaRef.current
                  if (el) {
                    el.style.height = 'auto'
                    el.style.height = `${el.scrollHeight}px`
                    el.focus()
                    el.setSelectionRange(text.length, text.length)
                  }
                })
              }}
            >
              <span className="font-semibold line-clamp-1">{note.title}</span>
              {note.content && (
                <span className="text-muted-foreground line-clamp-2 mt-0.5 block">{note.content}</span>
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onConvertToTask(note)}
            title="Convert to task"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onArchive(note.id)}
            title="Archive note"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(note.id)}
            title="Delete note"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {dateStr} {timeStr}
      </div>
    </div>
  )
}

export function NotesView(): React.JSX.Element {
  const [showArchived, setShowArchived] = useState(false)

  const {
    notes,
    notesLoading,
    notesError,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleArchiveNote,
    handleConvertToTask
  } = useNotesData({ includeArchived: showArchived })

  // Conversion dialog state
  const [convertingNote, setConvertingNote] = useState<Note | null>(null)
  const [convertSchedule, setConvertSchedule] = useState<{ startAt: string | null; endAt: string | null }>({
    startAt: null,
    endAt: null
  })
  const [isConverting, setIsConverting] = useState(false)

  const openConvertDialog = useCallback((note: Note) => {
    // Default to now → +1h
    const now = new Date()
    const end = new Date(now.getTime() + 60 * 60 * 1000)
    setConvertSchedule({
      startAt: now.toISOString(),
      endAt: end.toISOString()
    })
    setConvertingNote(note)
  }, [])

  const handleConfirmConvert = useCallback(async () => {
    if (!convertingNote) return
    setIsConverting(true)
    try {
      await handleConvertToTask(convertingNote.id, {
        startAt: convertSchedule.startAt ?? undefined,
        endAt: convertSchedule.endAt ?? undefined
      })
      setConvertingNote(null)
    } finally {
      setIsConverting(false)
    }
  }, [convertingNote, convertSchedule, handleConvertToTask])

  const handleConvertWithoutSchedule = useCallback(async () => {
    if (!convertingNote) return
    setIsConverting(true)
    try {
      await handleConvertToTask(convertingNote.id)
      setConvertingNote(null)
    } finally {
      setIsConverting(false)
    }
  }, [convertingNote, handleConvertToTask])

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-8">
      <main className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notes</h2>
          <div className="flex items-center justify-between w-[130px] h-8 rounded-md border border-input px-3">
            <Label htmlFor="notes-show-archived" className="text-sm cursor-pointer">
              Archived
            </Label>
            <Switch
              id="notes-show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
              className="scale-75"
            />
          </div>
        </div>

        {/* Composer */}
        <NoteComposer onCreate={handleCreateNote} />

        {/* Loading / Error states */}
        {notesLoading && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            Loading notes...
          </div>
        )}
        {!notesLoading && notesError ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            We had trouble loading your notes. Please try again.
          </div>
        ) : null}

        {/* Notes list */}
        {!notesLoading && !notesError && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
            {notes.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8 space-y-3">
                <CharacterIllustration mood="thinking" size="md" className="mx-auto" />
                <p>No notes yet. Start typing above to capture an idea.</p>
              </div>
            ) : (
              notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onUpdate={handleUpdateNote}
                  onDelete={handleDeleteNote}
                  onArchive={handleArchiveNote}
                  onConvertToTask={openConvertDialog}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* Convert to task confirmation dialog */}
      <Dialog
        open={Boolean(convertingNote)}
        onOpenChange={(open) => {
          if (!open && !isConverting) {
            setConvertingNote(null)
          }
        }}
      >
        <DialogContent className="max-w-xl w-[95vw]">
          {convertingNote && (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Convert to task</div>
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <div className="text-sm font-medium">{convertingNote.title}</div>
                {convertingNote.content && (
                  <div className="text-sm text-muted-foreground line-clamp-3">{convertingNote.content}</div>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                Set a schedule for this task, or create it without one.
              </div>

              <TaskTimeRangePicker
                startAt={convertSchedule.startAt}
                endAt={convertSchedule.endAt}
                onChange={setConvertSchedule}
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setConvertingNote(null)}
                  disabled={isConverting}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConvertWithoutSchedule}
                  disabled={isConverting}
                >
                  {isConverting ? 'Converting...' : 'Without schedule'}
                </Button>
                <Button
                  onClick={handleConfirmConvert}
                  disabled={isConverting}
                >
                  {isConverting ? 'Converting...' : 'Convert'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
