import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type FormEvent,
  type ForwardedRef
} from 'react'

import { cn } from '../../lib/utils'
import { Textarea, type TextareaProps } from './textarea'

function assignRef<T>(ref: ForwardedRef<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

function autosize(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** Textarea that grows with its content instead of showing an inner scrollbar. */
export const ExpandingTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, onInput, rows = 3, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null)

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        assignRef(ref, node)
        autosize(node)
      },
      [ref]
    )

    useEffect(() => {
      autosize(innerRef.current)
    }, [value])

    const handleInput = useCallback(
      (event: FormEvent<HTMLTextAreaElement>) => {
        autosize(event.currentTarget)
        onInput?.(event)
      },
      [onInput]
    )

    return (
      <Textarea
        {...props}
        ref={setRefs}
        value={value}
        rows={rows}
        onInput={handleInput}
        className={cn('resize-none overflow-hidden', className)}
      />
    )
  }
)
ExpandingTextarea.displayName = 'ExpandingTextarea'
