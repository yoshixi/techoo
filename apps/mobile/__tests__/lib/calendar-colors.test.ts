import { describe, expect, it } from 'vitest'
import {
  CALENDAR_COLOR_PALETTE,
  mergeCalendarColors,
  normalizeHexColor,
  pickRandomCalendarColor,
} from '../../lib/calendar-colors'

describe('normalizeHexColor', () => {
  it('normalizes 6-digit hex to uppercase with hash', () => {
    expect(normalizeHexColor('aabbcc')).toBe('#AABBCC')
    expect(normalizeHexColor('#aAbBcC')).toBe('#AABBCC')
  })

  it('strips alpha channel from 8-digit hex', () => {
    expect(normalizeHexColor('#AABBCC80')).toBe('#AABBCC')
  })

  it('rejects invalid colors', () => {
    expect(normalizeHexColor('red')).toBeNull()
    expect(normalizeHexColor('#fff')).toBeNull()
  })
})

describe('pickRandomCalendarColor', () => {
  it('prefers unused palette colors', () => {
    const used = [CALENDAR_COLOR_PALETTE[0], CALENDAR_COLOR_PALETTE[1]]
    const color = pickRandomCalendarColor(used, () => 0)
    expect(color).toBe(CALENDAR_COLOR_PALETTE[2])
    expect(used).not.toContain(color)
  })

  it('falls back to the full palette when every color is used', () => {
    const color = pickRandomCalendarColor(CALENDAR_COLOR_PALETTE, () => 0)
    expect(color).toBe(CALENDAR_COLOR_PALETTE[0])
  })
})

describe('mergeCalendarColors', () => {
  it('randomly assigns colors to newly seen calendar ids', () => {
    let calls = 0
    const random = () => {
      const values = [0, 0.5, 0.99]
      return values[calls++] ?? 0
    }
    const result = mergeCalendarColors(['1', '2'], {}, random)
    expect(result['1']).toBeTruthy()
    expect(result['2']).toBeTruthy()
    expect(result['1']).not.toBe(result['2'])
  })

  it('keeps existing colors and only fills gaps', () => {
    const existing = { '1': '#D50000' }
    const result = mergeCalendarColors(['1', '2'], existing, () => 0)
    expect(result['1']).toBe('#D50000')
    expect(result['2']).toBe(CALENDAR_COLOR_PALETTE[0])
  })

  it('preserves colors for calendars outside the current batch', () => {
    const existing = { '1': '#4285F4', '9': '#EA4335' }
    const result = mergeCalendarColors(['1'], existing, () => 0)
    expect(result).toEqual({ '1': '#4285F4', '9': '#EA4335' })
  })
})
