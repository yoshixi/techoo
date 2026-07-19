import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { X, Pencil, Check } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { AddPostToListDialog, PostRowListAction } from './AddPostToListDialog'
import { FavoriteStarButton } from './FavoriteStarButton'
import { usePostLists } from '../hooks/usePostLists'
import type { Post } from '../gen/api/schemas'

const URL_REGEX = /(https?:\/\/[^\s]+)/g
const URL_PART_REGEX = /^https?:\/\/[^\s]+$/

function renderTextWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX)
  return parts.map((part, idx) => {
    if (!URL_PART_REGEX.test(part)) return <React.Fragment key={`txt-${idx}`}>{part}</React.Fragment>
    return (
      <a
        key={`url-${idx}`}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 text-primary/90 hover:text-primary"
        onClick={(event) => {
          event.preventDefault()
          window.open(part, '_blank', 'noopener,noreferrer')
        }}
      >
        {part}
      </a>
    )
  })
}

function PostRowActions({
  post,
  canEdit,
  showCollectionActions,
  onFavoriteToggled,
  onListDialogOpen,
  onStartEdit,
  onDelete,
  compact
}: {
  post: Post
  canEdit: boolean
  showCollectionActions: boolean
  onFavoriteToggled?: () => void
  onListDialogOpen: () => void
  onStartEdit: () => void
  onDelete: (id: number) => void
  compact: boolean
}): React.JSX.Element {
  const iconBtn = compact ? 'h-6 w-6' : 'h-7 w-7'
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'

  return (
    <div className={`flex shrink-0 flex-col ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {showCollectionActions ? (
        <FavoriteStarButton post={post} onToggled={onFavoriteToggled} />
      ) : null}
      <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1'} opacity-0 group-hover:opacity-100`}>
        {showCollectionActions ? (
          <PostRowListAction onListDialogOpen={onListDialogOpen} />
        ) : null}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconBtn} p-0 text-muted-foreground hover:text-foreground`}
            onClick={onStartEdit}
            title="Edit post"
          >
            <Pencil className={iconSize} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={`${iconBtn} p-0 text-destructive hover:text-destructive`}
          onClick={() => onDelete(post.id)}
          title="Delete post"
        >
          <X className={iconSize} />
        </Button>
      </div>
    </div>
  )
}

function PostAssociationTags({
  post,
  listEntries,
  compact
}: {
  post: Post
  listEntries: Array<{ id: number; name: string }>
  compact: boolean
}): React.JSX.Element | null {
  const hasAny = listEntries.length > 0 || post.todos.length > 0 || post.events.length > 0
  if (!hasAny) return null

  const tagClass = compact
    ? 'text-[9px] px-1.5 py-0 h-4 border-transparent bg-background/70 text-muted-foreground'
    : 'text-[10px] px-2 py-0 h-5 border-transparent bg-background/70 text-muted-foreground'

  return (
    <div className={`mt-auto flex flex-wrap pt-2 ${compact ? 'gap-0.5' : 'gap-1.5'}`}>
      {listEntries.map((list) => (
        <Badge key={`list-${list.id}`} variant="outline" className={tagClass}>
          #{list.name}
        </Badge>
      ))}
      {post.todos.map((todo) => (
        <Badge key={`todo-${todo.id}`} variant="outline" className={tagClass}>
          #{todo.title}
        </Badge>
      ))}
      {post.events.map((event) => (
        <Badge key={`event-${event.id}`} variant="outline" className={tagClass}>
          #{event.title}
        </Badge>
      ))}
    </div>
  )
}

export function PostRow({
  post,
  onDelete,
  onUpdatePost,
  variant = 'default',
  showCollectionActions = true,
  onFavoriteToggled
}: {
  post: Post
  onDelete: (id: number) => void
  onUpdatePost?: (id: number, body: string) => Promise<void>
  variant?: 'default' | 'compact'
  showCollectionActions?: boolean
  onFavoriteToggled?: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const [saving, setSaving] = useState(false)
  const [listDialogOpen, setListDialogOpen] = useState(false)
  const { lists } = usePostLists()

  const listEntries = useMemo(
    () =>
      post.list_ids
        .map((id) => lists.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => item != null),
    [lists, post.list_ids]
  )

  const canEdit = Boolean(onUpdatePost) && post.id > 0
  const compact = variant === 'compact'

  useEffect(() => {
    if (!editing) setDraft(post.body)
  }, [post.body, post.id, editing])

  const timeStr = new Date(post.posted_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

  const handleStartEdit = useCallback(() => {
    setDraft(post.body)
    setEditing(true)
  }, [post.body])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setDraft(post.body)
  }, [post.body])

  const handleSave = useCallback(async () => {
    if (!onUpdatePost) return
    const trimmed = draft.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onUpdatePost(post.id, trimmed)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [draft, onUpdatePost, post.id])

  const shellClass = compact
    ? 'group rounded-md border bg-card/80 px-2 py-1.5'
    : 'group rounded-xl px-3 py-2.5 transition-colors'

  const shellStyle = compact
    ? { borderColor: 'var(--border-l)' }
    : { background: 'color-mix(in srgb, var(--background) 70%, var(--card) 30%)' }

  const bodyClass = compact
    ? 'text-[11px] leading-snug whitespace-pre-wrap line-clamp-3'
    : 'text-[13px] leading-relaxed whitespace-pre-wrap'

  const bodyStyle = compact ? undefined : { color: 'var(--text-dark)' }

  return (
    <>
      <div className={shellClass} style={shellStyle}>
        {editing ? (
          <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={
                compact
                  ? 'min-h-[72px] resize-y text-[11px] leading-snug'
                  : 'min-h-[100px] resize-y text-sm'
              }
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancel()
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void handleSave()
                }
              }}
            />
            <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`}>
              <Button
                type="button"
                size="sm"
                className={compact ? 'h-6 px-2 text-[10px]' : 'h-8 gap-1 text-xs'}
                disabled={saving || !draft.trim()}
                style={compact ? undefined : { background: 'var(--amber)' }}
                onClick={() => void handleSave()}
              >
                {!compact ? <Check className="h-3.5 w-3.5" /> : null}
                {saving ? (compact ? '…' : 'Saving…') : 'Save'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={compact ? 'h-6 px-2 text-[10px]' : 'h-8 text-xs'}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="mb-1.5 block text-[11px] tabular-nums text-muted-foreground">{timeStr}</span>
              <p className={`min-h-0 flex-1 ${bodyClass}`} style={bodyStyle}>
                {renderTextWithLinks(post.body)}
              </p>
              <PostAssociationTags post={post} listEntries={listEntries} compact={compact} />
            </div>
            <PostRowActions
              post={post}
              canEdit={canEdit}
              showCollectionActions={showCollectionActions}
              onFavoriteToggled={onFavoriteToggled}
              onListDialogOpen={() => setListDialogOpen(true)}
              onStartEdit={handleStartEdit}
              onDelete={onDelete}
              compact={compact}
            />
          </div>
        )}
      </div>
      <AddPostToListDialog post={post} open={listDialogOpen} onOpenChange={setListDialogOpen} />
    </>
  )
}
