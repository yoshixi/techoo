/** Start of local calendar day (00:00). */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Local calendar day as [start, endExclusive) instants (half-open range for API `from` / `to`).
 */
export function dayBoundsLocal(d: Date): { start: Date; endExclusive: Date } {
  const start = startOfLocalDay(d)
  const endExclusive = new Date(start)
  endExclusive.setDate(endExclusive.getDate() + 1)
  return { start, endExclusive }
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Sunday-start week containing `anchor`. */
export function startOfWeekSunday(anchor: Date): Date {
  const s = startOfLocalDay(anchor)
  const day = s.getDay()
  s.setDate(s.getDate() - day)
  return s
}
