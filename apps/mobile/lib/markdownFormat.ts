export type TextSelection = { start: number; end: number }

export type FormatResult = {
  text: string
  selection: TextSelection
}

function clampSelection(text: string, selection: TextSelection): TextSelection {
  const start = Math.max(0, Math.min(selection.start, selection.end, text.length))
  const end = Math.max(start, Math.min(Math.max(selection.start, selection.end), text.length))
  return { start, end }
}

export function wrapSelection(
  text: string,
  selection: TextSelection,
  before: string,
  after: string = before
): FormatResult {
  const { start, end } = clampSelection(text, selection)
  const selected = text.slice(start, end) || 'text'
  const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`
  const innerStart = start + before.length
  return {
    text: next,
    selection: {
      start: innerStart,
      end: innerStart + selected.length
    }
  }
}

export function toggleLinePrefix(
  text: string,
  selection: TextSelection,
  prefix: string
): FormatResult {
  const { start, end } = clampSelection(text, selection)
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIdx = text.indexOf('\n', end)
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx
  const block = text.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const allPrefixed = lines.every((line) => line.startsWith(prefix) || line.length === 0)
  const nextLines = lines.map((line) => {
    if (line.length === 0) return line
    if (allPrefixed) return line.slice(prefix.length)
    if (line.startsWith(prefix)) return line
    return `${prefix}${line}`
  })
  const nextBlock = nextLines.join('\n')
  const next = `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`
  const delta = nextBlock.length - block.length
  return {
    text: next,
    selection: {
      start: lineStart,
      end: lineEnd + delta
    }
  }
}

export function applyLink(
  text: string,
  selection: TextSelection,
  url: string
): FormatResult {
  const { start, end } = clampSelection(text, selection)
  const label = text.slice(start, end) || 'link'
  const href = url.trim()
  const snippet = `[${label}](${href})`
  const next = `${text.slice(0, start)}${snippet}${text.slice(end)}`
  return {
    text: next,
    selection: {
      start: start + snippet.length,
      end: start + snippet.length
    }
  }
}

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
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

function hasCode(event: MarkdownShortcutEvent, code: string): boolean {
  return event.code === code
}

export function matchMarkdownShortcut(event: MarkdownShortcutEvent): MarkdownShortcutAction | null {
  const mod = Boolean(event.metaKey || event.ctrlKey)
  if (!mod) return null
  if (event.key === 'Enter') return null

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const shift = Boolean(event.shiftKey)
  const alt = Boolean(event.altKey)

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

export function applyMarkdownShortcut(
  text: string,
  selection: TextSelection,
  action: MarkdownShortcutAction
): FormatResult {
  switch (action) {
    case 'bold':
      return wrapSelection(text, selection, '**')
    case 'italic':
      return wrapSelection(text, selection, '*')
    case 'strike':
      return wrapSelection(text, selection, '~~')
    case 'code':
      return wrapSelection(text, selection, '`')
    case 'codeBlock':
      return wrapSelection(text, selection, '```\n', '\n```')
    case 'link':
      return applyLink(text, selection, 'https://')
    case 'heading':
      return toggleLinePrefix(text, selection, '## ')
    case 'bulletList':
      return toggleLinePrefix(text, selection, '- ')
    case 'orderedList':
      return toggleLinePrefix(text, selection, '1. ')
    case 'taskList':
      return toggleLinePrefix(text, selection, '- [ ] ')
    case 'blockquote':
      return toggleLinePrefix(text, selection, '> ')
  }
}

export function applyMarkdownShortcutFromKeyEvent(
  text: string,
  selection: TextSelection,
  nativeEvent: unknown
): FormatResult | null {
  if (!nativeEvent || typeof nativeEvent !== 'object') return null
  const raw = nativeEvent as Record<string, unknown>
  const key = typeof raw.key === 'string' ? raw.key : ''
  if (!key) return null
  const action = matchMarkdownShortcut({
    key,
    code: typeof raw.code === 'string' ? raw.code : undefined,
    metaKey: Boolean(raw.metaKey),
    ctrlKey: Boolean(raw.ctrlKey),
    shiftKey: Boolean(raw.shiftKey),
    altKey: Boolean(raw.altKey)
  })
  if (!action) return null
  return applyMarkdownShortcut(text, selection, action)
}
