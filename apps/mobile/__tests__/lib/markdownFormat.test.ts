import {
  applyLink,
  applyMarkdownShortcut,
  matchMarkdownShortcut,
  toggleLinePrefix,
  wrapSelection
} from '../../lib/markdownFormat'

describe('markdownFormat', () => {
  describe('wrapSelection', () => {
    it('wraps the selected text', () => {
      expect(wrapSelection('hello world', { start: 0, end: 5 }, '**')).toEqual({
        text: '**hello** world',
        selection: { start: 2, end: 7 }
      })
    })

    it('inserts a placeholder when the selection is empty', () => {
      expect(wrapSelection('ab', { start: 1, end: 1 }, '`')).toEqual({
        text: 'a`text`b',
        selection: { start: 2, end: 6 }
      })
    })
  })

  describe('toggleLinePrefix', () => {
    it('prefixes the current line', () => {
      expect(toggleLinePrefix('one\ntwo', { start: 5, end: 5 }, '- ')).toEqual({
        text: 'one\n- two',
        selection: { start: 4, end: 9 }
      })
    })

    it('removes the prefix when every selected line already has it', () => {
      expect(toggleLinePrefix('- one\n- two', { start: 0, end: 11 }, '- ')).toEqual({
        text: 'one\ntwo',
        selection: { start: 0, end: 7 }
      })
    })
  })

  describe('applyLink', () => {
    it('turns the selection into a markdown link', () => {
      expect(applyLink('see docs', { start: 4, end: 8 }, 'https://example.com')).toEqual({
        text: 'see [docs](https://example.com)',
        selection: { start: 31, end: 31 }
      })
    })
  })

  describe('matchMarkdownShortcut', () => {
    it('maps cmd/ctrl+b and cmd/ctrl+i', () => {
      expect(
        matchMarkdownShortcut({ key: 'b', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })
      ).toBe('bold')
      expect(
        matchMarkdownShortcut({ key: 'i', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })
      ).toBe('italic')
    })

    it('does not steal Enter submit or unmodified letters', () => {
      expect(
        matchMarkdownShortcut({
          key: 'Enter',
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false
        })
      ).toBeNull()
      expect(
        matchMarkdownShortcut({ key: 'b', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })
      ).toBeNull()
    })

    it('maps Slack-style code, link, and code-block shortcuts', () => {
      expect(
        matchMarkdownShortcut({
          key: 'c',
          metaKey: true,
          ctrlKey: false,
          shiftKey: true,
          altKey: false
        })
      ).toBe('code')
      expect(
        matchMarkdownShortcut({
          key: 'u',
          metaKey: true,
          ctrlKey: false,
          shiftKey: true,
          altKey: false
        })
      ).toBe('link')
      expect(
        matchMarkdownShortcut({
          key: 'c',
          metaKey: true,
          ctrlKey: false,
          shiftKey: true,
          altKey: true
        })
      ).toBe('codeBlock')
    })

    it('maps quote to shift+9 and checklist to shift+0', () => {
      expect(
        matchMarkdownShortcut({
          key: '(',
          code: 'Digit9',
          metaKey: true,
          ctrlKey: false,
          shiftKey: true,
          altKey: false
        })
      ).toBe('blockquote')
      expect(
        matchMarkdownShortcut({
          key: ')',
          code: 'Digit0',
          metaKey: true,
          ctrlKey: false,
          shiftKey: true,
          altKey: false
        })
      ).toBe('taskList')
    })

    it('does not use the old cmd+e / cmd+k bindings', () => {
      expect(
        matchMarkdownShortcut({
          key: 'e',
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false
        })
      ).toBeNull()
      expect(
        matchMarkdownShortcut({
          key: 'k',
          ctrlKey: true,
          metaKey: false,
          shiftKey: false,
          altKey: false
        })
      ).toBeNull()
    })
  })

  describe('applyMarkdownShortcut', () => {
    it('wraps the selection in bold markers', () => {
      expect(applyMarkdownShortcut('hello', { start: 0, end: 5 }, 'bold')).toEqual({
        text: '**hello**',
        selection: { start: 2, end: 7 }
      })
    })

    it('wraps the selection in a fenced code block', () => {
      expect(applyMarkdownShortcut('hello', { start: 0, end: 5 }, 'codeBlock')).toEqual({
        text: '```\nhello\n```',
        selection: { start: 4, end: 9 }
      })
    })
  })
})
