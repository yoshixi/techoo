/**
 * Tests for time conversion utilities used in calendar drag-to-create
 */

const SLOT_MINUTES = 15

// These are the same conversion functions used in DayColumn
function yToMinutes(y: number, hourHeight: number): number {
  const minutesPerPixel = 60 / hourHeight
  const totalMinutes = y * minutesPerPixel
  // Snap to 15-minute increments
  return Math.round(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES
}

function minutesToDate(minutes: number, date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  result.setMinutes(minutes)
  return result
}

describe('Calendar time conversion utilities', () => {
  const HOUR_HEIGHT = 60 // Same as in CalendarView

  describe('yToMinutes', () => {
    it('converts 0 y-position to 0 minutes (midnight)', () => {
      expect(yToMinutes(0, HOUR_HEIGHT)).toBe(0)
    })

    it('converts y-position to correct minutes for 1 hour (60px)', () => {
      expect(yToMinutes(60, HOUR_HEIGHT)).toBe(60)
    })

    it('converts y-position to correct minutes for 6 hours (360px)', () => {
      expect(yToMinutes(360, HOUR_HEIGHT)).toBe(360)
    })

    it('snaps to 15-minute increments', () => {
      // 7 minutes should snap to 0
      expect(yToMinutes(7, HOUR_HEIGHT)).toBe(0)

      // 8 minutes should snap to 15
      expect(yToMinutes(8, HOUR_HEIGHT)).toBe(15)

      // 22 minutes should snap to 15
      expect(yToMinutes(22, HOUR_HEIGHT)).toBe(15)

      // 23 minutes should snap to 30
      expect(yToMinutes(23, HOUR_HEIGHT)).toBe(30)
    })

    it('handles 30px correctly (30 minutes)', () => {
      expect(yToMinutes(30, HOUR_HEIGHT)).toBe(30)
    })

    it('handles 45px correctly (45 minutes)', () => {
      expect(yToMinutes(45, HOUR_HEIGHT)).toBe(45)
    })

    it('handles noon position (720px)', () => {
      expect(yToMinutes(720, HOUR_HEIGHT)).toBe(720) // 12 hours = 720 minutes
    })

    it('handles end of day position (1440px)', () => {
      expect(yToMinutes(1440, HOUR_HEIGHT)).toBe(1440) // 24 hours = 1440 minutes
    })
  })

  describe('minutesToDate', () => {
    const baseDate = new Date('2026-01-17T12:30:00')

    it('creates a date at midnight for 0 minutes', () => {
      const result = minutesToDate(0, baseDate)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getDate()).toBe(17)
    })

    it('creates correct time for 60 minutes (1 AM)', () => {
      const result = minutesToDate(60, baseDate)
      expect(result.getHours()).toBe(1)
      expect(result.getMinutes()).toBe(0)
    })

    it('creates correct time for 90 minutes (1:30 AM)', () => {
      const result = minutesToDate(90, baseDate)
      expect(result.getHours()).toBe(1)
      expect(result.getMinutes()).toBe(30)
    })

    it('creates correct time for 720 minutes (noon)', () => {
      const result = minutesToDate(720, baseDate)
      expect(result.getHours()).toBe(12)
      expect(result.getMinutes()).toBe(0)
    })

    it('creates correct time for 1020 minutes (5 PM)', () => {
      const result = minutesToDate(1020, baseDate)
      expect(result.getHours()).toBe(17)
      expect(result.getMinutes()).toBe(0)
    })

    it('preserves the date from the original date', () => {
      const result = minutesToDate(600, baseDate)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(17)
    })

    it('resets seconds and milliseconds to zero', () => {
      const result = minutesToDate(600, baseDate)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
    })
  })

  describe('drag selection calculation', () => {
    it('calculates correct time range for morning selection', () => {
      // Simulate dragging from 9:00 AM (540px) to 10:30 AM (630px)
      const startY = 540
      const endY = 630

      const startMinutes = yToMinutes(startY, HOUR_HEIGHT)
      const endMinutes = yToMinutes(endY, HOUR_HEIGHT)

      expect(startMinutes).toBe(540) // 9:00 AM
      expect(endMinutes).toBe(630) // 10:30 AM
    })

    it('handles reverse selection (dragging upward)', () => {
      // Simulate dragging from 10:30 AM (630px) to 9:00 AM (540px)
      const startY = 630
      const endY = 540

      const startMinutes = yToMinutes(startY, HOUR_HEIGHT)
      const endMinutes = yToMinutes(endY, HOUR_HEIGHT)

      // In actual implementation, we take min/max to handle reverse
      const minMinutes = Math.min(startMinutes, endMinutes)
      const maxMinutes = Math.max(startMinutes, endMinutes)

      expect(minMinutes).toBe(540) // 9:00 AM
      expect(maxMinutes).toBe(630) // 10:30 AM
    })

    it('ensures minimum 15-minute duration', () => {
      // Simulate tapping at 9:00 AM (no drag)
      const startY = 540
      const endY = 540

      const startMinutes = yToMinutes(startY, HOUR_HEIGHT)
      const endMinutes = yToMinutes(endY, HOUR_HEIGHT)

      const minMinutes = Math.min(startMinutes, endMinutes)
      const maxMinutes = Math.max(startMinutes, endMinutes)

      // Ensure minimum duration of SLOT_MINUTES
      const actualEnd = maxMinutes <= minMinutes ? minMinutes + SLOT_MINUTES : maxMinutes

      expect(minMinutes).toBe(540) // 9:00 AM
      expect(actualEnd).toBe(555) // 9:15 AM
    })
  })
})
