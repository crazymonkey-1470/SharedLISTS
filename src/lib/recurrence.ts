import type { CalEvent } from './types'
import { DAY_MS, allDayDayNumber, dayNumber, dayParts, localDayNumber, isoToDay } from './dates'

export interface Occurrence {
  key: string
  event: CalEvent
  /** Calendar day the occurrence falls on (see dates.dayNumber). */
  day: number
  start: Date
  end: Date | null
}

/**
 * Expands events (including repeating series) into the occurrences that fall on
 * calendar days in [fromDay, toDay). Timed events repeat on the viewer's local
 * wall-clock time; all-day events repeat on their floating calendar date.
 */
export function expandEvents(events: Iterable<CalEvent>, fromDay: number, toDay: number): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of events) expandOne(ev, fromDay, toDay, out)
  out.sort(
    (a, b) =>
      a.day - b.day ||
      Number(b.event.all_day) - Number(a.event.all_day) ||
      a.start.getTime() - b.start.getTime() ||
      a.event.title.localeCompare(b.event.title),
  )
  return out
}

function expandOne(ev: CalEvent, fromDay: number, toDay: number, out: Occurrence[]) {
  const start = new Date(ev.starts_at)
  const durationMs = ev.ends_at ? Date.parse(ev.ends_at) - start.getTime() : null
  const baseDay = ev.all_day ? allDayDayNumber(ev.starts_at) : localDayNumber(start)
  const { y, m, d } = dayParts(baseDay)
  const untilDay = ev.repeat !== 'none' && ev.repeat_until ? isoToDay(ev.repeat_until) : Infinity
  const lastDay = Math.min(toDay - 1, untilDay)

  const emit = (day: number) => {
    let occStart: Date
    if (ev.all_day) {
      occStart = new Date(day * DAY_MS)
    } else {
      const p = dayParts(day)
      occStart = new Date(p.y, p.m, p.d, start.getHours(), start.getMinutes(), start.getSeconds())
    }
    out.push({
      key: `${ev.id}:${day}`,
      event: ev,
      day,
      start: occStart,
      end: durationMs === null ? null : new Date(occStart.getTime() + durationMs),
    })
  }

  switch (ev.repeat) {
    case 'daily':
    case 'weekly': {
      const step = ev.repeat === 'daily' ? 1 : 7
      const skip = baseDay >= fromDay ? 0 : Math.ceil((fromDay - baseDay) / step)
      for (let day = baseDay + skip * step; day <= lastDay; day += step) emit(day)
      return
    }
    case 'monthly':
    case 'yearly': {
      const monthly = ev.repeat === 'monthly'
      const from = dayParts(fromDay)
      // start one period before the range so nothing at its edge is skipped
      let k = monthly ? Math.max(0, (from.y - y) * 12 + (from.m - m) - 1) : Math.max(0, from.y - y - 1)
      for (; ; k++) {
        const ty = monthly ? y : y + k
        const tm = monthly ? m + k : m
        if (dayNumber(ty, tm, 1) > lastDay) return
        const day = dayNumber(ty, tm, d)
        // Skip months that don't have this date (e.g. the 31st, or Feb 29).
        if (dayParts(day).d !== d) continue
        if (day > lastDay) return
        if (day >= fromDay) emit(day)
      }
    }
    default:
      if (baseDay >= fromDay && baseDay < toDay) emit(baseDay)
  }
}

export const repeatNoun: Record<CalEvent['repeat'], string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}
