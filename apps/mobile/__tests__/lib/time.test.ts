import {
  formatElapsedTime,
  formatDate,
  formatTime,
  formatDateTime,
  isToday,
  startOfDay,
  endOfDay,
  addDays,
  calculateDurationSeconds
} from '../../lib/time'

describe('time utilities', () => {
  describe('formatElapsedTime', () => {
    it('formats seconds less than a minute', () => {
      expect(formatElapsedTime(45)).toBe('00:45')
    })

    it('formats minutes without hours', () => {
      expect(formatElapsedTime(125)).toBe('02:05')
    })

    it('formats with hours', () => {
      expect(formatElapsedTime(3665)).toBe('01:01:05')
    })

    it('formats zero', () => {
      expect(formatElapsedTime(0)).toBe('00:00')
    })

    it('pads single digits', () => {
      expect(formatElapsedTime(61)).toBe('01:01')
    })
  })

  describe('formatDate', () => {
    it('formats a date object', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatDate(date)
      expect(result).toMatch(/Jan/)
      expect(result).toMatch(/15/)
      expect(result).toMatch(/2024/)
    })

    it('formats a date string', () => {
      const result = formatDate('2024-12-25T00:00:00Z')
      expect(result).toMatch(/Dec/)
      expect(result).toMatch(/25/)
      expect(result).toMatch(/2024/)
    })
  })

  describe('formatTime', () => {
    it('formats time in 12-hour format', () => {
      const date = new Date('2024-01-15T14:30:00')
      const result = formatTime(date)
      expect(result).toMatch(/2:30/)
      expect(result).toMatch(/PM/i)
    })

    it('formats morning time', () => {
      const date = new Date('2024-01-15T09:05:00')
      const result = formatTime(date)
      expect(result).toMatch(/9:05/)
      expect(result).toMatch(/AM/i)
    })
  })

  describe('formatDateTime', () => {
    it('formats date and time together', () => {
      const date = new Date('2024-01-15T14:30:00')
      const result = formatDateTime(date)
      expect(result).toMatch(/Jan/)
      expect(result).toMatch(/15/)
    })
  })

  describe('isToday', () => {
    it('returns true for today', () => {
      expect(isToday(new Date())).toBe(true)
    })

    it('returns false for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isToday(yesterday)).toBe(false)
    })

    it('returns false for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(isToday(tomorrow)).toBe(false)
    })

    it('works with date strings', () => {
      const today = new Date().toISOString()
      expect(isToday(today)).toBe(true)
    })
  })

  describe('startOfDay', () => {
    it('sets time to midnight', () => {
      const date = new Date('2024-01-15T14:30:45.123')
      const result = startOfDay(date)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
    })

    it('preserves the date', () => {
      const date = new Date('2024-01-15T14:30:45.123')
      const result = startOfDay(date)
      expect(result.getDate()).toBe(15)
      expect(result.getMonth()).toBe(0)
      expect(result.getFullYear()).toBe(2024)
    })

    it('does not mutate original date', () => {
      const date = new Date('2024-01-15T14:30:45.123')
      startOfDay(date)
      expect(date.getHours()).toBe(14)
    })
  })

  describe('endOfDay', () => {
    it('sets time to end of day', () => {
      const date = new Date('2024-01-15T14:30:45.123')
      const result = endOfDay(date)
      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
      expect(result.getSeconds()).toBe(59)
      expect(result.getMilliseconds()).toBe(999)
    })

    it('does not mutate original date', () => {
      const date = new Date('2024-01-15T14:30:45.123')
      endOfDay(date)
      expect(date.getHours()).toBe(14)
    })
  })

  describe('addDays', () => {
    it('adds positive days', () => {
      const date = new Date('2024-01-15T10:00:00')
      const result = addDays(date, 5)
      expect(result.getDate()).toBe(20)
    })

    it('subtracts negative days', () => {
      const date = new Date('2024-01-15T10:00:00')
      const result = addDays(date, -5)
      expect(result.getDate()).toBe(10)
    })

    it('handles month boundaries', () => {
      const date = new Date('2024-01-31T10:00:00')
      const result = addDays(date, 1)
      expect(result.getDate()).toBe(1)
      expect(result.getMonth()).toBe(1) // February
    })

    it('does not mutate original date', () => {
      const date = new Date('2024-01-15T10:00:00')
      addDays(date, 5)
      expect(date.getDate()).toBe(15)
    })
  })

  describe('calculateDurationSeconds', () => {
    it('calculates duration between two dates', () => {
      const start = new Date('2024-01-15T10:00:00')
      const end = new Date('2024-01-15T10:01:30')
      expect(calculateDurationSeconds(start, end)).toBe(90)
    })

    it('works with date strings', () => {
      expect(
        calculateDurationSeconds('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z')
      ).toBe(3600)
    })

    it('handles reverse order (negative duration)', () => {
      const start = new Date('2024-01-15T11:00:00')
      const end = new Date('2024-01-15T10:00:00')
      expect(calculateDurationSeconds(start, end)).toBe(-3600)
    })
  })
})
