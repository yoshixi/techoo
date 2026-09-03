export type MarkdownShortcutAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'

export type MarkdownShortcutEvent = {
  key: string
  code?: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

function isMod(event: MarkdownShortcutEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function hasCode(event: MarkdownShortcutEvent, code: string): boolean {
  return event.code === code
}

/**
 * Map a keydown to a formatting action. Enter (submit) is left to the editor.
 * Uses `code` so Shift+7/8/9 still match on US layouts where `key` becomes &, *, (.
 */
export function matchMarkdownShortcut(event: MarkdownShortcutEvent): MarkdownShortcutAction | null {
  if (!isMod(event)) return null
  if (event.key === 'Enter') return null

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const shift = event.shiftKey
  const alt = event.altKey

  if (!shift && !alt) {
    if (key === 'b' || hasCode(event, 'KeyB')) return 'bold'
    if (key === 'i' || hasCode(event, 'KeyI')) return 'italic'
    if (key === 'e' || hasCode(event, 'KeyE')) return 'code'
    if (key === 'k' || hasCode(event, 'KeyK')) return 'link'
    return null
  }

  if (shift && !alt) {
    if (key === 's' || key === 'x' || hasCode(event, 'KeyS') || hasCode(event, 'KeyX')) {
      return 'strike'
    }
    if (hasCode(event, 'Digit8') || key === '8' || key === '*') return 'bulletList'
    if (hasCode(event, 'Digit7') || key === '7' || key === '&') return 'orderedList'
    if (hasCode(event, 'Digit9') || key === '9' || key === '(') return 'taskList'
    if (key === 'b' || hasCode(event, 'KeyB')) return 'blockquote'
    return null
  }

  if (alt && !shift) {
    if (hasCode(event, 'Digit2') || key === '2') return 'heading'
  }

  return null
}

export function formatShortcutHint(isMac: boolean, parts: Array<'Mod' | 'Shift' | 'Alt' | string>): string {
  if (isMac) {
    const symbol = (part: string): string => {
      if (part === 'Mod') return '⌘'
      if (part === 'Shift') return '⇧'
      if (part === 'Alt') return '⌥'
      return part
    }
    const modifiers = (['Alt', 'Shift', 'Mod'] as const)
      .filter((mod) => parts.includes(mod))
      .map(symbol)
    const keys = parts.filter((part) => part !== 'Mod' && part !== 'Shift' && part !== 'Alt').map(symbol)
    return `${modifiers.join('')}${keys.join('')}`
  }
  return parts
    .map((part) => {
      if (part === 'Mod') return 'Ctrl'
      return part
    })
    .join('+')
}
