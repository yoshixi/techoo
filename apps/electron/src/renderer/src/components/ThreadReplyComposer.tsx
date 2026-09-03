import React, { useCallback } from 'react'
import { Button } from './ui/button'
import { isMacPlatform } from '../lib/platform'
import { isMarkdownBlank } from '../lib/markdown'
import { MarkdownEditor } from './markdown/MarkdownEditor'

export function ThreadReplyComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting = false,
  disabled = false,
  submitLabel = 'Reply',
  submittingLabel = 'Posting…',
  placeholder = 'Write a reply...',
  autoFocus = false
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel?: () => void
  submitting?: boolean
  disabled?: boolean
  submitLabel?: string
  submittingLabel?: string
  placeholder?: string
  autoFocus?: boolean
}): React.JSX.Element {
  const isMac = isMacPlatform()
  const canSubmit = !submitting && !disabled && !isMarkdownBlank(value)

  const handleEscape = useCallback(() => {
    onCancel?.()
  }, [onCancel])

  return (
    <div className="space-y-2">
      <MarkdownEditor
        value={value}
        onChange={onChange}
        onSubmit={canSubmit ? onSubmit : undefined}
        onEscape={onCancel ? handleEscape : undefined}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled || submitting}
        className="min-h-[96px] text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {isMac ? '⌘B' : 'Ctrl+B'} bold · {isMac ? '⌘I' : 'Ctrl+I'} italic ·{' '}
          {isMac ? '⌘' : 'Ctrl'}+Enter to {submitLabel.toLowerCase()}
        </span>
        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            style={{ background: 'var(--amber)' }}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
