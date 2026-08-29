import React, { useCallback, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { usePostThread } from '../hooks/usePostThread'

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

function formatPostedAt(ts: string): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

export function PostThreadDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: number | null
  open: boolean
  onOpenChange: (next: boolean) => void
}): React.JSX.Element {
  const { root, replies, isLoading, createReply } = usePostThread(open ? postId : null)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,860px)] p-0 overflow-hidden">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Thread</DialogTitle>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-y-auto px-5 py-4 space-y-4">
          {isLoading && !root ? (
            <p className="text-sm text-muted-foreground">Loading thread…</p>
          ) : !root ? (
            <p className="text-sm text-muted-foreground">Thread not found.</p>
          ) : (
            <>
              <div className="rounded-xl border bg-card/70 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderTextWithLinks(root.body)}</p>
                <span className="mt-1.5 block text-[11px] text-muted-foreground">{formatPostedAt(root.posted_at)}</span>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Replies ({orderedReplies.length})</p>
                {orderedReplies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No replies yet.</p>
                ) : (
                  orderedReplies.map((reply) => (
                    <div key={reply.id} className="rounded-xl border bg-card/55 px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderTextWithLinks(reply.body)}</p>
                      <span className="mt-1.5 block text-[11px] text-muted-foreground">
                        {formatPostedAt(reply.posted_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
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
