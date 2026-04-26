import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useNotes } from '../hooks/useNotes'
import type { Note } from '../gen/api/schemas'

/* ------------------------------------------------------------------ */
/*  Note list row                                                      */
/* ------------------------------------------------------------------ */

function NoteListItem({
  note,
  isSelected,
  onSelect
}: {
  note: Note
  isSelected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const d = new Date(note.updated_at)
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
  const preview = note.body?.split('\n')[0] ?? ''

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left transition-colors ${
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
      style={{ minHeight: 56, padding: '8px 14px', borderBottom: '0.5px solid var(--border-l)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: note.pinned === 1 ? 'var(--amber)' : 'transparent',
            border: note.pinned === 1 ? 'none' : '0.5px solid var(--text-hint)'
          }}
        />
        <span className="flex-1 truncate text-xs font-medium">{note.title || 'Untitled'}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{dateStr}</span>
      </div>
      {preview && (
        <p className="truncate text-[11px] text-muted-foreground mt-0.5 pl-3.5">{preview}</p>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  NotesView                                                          */
/* ------------------------------------------------------------------ */

export function NotesView(): React.JSX.Element {
  const { notes, isLoading, createNote, updateNote, deleteNote } = useNotes()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? notes.filter(
          (n) => n.title.toLowerCase().includes(q) || (n.body && n.body.toLowerCase().includes(q))
        )
      : notes
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned - a.pinned
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [notes, search])

  const handleCreate = useCallback(() => {
    createNote('Untitled')
  }, [createNote])

  const handleBodyChange = useCallback(
    (value: string) => {
      if (!selectedNote) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateNote(selectedNote.id, { body: value })
      }, 800)
    },
    [selectedNote, updateNote]
  )

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

  useEffect(() => {
    if (bodyRef.current && selectedNote) {
      bodyRef.current.value = selectedNote.body ?? ''
    }
  }, [selectedNote?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left panel */}
      <div
        className="flex flex-col min-h-0 shrink-0"
        style={{
          width: 260,
          background: 'var(--panel)',
          borderRight: '0.5px solid var(--border-l)'
        }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="font-title" style={{ fontSize: 15 }}>
            Notes
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 rounded-md"
            onClick={handleCreate}
          >
            + New
          </Button>
        </div>

        <div className="px-4 pb-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 text-xs"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground p-4">Loading...</p>}
          {!isLoading && filteredNotes.length === 0 && (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {search ? 'No matches found' : 'No notes yet'}
            </p>
          )}
          {filteredNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isSelected={note.id === selectedId}
              onSelect={() => setSelectedId(note.id)}
            />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedNote ? (
          <>
            <div
              className="flex items-center justify-end gap-2 px-5 shrink-0"
              style={{ height: 40, borderBottom: '0.5px solid var(--border-l)' }}
            >
              <button
                onClick={() =>
                  updateNote(selectedNote.id, { pinned: selectedNote.pinned === 1 ? 0 : 1 })
                }
                title={selectedNote.pinned === 1 ? 'Unpin' : 'Pin'}
                className="p-1"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    background: selectedNote.pinned === 1 ? 'var(--amber)' : 'transparent',
                    border: selectedNote.pinned === 1 ? 'none' : '1px solid var(--text-hint)'
                  }}
                />
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  deleteNote(selectedNote.id)
                  setSelectedId(null)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <input
              value={selectedNote.title}
              onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
              placeholder="Untitled"
              className="font-title border-none outline-none bg-transparent"
              style={{ fontSize: 22, padding: '24px 24px 8px' }}
            />

            <div style={{ height: 1, background: 'var(--border-l)', margin: '0 24px 16px' }} />

            <textarea
              ref={bodyRef}
              key={selectedNote.id}
              defaultValue={selectedNote.body ?? ''}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="Start writing..."
              className="flex-1 min-h-0 resize-none outline-none bg-transparent"
              style={{ padding: '0 24px 24px', fontSize: 13, lineHeight: 1.8 }}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a note or create a new one
          </div>
        )}
      </div>
    </div>
  )
}
