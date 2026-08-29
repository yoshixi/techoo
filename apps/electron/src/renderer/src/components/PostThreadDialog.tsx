import React, { useCallback, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { PostRow } from './PostRow'
import { usePostThread } from '../hooks/usePostThread'

export function PostThreadDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: number | null
  open: boolean
  onOpenChange: (next: boolean) => void
}): React.JSX.Element {
  const { root, replies, isLoading, createReply, updatePost, deletePost } = usePostThread(open ? postId : null)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const orderedReplies = useMemo(
    () => [...replies].sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime()),
    [replies]
  )

  const handleSubmit = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await createReply(trimmed)
      setDraft('')
    } finally {
      setSubmitting(false)
    }
  }, [draft, submitting, createReply])

  const handleDelete = useCallback(
    async (id: number) => {
      await deletePost(id)
      if (id === postId) onOpenChange(false)
    },
    [deletePost, onOpenChange, postId]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,860px)] p-0 overflow-hidden">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Thread</DialogTitle>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-y-auto px-5 py-4 space-y-3">
          {isLoading && !root ? (
            <p className="text-sm text-muted-foreground">Loading thread…</p>
          ) : !root ? (
            <p className="text-sm text-muted-foreground">Thread not found.</p>
          ) : (
            <>
              <PostRow
                post={root}
                onUpdatePost={updatePost}
                onDelete={(id) => void handleDelete(id)}
                showCollectionActions={false}
              />

              {orderedReplies.length > 0 ? (
                <div className="space-y-2 border-l-2 border-border/70 pl-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {orderedReplies.length} {orderedReplies.length === 1 ? 'reply' : 'replies'}
                  </p>
                  {orderedReplies.map((reply) => (
                    <PostRow
                      key={reply.id}
                      post={reply}
                      variant="compact"
                      onUpdatePost={updatePost}
                      onDelete={(id) => void handleDelete(id)}
                      showCollectionActions={false}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No replies yet.</p>
              )}
            </>
          )}
        </div>

        <div className="border-t px-5 py-4 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply..."
            rows={3}
            className="min-h-[96px] resize-none"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Press Ctrl/Cmd+Enter to reply</span>
            <Button
              type="button"
              size="sm"
              style={{ background: 'var(--amber)' }}
              disabled={submitting || !draft.trim() || !root}
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Posting…' : 'Reply'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
