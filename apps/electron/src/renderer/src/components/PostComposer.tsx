import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Send, Hash, X } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import type { Todo } from '../gen/api/schemas'
import { isMacPlatform } from '../lib/platform'

export type PostComposerContext =
  | { type: 'event'; id: number; title: string }
  | { type: 'todo'; id: number; title: string }
  | null

type DraftPayload = { body: string; context: PostComposerContext }

function ContextBar({
  context,
  onClear
}: {
  context: PostComposerContext
  onClear: () => void
}): React.JSX.Element | null {
  if (!context) return null

  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
      style={{ background: 'color-mix(in srgb, var(--background) 72%, var(--card) 28%)' }}
    >
      <span className="text-muted-foreground">Context</span>
      <Badge variant="outline" className="gap-1 border-transparent bg-background/70 text-[11px]">
        {context.title}
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 rounded-sm hover:bg-muted"
          aria-label="Remove context"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    </div>
  )
}

export function PostComposer({
  currentContext,
  onClearContext,
  onSubmit,
  onSelectContext,
  todosForSuggestion,
  compact,
  draftStorageKey
}: {
  currentContext: PostComposerContext
  onClearContext: () => void
  onSubmit: (body: string) => void
  onSelectContext: (ctx: PostComposerContext) => void
  todosForSuggestion: Todo[]
  /** Narrow layout for Today sidebar */
  compact?: boolean
  /** When set, draft text + context are persisted to localStorage under this key */
  draftStorageKey?: string
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [showHashPanel, setShowHashPanel] = useState(false)
  const [hashQuery, setHashQuery] = useState('')
  const [activeHashIndex, setActiveHashIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** Avoid clobbering storage before the first read from localStorage completes */
  const draftHydratedRef = useRef(false)
  const isMac = isMacPlatform()

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  // Restore draft when key changes (e.g. new calendar day)
  useEffect(() => {
    draftHydratedRef.current = false
    if (!draftStorageKey || typeof localStorage === 'undefined') {
      setValue('')
      draftHydratedRef.current = true
      return
    }
    try {
      const raw = localStorage.getItem(draftStorageKey)
      if (!raw) {
        setValue('')
      } else {
        const parsed = JSON.parse(raw) as DraftPayload
        if (typeof parsed.body === 'string') setValue(parsed.body)
        if (parsed.context && (parsed.context.type === 'event' || parsed.context.type === 'todo')) {
          onSelectContext(parsed.context)
        }
      }
    } catch {
      setValue('')
    } finally {
      draftHydratedRef.current = true
    }
  }, [draftStorageKey, onSelectContext])

  useEffect(() => {
    if (!draftStorageKey || typeof localStorage === 'undefined') return
    if (!draftHydratedRef.current) return
    const id = window.setTimeout(() => {
      try {
        const payload: DraftPayload = { body: value, context: currentContext }
        localStorage.setItem(draftStorageKey, JSON.stringify(payload))
      } catch {
        /* quota or private mode */
      }
    }, 300)
    return () => window.clearTimeout(id)
  }, [value, currentContext, draftStorageKey])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setValue(v)

    const cursorPos = e.target.selectionStart
    const textBeforeCursor = v.slice(0, cursorPos)
    const lastHash = textBeforeCursor.lastIndexOf('#')
    if (lastHash !== -1 && !textBeforeCursor.slice(lastHash + 1).includes(' ')) {
      setShowHashPanel(true)
      setHashQuery(textBeforeCursor.slice(lastHash + 1).toLowerCase())
      setActiveHashIndex(0)
    } else {
      setShowHashPanel(false)
      setHashQuery('')
      setActiveHashIndex(0)
    }
  }, [])

  const handleSelectTodo = useCallback(
    (todo: Todo) => {
      onSelectContext({ type: 'todo', id: todo.id, title: todo.title })
      const cursorPos = textareaRef.current?.selectionStart ?? value.length
      const textBeforeCursor = value.slice(0, cursorPos)
      const lastHash = textBeforeCursor.lastIndexOf('#')
      if (lastHash !== -1) {
        setValue(value.slice(0, lastHash) + value.slice(cursorPos))
      }
      setShowHashPanel(false)
      setHashQuery('')
      setActiveHashIndex(0)
      textareaRef.current?.focus()
    },
    [value, onSelectContext]
  )

  const filteredTodos = useMemo(() => {
    if (!hashQuery) return todosForSuggestion
    return todosForSuggestion.filter((t) => t.title.toLowerCase().includes(hashQuery))
  }, [todosForSuggestion, hashQuery])

  useEffect(() => {
    if (filteredTodos.length === 0) {
      setActiveHashIndex(0)
      return
    }
    setActiveHashIndex((prev) => Math.min(prev, filteredTodos.length - 1))
  }, [filteredTodos])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
    setShowHashPanel(false)
    if (draftStorageKey && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(draftStorageKey)
      } catch {
        /* ignore */
      }
    }
  }, [value, onSubmit, draftStorageKey])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
        return
      }
      if (showHashPanel && e.key === 'Enter' && filteredTodos.length > 0) {
        e.preventDefault()
        handleSelectTodo(filteredTodos[activeHashIndex]!)
        return
      }
      if (showHashPanel && e.key === 'ArrowDown' && filteredTodos.length > 0) {
        e.preventDefault()
        setActiveHashIndex((prev) => (prev + 1) % filteredTodos.length)
        return
      }
      if (showHashPanel && e.key === 'ArrowUp' && filteredTodos.length > 0) {
        e.preventDefault()
        setActiveHashIndex((prev) => (prev - 1 + filteredTodos.length) % filteredTodos.length)
        return
      }
      if (e.key === 'Escape') {
        setShowHashPanel(false)
      }
    },
    [handleSubmit, showHashPanel, filteredTodos, activeHashIndex, handleSelectTodo]
  )

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      <ContextBar context={currentContext} onClear={onClearContext} />

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write something... (type # to tag a todo)"
          rows={compact ? 2 : 2}
          className={`resize-none pr-12 border-transparent bg-background/55 shadow-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            compact ? 'min-h-[52px] text-xs' : 'min-h-[148px] text-sm leading-relaxed'
          }`}
        />
        <Button
          size="sm"
          variant="default"
          className="absolute bottom-2 right-2 h-7 w-7 p-0 rounded-full"
          style={{ background: 'var(--amber)' }}
          disabled={!value.trim()}
          onClick={handleSubmit}
          title="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>

        {showHashPanel && (
          <Card className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto border-border/60 bg-card/95">
            {filteredTodos.length === 0 ? (
              <div className="flex gap-2 p-3 text-sm text-muted-foreground">
                <Hash className="h-4 w-4 shrink-0" />
                <span>No matching todos</span>
              </div>
            ) : (
              <div className="py-1">
                {filteredTodos.map((todo) => (
                  <button
                    key={todo.id}
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left ${
                      filteredTodos[activeHashIndex]?.id === todo.id ? 'bg-muted/60' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelectTodo(todo)}
                    onMouseEnter={() =>
                      setActiveHashIndex(filteredTodos.findIndex((item) => item.id === todo.id))
                    }
                  >
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{todo.title}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <span className="text-[11px] text-muted-foreground">
        Press {isMac ? '⌘' : 'Ctrl'}+Enter to post
      </span>
    </div>
  )
}
