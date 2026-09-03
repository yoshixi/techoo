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
