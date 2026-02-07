import React, { useCallback, useState } from 'react'
import { Loader2, SendHorizonal } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { useErrorToast } from './ui/toast'
import { createTaskComment } from '../hooks/useTaskComments'

type CommentsPanelProps = {
  taskId: string
  onCommentCreated?: () => void
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({ taskId, onCommentCreated }) => {
  const [draft, setDraft] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMacPlatform = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
  const showError = useErrorToast()

  const handleSubmit = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createTaskComment(taskId, trimmed)
      setDraft('')
      onCommentCreated?.()
    } catch (error) {
      showError(error, 'Failed to add comment')
    } finally {
      setIsSubmitting(false)
    }
  }, [draft, isSubmitting, onCommentCreated, taskId, showError])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="space-y-3">
      <Label htmlFor={`task-comment-${taskId}`} className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Add Comment
      </Label>
      <Textarea
        id={`task-comment-${taskId}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Log progress, blockers, or quick thoughts..."
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Press {isMacPlatform ? '⌘' : 'Ctrl'}+Enter to submit
        </span>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!draft.trim() || isSubmitting}
          className="inline-flex items-center gap-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <SendHorizonal className="h-3.5 w-3.5" />
              Add
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
