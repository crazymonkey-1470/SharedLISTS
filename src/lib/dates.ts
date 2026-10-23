export const DAY_MS = 86_400_000

/** Calendar day number (days since 1970-01-01) for a y/m/d, independent of time zone. */
export function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m, d) / DAY_MS)
}

/** Day number of the viewer's local calendar date for an instant. */
export function localDayNumber(date: Date): number {
  return dayNumber(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dayParts(day: number): { y: number; m: number; d: number } {
  const u = new Date(day * DAY_MS)
  return { y: u.getUTCFullYear(), m: u.getUTCMonth(), d: u.getUTCDate() }
}

/** Local midnight Date for a day number (for formatting and weekday lookups). */
export function dayToLocalDate(day: number): Date {
  const { y, m, d } = dayParts(day)
  return new Date(y, m, d)
}

/** "YYYY-MM-DD" for <input type="date"> and the repeat_until column. */
export function dayToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function isoToDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return dayNumber(y, m - 1, d)
}

export function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Local Date on a given calendar day at "HH:MM". */
export function localDateAt(day: number, time: string): Date {
  const { y, m, d } = dayParts(day)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m, d, hh || 0, mm || 0)
}

// All-day events are stored at UTC midnight of their date and read back with
// UTC getters, so everyone sees the same calendar date in any time zone.
export function allDayIso(day: number): string {
  return new Date(day * DAY_MS).toISOString()
}

export function allDayDayNumber(iso: string): number {
  return Math.floor(Date.parse(iso) / DAY_MS)
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const weekdayDateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const longDateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const monthYearFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const narrowWeekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })

export const formatTime = (date: Date) => timeFmt.format(date)
export const formatMonthYear = (y: number, m: number) => monthYearFmt.format(new Date(y, m, 1))
export const formatShortDate = (date: Date) => shortDateFmt.format(date)
export const formatWeekday = (day: number) => weekdayFmt.format(dayToLocalDate(day))
export const formatMonthDay = (day: number) => monthDayFmt.format(dayToLocalDate(day))
export const formatLongDay = (day: number) => longDateFmt.format(dayToLocalDate(day))

export function formatDayHeading(day: number, today: number): string {
  if (day === today) return `Today · ${weekdayDateFmt.format(dayToLocalDate(day))}`
  if (day === today + 1) return `Tomorrow · ${weekdayDateFmt.format(dayToLocalDate(day))}`
  return weekdayDateFmt.format(dayToLocalDate(day))
}

/** Narrow weekday labels starting on Sunday (S M T W T F S in English). */
export const weekdayInitials: string[] = Array.from({ length: 7 }, (_, i) =>
  narrowWeekdayFmt.format(new Date(2026, 0, 4 + i)),
)
