import React, { useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/utils'

function safeHref(href?: string): string | undefined {
  if (!href) return undefined
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href
  return undefined
}

export function MarkdownView({
  content,
  className,
  compact = false
}: {
  content: string
  className?: string
  compact?: boolean
}): React.JSX.Element {
  const handleLinkClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
    if (!href) return
    event.preventDefault()
    window.open(href, '_blank', 'noopener,noreferrer')
  }, [])

  if (!content.trim()) {
    return <div className={cn('markdown-body', compact && 'markdown-body-compact', className)} />
  }

  return (
    <div className={cn('markdown-body', compact && 'markdown-body-compact', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const safe = safeHref(href)
            if (!safe) return <span>{children}</span>
            return (
              <a
                href={safe}
                className="underline underline-offset-2 text-primary/90 hover:text-primary"
                onClick={(event) => handleLinkClick(event, safe)}
              >
                {children}
              </a>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
