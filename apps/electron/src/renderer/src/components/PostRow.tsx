import React, { useState, useCallback, useEffect } from 'react'
import { X, Pencil, Check } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import type { Post } from '../gen/api/schemas'

export function PostRow({
  post,
  onDelete,
  onUpdatePost,
  variant = 'default'
}: {
  post: Post
  onDelete: (id: number) => void
  /** When set, user can edit post body (Posts / Today log) */
  onUpdatePost?: (id: number, body: string) => Promise<void>
  variant?: 'default' | 'compact'
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const [saving, setSaving] = useState(false)

  const canEdit = Boolean(onUpdatePost) && post.id > 0

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

  const badges = (post.events.length > 0 || post.todos.length > 0) && (
    <div className={`flex flex-wrap ${variant === 'compact' ? 'gap-0.5' : 'gap-1'}`}>
      {post.events.map((ev) => (
        <Badge
          key={`ev-${ev.id}`}
          variant="outline"
          className={variant === 'compact' ? 'text-[9px] px-1 py-0 h-4' : 'text-xs'}
        >
          {ev.title}
        </Badge>
      ))}
      {post.todos.map((td) => (
        <Badge
          key={`td-${td.id}`}
          variant="outline"
          className={variant === 'compact' ? 'text-[9px] px-1 py-0 h-4' : 'text-xs'}
        >
          {td.title}
        </Badge>
      ))}
    </div>
  )

  if (variant === 'compact') {
    return (
      <div
        className="group flex items-start gap-2 rounded-md border bg-card/80 px-2 py-1.5"
        style={{ borderColor: 'var(--border-l)' }}
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          {editing ? (
            <div className="space-y-1.5">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[72px] resize-y text-[11px] leading-snug"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancel()
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    void handleSave()
                  }
                }}
              />
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={saving || !draft.trim()}
                  onClick={() => void handleSave()}
                >
                  {saving ? '…' : 'Save'}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[11px] leading-snug whitespace-pre-wrap line-clamp-3">{post.body}</p>
              {badges}
              <span className="text-[10px] text-muted-foreground">{timeStr}</span>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 flex-col gap-0.5 opacity-0 group-hover:opacity-100">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleStartEdit}
                title="Edit post"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(post.id)}
              title="Delete post"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[100px] resize-y text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancel()
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void handleSave()
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={saving || !draft.trim()}
                style={{ background: 'var(--amber)' }}
                onClick={() => void handleSave()}
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">{post.body}</p>
            {badges}
            <span className="block text-xs text-muted-foreground">{timeStr}</span>
          </>
        )}
      </div>

      {!editing && (
        <div className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleStartEdit}
              title="Edit post"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(post.id)}
            title="Delete post"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
