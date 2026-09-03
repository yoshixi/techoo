import { applyLink, toggleLinePrefix, wrapSelection } from '../../lib/markdownFormat'

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
})
