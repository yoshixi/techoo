import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Send, Hash, X, Star, List as ListIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import type { PostList, Todo } from '../gen/api/schemas'
import { isMacPlatform } from '../lib/platform'
import { isMarkdownBlank } from '../lib/markdown'
import {
  emptyPostComposerAssociations,
  type PostComposerAssociations
} from '../lib/post-composer-associations'
import { MarkdownEditor, type MarkdownEditorHandle } from './markdown/MarkdownEditor'

export type { PostComposerAssociations }

type DraftPayload = { body: string; associations: PostComposerAssociations }

type HashSuggestion =
  | { kind: 'favorite'; key: 'favorite'; label: string }
  | { kind: 'list'; key: string; list: { id: number; name: string } }
  | { kind: 'todo'; key: string; todo: Todo }

function AssociationsBar({
  associations,
  onChange
}: {
  associations: PostComposerAssociations
  onChange: (next: PostComposerAssociations) => void
}): React.JSX.Element | null {
  const hasAny =
    associations.event ||
    associations.todo ||
    associations.favorite ||
    associations.lists.length > 0
  if (!hasAny) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-full px-3 py-1.5 text-xs"
      style={{ background: 'color-mix(in srgb, var(--background) 72%, var(--card) 28%)' }}
    >
      <span className="text-muted-foreground shrink-0">Linked</span>
      {associations.event ? (
        <Badge variant="outline" className="gap-1 border-transparent bg-background/70 text-[11px]">
          {associations.event.title}
          <button
            type="button"
            onClick={() => onChange({ ...associations, event: null })}
            className="ml-0.5 rounded-sm hover:bg-muted"
            aria-label="Remove event link"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ) : null}
      {associations.todo ? (
        <Badge variant="outline" className="gap-1 border-transparent bg-background/70 text-[11px]">
          {associations.todo.title}
          <button
            type="button"
            onClick={() => onChange({ ...associations, todo: null })}
            className="ml-0.5 rounded-sm hover:bg-muted"
            aria-label="Remove todo link"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ) : null}
      {associations.favorite ? (
        <Badge variant="outline" className="gap-1 border-transparent bg-background/70 text-[11px]">
          <Star className="h-3 w-3 fill-current" />
          Favorites
          <button
            type="button"
            onClick={() => onChange({ ...associations, favorite: false })}
            className="ml-0.5 rounded-sm hover:bg-muted"
            aria-label="Remove favorite link"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ) : null}
      {associations.lists.map((list) => (
        <Badge
          key={list.id}
          variant="outline"
          className="gap-1 border-transparent bg-background/70 text-[11px]"
        >
          <ListIcon className="h-3 w-3" />
          {list.name}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...associations,
                lists: associations.lists.filter((item) => item.id !== list.id)
              })
            }
            className="ml-0.5 rounded-sm hover:bg-muted"
            aria-label={`Remove ${list.name} list link`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

function parseDraftAssociations(raw: unknown): PostComposerAssociations {
  const base = emptyPostComposerAssociations()
  if (!raw || typeof raw !== 'object') return base

  const record = raw as Record<string, unknown>

  if (record.associations && typeof record.associations === 'object') {
    const a = record.associations as PostComposerAssociations
    return {
      event: a.event ?? null,
      todo: a.todo ?? null,
      favorite: Boolean(a.favorite),
      lists: Array.isArray(a.lists) ? a.lists : []
    }
  }

  const legacy = record.context as
    | { type: 'event' | 'todo'; id: number; title: string }
    | null
    | undefined
  if (legacy?.type === 'event') {
    return { ...base, event: { id: legacy.id, title: legacy.title } }
  }
  if (legacy?.type === 'todo') {
    return { ...base, todo: { id: legacy.id, title: legacy.title } }
  }
  return base
}

export function PostComposer({
  associations,
  onAssociationsChange,
  onSubmit,
  todosForSuggestion,
  listsForSuggestion,
  compact,
  draftStorageKey
}: {
  associations: PostComposerAssociations
  onAssociationsChange: (next: PostComposerAssociations) => void
  onSubmit: (body: string) => void
  todosForSuggestion: Todo[]
  listsForSuggestion: PostList[]
  /** Narrow layout for Today sidebar */
  compact?: boolean
  /** When set, draft text + associations are persisted to localStorage under this key */
  draftStorageKey?: string
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [showHashPanel, setShowHashPanel] = useState(false)
  const [hashQuery, setHashQuery] = useState('')
  const [activeHashIndex, setActiveHashIndex] = useState(0)
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const draftHydratedRef = useRef(false)
  const isMac = isMacPlatform()

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
        const parsed = JSON.parse(raw) as DraftPayload & { context?: unknown }
        if (typeof parsed.body === 'string') setValue(parsed.body)
        onAssociationsChange(parseDraftAssociations(parsed))
      }
    } catch {
      setValue('')
    } finally {
      draftHydratedRef.current = true
    }
  }, [draftStorageKey, onAssociationsChange])

  useEffect(() => {
    if (!draftStorageKey || typeof localStorage === 'undefined') return
    if (!draftHydratedRef.current) return
    const id = window.setTimeout(() => {
      try {
        const payload: DraftPayload = { body: value, associations }
        localStorage.setItem(draftStorageKey, JSON.stringify(payload))
      } catch {
        /* quota or private mode */
      }
    }, 300)
    return () => window.clearTimeout(id)
  }, [value, associations, draftStorageKey])

  const hashSuggestions = useMemo((): HashSuggestion[] => {
    if (!showHashPanel) return []
    const q = hashQuery.trim().toLowerCase()
    const items: HashSuggestion[] = []

    if (!associations.favorite && (!q || 'favorites'.includes(q) || 'favorite'.includes(q))) {
      items.push({ kind: 'favorite', key: 'favorite', label: 'Favorites' })
    }

    for (const list of listsForSuggestion) {
      if (associations.lists.some((item) => item.id === list.id)) continue
      if (q && !list.name.toLowerCase().includes(q)) continue
      items.push({ kind: 'list', key: `list:${list.id}`, list: { id: list.id, name: list.name } })
    }

    for (const todo of todosForSuggestion) {
      if (q && !todo.title.toLowerCase().includes(q)) continue
      items.push({ kind: 'todo', key: `todo:${todo.id}`, todo })
    }

    return items
  }, [associations, hashQuery, listsForSuggestion, showHashPanel, todosForSuggestion])

  const removeHashToken = useCallback(() => {
    editorRef.current?.removeHashToken()
    setShowHashPanel(false)
    setHashQuery('')
    setActiveHashIndex(0)
    editorRef.current?.focus()
  }, [])

  const handleSelectHashItem = useCallback(
    (item: HashSuggestion) => {
      if (item.kind === 'favorite') {
        onAssociationsChange({ ...associations, favorite: true })
      } else if (item.kind === 'list') {
        onAssociationsChange({
          ...associations,
          lists: [...associations.lists, item.list]
        })
      } else {
        onAssociationsChange({
          ...associations,
          todo: { id: item.todo.id, title: item.todo.title }
        })
      }
      removeHashToken()
    },
    [associations, onAssociationsChange, removeHashToken]
  )

  const handleChange = useCallback((next: string) => {
    setValue(next)
  }, [])

  const handleHashQuery = useCallback((query: string | null) => {
    if (query == null) {
      setShowHashPanel(false)
      setHashQuery('')
      setActiveHashIndex(0)
      return
    }
    setShowHashPanel(true)
    setHashQuery(query)
    setActiveHashIndex(0)
  }, [])

  useEffect(() => {
    if (hashSuggestions.length === 0) {
      setActiveHashIndex(0)
      return
    }
    setActiveHashIndex((prev) => Math.min(prev, hashSuggestions.length - 1))
  }, [hashSuggestions])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (isMarkdownBlank(trimmed)) return
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

  const handleEditorKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showHashPanel && e.key === 'Enter' && hashSuggestions.length > 0) {
        e.preventDefault()
        handleSelectHashItem(hashSuggestions[activeHashIndex]!)
        return true
      }
      if (showHashPanel && e.key === 'ArrowDown' && hashSuggestions.length > 0) {
        e.preventDefault()
        setActiveHashIndex((prev) => (prev + 1) % hashSuggestions.length)
        return true
      }
      if (showHashPanel && e.key === 'ArrowUp' && hashSuggestions.length > 0) {
        e.preventDefault()
        setActiveHashIndex((prev) => (prev - 1 + hashSuggestions.length) % hashSuggestions.length)
        return true
      }
      if (e.key === 'Escape' && showHashPanel) {
        setShowHashPanel(false)
        return true
      }
      return false
    },
    [showHashPanel, hashSuggestions, activeHashIndex, handleSelectHashItem]
  )

  const hashItemIcon = (item: HashSuggestion): React.JSX.Element => {
    if (item.kind === 'favorite') return <Star className="h-3.5 w-3.5 shrink-0" />
    if (item.kind === 'list') return <ListIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    return <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  }

  const hashItemLabel = (item: HashSuggestion): string => {
    if (item.kind === 'favorite') return item.label
    if (item.kind === 'list') return item.list.name
    return item.todo.title
  }

  const hashItemMeta = (item: HashSuggestion): string => {
    if (item.kind === 'favorite') return 'Favorite'
    if (item.kind === 'list') return 'List'
    return 'To-do'
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      <AssociationsBar associations={associations} onChange={onAssociationsChange} />

      <div className="relative">
        <MarkdownEditor
          editorRef={editorRef}
          value={value}
          onChange={handleChange}
          onHashQuery={handleHashQuery}
          onKeyDown={handleEditorKeyDown}
          onSubmit={handleSubmit}
          compact={compact}
          placeholder="Write something... (type # to link to-do, list, or favorite)"
          className="border-transparent bg-background/55 shadow-none"
          contentClassName={compact ? 'pr-12 pb-8' : 'is-composer-tall pr-12 pb-8'}
        />
        <Button
          size="sm"
          variant="default"
          className="absolute bottom-2 right-2 h-7 w-7 p-0 rounded-full"
          style={{ background: 'var(--amber)' }}
          disabled={isMarkdownBlank(value)}
          onClick={handleSubmit}
          title="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>

        {showHashPanel && (
          <Card className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto border-border/60 bg-card/95">
            {hashSuggestions.length === 0 ? (
              <div className="flex gap-2 p-3 text-sm text-muted-foreground">
                <Hash className="h-4 w-4 shrink-0" />
                <span>No matching to-dos, lists, or favorites</span>
              </div>
            ) : (
              <div className="py-1">
                {hashSuggestions.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left ${
                      hashSuggestions[activeHashIndex]?.key === item.key
                        ? 'bg-muted/60'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelectHashItem(item)}
                    onMouseEnter={() => setActiveHashIndex(index)}
                  >
                    {hashItemIcon(item)}
                    <span className="min-w-0 flex-1 truncate">{hashItemLabel(item)}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {hashItemMeta(item)}
                    </span>
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
