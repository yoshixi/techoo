export type MarkdownShortcutAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'codeBlock'
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
 * Slack-style formatting shortcuts.
 * Uses `code` so Shift+7/8/9/0 still match on US layouts where `key` becomes &, *, (, ).
 */
export function matchMarkdownShortcut(event: MarkdownShortcutEvent): MarkdownShortcutAction | null {
  if (!isMod(event)) return null
  if (event.key === 'Enter') return null

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const shift = event.shiftKey
  const alt = event.altKey

  if (shift && alt) {
    if (key === 'c' || hasCode(event, 'KeyC')) return 'codeBlock'
    return null
  }

  if (alt && !shift) {
    if (hasCode(event, 'Digit2') || key === '2') return 'heading'
    return null
  }

  if (shift && !alt) {
    if (key === 'x' || hasCode(event, 'KeyX')) return 'strike'
    if (key === 'c' || hasCode(event, 'KeyC')) return 'code'
    if (key === 'u' || hasCode(event, 'KeyU')) return 'link'
    if (hasCode(event, 'Digit8') || key === '8' || key === '*') return 'bulletList'
    if (hasCode(event, 'Digit7') || key === '7' || key === '&') return 'orderedList'
    if (hasCode(event, 'Digit9') || key === '9' || key === '(') return 'blockquote'
    if (hasCode(event, 'Digit0') || key === '0' || key === ')') return 'taskList'
    return null
  }

  if (!shift && !alt) {
    if (key === 'b' || hasCode(event, 'KeyB')) return 'bold'
    if (key === 'i' || hasCode(event, 'KeyI')) return 'italic'
  }

  return null
}

/** Tiptap defaults that are not Slack; swallow so they do not fire. */
export function isConflictingEditorShortcut(event: MarkdownShortcutEvent): boolean {
  if (!isMod(event) || matchMarkdownShortcut(event)) return false
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const shift = event.shiftKey
  const alt = event.altKey
  if (!shift && !alt && (key === 'e' || hasCode(event, 'KeyE'))) return true
  if (!shift && !alt && (key === 'k' || hasCode(event, 'KeyK'))) return true
  if (shift && !alt && (key === 's' || hasCode(event, 'KeyS'))) return true
  if (shift && !alt && (key === 'b' || hasCode(event, 'KeyB'))) return true
  if (!shift && alt && (key === 'c' || hasCode(event, 'KeyC'))) return true
  return false
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
