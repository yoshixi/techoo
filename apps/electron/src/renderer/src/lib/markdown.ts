export function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\n+$/g, '').trim()
}

export function isMarkdownBlank(value: string): boolean {
  return normalizeMarkdown(value).length === 0
}

export function getParagraphHashQuery(textBeforeCursor: string): string | null {
  const lastHash = textBeforeCursor.lastIndexOf('#')
  if (lastHash === -1) return null
  const after = textBeforeCursor.slice(lastHash + 1)
  if (after.includes(' ') || after.includes('\n')) return null
  return after.toLowerCase()
}
