import React, { useCallback } from 'react'
import { Button } from './ui/button'
import { ExpandingTextarea } from './ui/expanding-textarea'
import { isMacPlatform } from '../lib/platform'

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
  const canSubmit = !submitting && !disabled && Boolean(value.trim())

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape' && onCancel) {
        event.preventDefault()
        onCancel()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (canSubmit) onSubmit()
      }
    },
    [canSubmit, onCancel, onSubmit]
  )

  return (
    <div className="space-y-2">
      <ExpandingTextarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        autoFocus={autoFocus}
        className="min-h-[96px] text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Press {isMac ? '⌘' : 'Ctrl'}+Enter to {submitLabel.toLowerCase()}
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
