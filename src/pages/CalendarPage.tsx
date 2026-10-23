import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../state/data'
import { expandEvents, repeatNoun, type Occurrence } from '../lib/recurrence'
import {
  dayNumber,
  dayParts,
  dayToLocalDate,
  formatDayHeading,
  formatLongDay,
  formatMonthYear,
  formatTime,
  localDayNumber,
  weekdayInitials,
} from '../lib/dates'
import { readLocal, writeLocal } from '../lib/storage'
import type { CalEvent } from '../lib/types'
import EventSheet from '../components/EventSheet'
import { Button, Segmented } from '../components/ui'
import { ChevronLeftIcon, ChevronRightIcon, ListIcon, PlusIcon, RepeatIcon } from '../components/icons'

type View = 'upcoming' | 'month'
const UPCOMING_DAYS = 30
const VIEW_KEY = 'osl.calendarView'

function useToday(): number {
  const [today, setToday] = useState(() => localDayNumber(new Date()))
  useEffect(() => {
    const tick = () => setToday(localDayNumber(new Date()))
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

type SheetState = { event: CalEvent | null; day: number } | null

export default function CalendarPage() {
  const { events, setEventsRange } = useData()
  const today = useToday()
  const [view, setView] = useState<View>(() => {
    const saved = readLocal(VIEW_KEY)
    if (saved === 'upcoming' || saved === 'month') return saved
    return window.matchMedia('(min-width: 768px)').matches ? 'month' : 'upcoming'
  })
  const [month, setMonth] = useState(() => {
    const { y, m } = dayParts(today)
    return { y, m }
  })
  const [selected, setSelected] = useState(today)
  const [sheet, setSheet] = useState<SheetState>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const gridStart = useMemo(() => {
    const first = dayNumber(month.y, month.m, 1)
    return first - dayToLocalDate(first).getDay()
  }, [month])

  const [from, to] = view === 'upcoming' ? [today, today + UPCOMING_DAYS + 1] : [gridStart, gridStart + 42]

  useEffect(() => {
    setEventsRange(from, to)
  }, [from, to, setEventsRange])

  const byDay = useMemo(() => {
    const map = new Map<number, Occurrence[]>()
    for (const occ of expandEvents(events, from, to)) {
      const list = map.get(occ.day)
      if (list) list.push(occ)
      else map.set(occ.day, [occ])
    }
    return map
  }, [events, from, to])

  function changeView(v: View) {
    setView(v)
    writeLocal(VIEW_KEY, v)
  }

  function goToday() {
    const { y, m } = dayParts(today)
    setMonth({ y, m })
    setSelected(today)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function shiftMonth(delta: number) {
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const openEvent = useCallback((event: CalEvent) => setSheet({ event, day: today }), [today])
  const newEventDay = view === 'month' ? selected : today

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <Segmented
          label="Calendar view"
          value={view}
          onChange={changeView}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <Button variant="ghost" onClick={goToday} className="ml-auto px-3">
          Today
        </Button>
        <Button variant="primary" onClick={() => setSheet({ event: null, day: newEventDay })} aria-label="Add event" className="px-3">
          <PlusIcon /> <span className="hidden sm:inline">Event</span>
        </Button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {view === 'upcoming' ? (
          <Upcoming byDay={byDay} today={today} onOpen={openEvent} onAdd={() => setSheet({ event: null, day: today })} />
        ) : (
          <MonthView
            month={month}
            gridStart={gridStart}
            today={today}
            selected={selected}
            byDay={byDay}
            onSelect={setSelected}
            onShift={shiftMonth}
            onOpen={openEvent}
            onAdd={() => setSheet({ event: null, day: selected })}
          />
        )}
      </div>

      {sheet && <EventSheet event={sheet.event} defaultDay={sheet.day} onClose={() => setSheet(null)} />}
    </div>
  )
}

function Upcoming({
  byDay,
  today,
  onOpen,
  onAdd,
}: {
  byDay: Map<number, Occurrence[]>
  today: number
  onOpen: (e: CalEvent) => void
  onAdd: () => void
}) {
  const days = [...byDay.keys()].sort((a, b) => a - b)
  if (!days.length) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-lg font-semibold">Nothing in the next {UPCOMING_DAYS} days</p>
        <p className="mt-1 text-[15px] text-muted">Add birthdays, appointments, bin night…</p>
        <Button variant="primary" className="mt-5" onClick={onAdd}>
          <PlusIcon size={18} /> Add an event
        </Button>
      </div>
    )
  }
  return (
    <div className="pb-6">
      {days.map((day) => (
        <section key={day}>
          <h3 className={`sticky top-0 z-10 bg-bg/95 px-4 pt-4 pb-2 text-sm font-semibold backdrop-blur ${day === today ? 'text-accent' : 'text-muted'}`}>
            {formatDayHeading(day, today)}
          </h3>
          <ul className="space-y-2 px-3">
            {byDay.get(day)!.map((occ) => (
              <OccurrenceRow key={occ.key} occ={occ} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function MonthView({
  month,
  gridStart,
  today,
  selected,
  byDay,
  onSelect,
  onShift,
  onOpen,
  onAdd,
}: {
  month: { y: number; m: number }
  gridStart: number
  today: number
  selected: number
  byDay: Map<number, Occurrence[]>
  onSelect: (day: number) => void
  onShift: (delta: number) => void
  onOpen: (e: CalEvent) => void
  onAdd: () => void
}) {
  const cells = Array.from({ length: 42 }, (_, i) => gridStart + i)
  const selectedOccs = byDay.get(selected) ?? []
  const selectedInGrid = selected >= gridStart && selected < gridStart + 42

  return (
    <div className="pb-6">
      <div className="flex items-center px-2 pt-3 pb-1">
        <button aria-label="Previous month" onClick={() => onShift(-1)} className="grid size-11 place-items-center rounded-full hover:bg-surface-2">
          <ChevronLeftIcon />
        </button>
        <h2 className="flex-1 text-center text-lg font-semibold">{formatMonthYear(month.y, month.m)}</h2>
        <button aria-label="Next month" onClick={() => onShift(1)} className="grid size-11 place-items-center rounded-full hover:bg-surface-2">
          <ChevronRightIcon />
        </button>
      </div>
      <div className="grid grid-cols-7 px-2 text-center text-xs font-semibold text-muted">
        {weekdayInitials.map((w, i) => (
          <div key={i} className="py-1.5">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 px-2" role="grid">
        {cells.map((day) => {
          const { m, d } = dayParts(day)
          const inMonth = m === month.m
          const isToday = day === today
          const isSelected = day === selected
          const count = byDay.get(day)?.length ?? 0
          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              aria-label={`${formatLongDay(day)}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ''}`}
              aria-pressed={isSelected}
              className="flex h-14 flex-col items-center justify-start gap-1 rounded-xl pt-1.5"
            >
              <span
                className={`grid size-8 place-items-center rounded-full text-[15px] font-semibold ${
                  isSelected ? 'bg-accent text-accent-fg' : isToday ? 'text-accent ring-2 ring-accent' : inMonth ? 'text-fg' : 'text-muted/50'
                }`}
              >
                {d}
              </span>
              <span className="flex h-1.5 gap-0.5">
                {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                  <span key={i} className={`size-1.5 rounded-full ${inMonth ? 'bg-accent' : 'bg-muted/40'}`} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selectedInGrid && (
        <section className="mt-3 border-t border-line pt-3">
          <div className="flex items-center justify-between px-4 pb-2">
            <h3 className="text-sm font-semibold text-muted">{formatDayHeading(selected, today)}</h3>
            <button onClick={onAdd} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-accent-soft">
              <PlusIcon size={16} /> Add
            </button>
          </div>
          {selectedOccs.length ? (
            <ul className="space-y-2 px-3">
              {selectedOccs.map((occ) => (
                <OccurrenceRow key={occ.key} occ={occ} onOpen={onOpen} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-[15px] text-muted">No events.</p>
          )}
        </section>
      )}
    </div>
  )
}

function OccurrenceRow({ occ, onOpen }: { occ: Occurrence; onOpen: (e: CalEvent) => void }) {
  const { lists, nameOf } = useData()
  const navigate = useNavigate()
  const ev = occ.event
  const list = ev.list_id ? lists.find((l) => l.id === ev.list_id) : undefined
  const past = !ev.all_day && (occ.end ?? occ.start).getTime() < Date.now()

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(ev)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onOpen(ev)
          }
        }}
        className={`flex cursor-pointer gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line transition active:bg-surface-2 ${past ? 'opacity-60' : ''}`}
      >
        <div className="w-16 shrink-0 pt-0.5 text-sm font-semibold">
          {ev.all_day ? (
            <span className="text-accent">All day</span>
          ) : (
            <>
              <div>{formatTime(occ.start)}</div>
              {occ.end && <div className="font-normal text-muted">{formatTime(occ.end)}</div>}
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-snug font-semibold break-words">{ev.title}</p>
          {ev.notes && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{ev.notes}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
            {ev.repeat !== 'none' && (
              <span className="inline-flex items-center gap-1">
                <RepeatIcon size={13} /> {repeatNoun[ev.repeat]}
              </span>
            )}
            {list && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/lists/${list.id}`)
                }}
                className="inline-flex min-h-7 items-center gap-1 rounded-full bg-accent-soft px-2.5 font-semibold text-accent"
              >
                <ListIcon size={13} /> {list.name}
              </button>
            )}
            <span>Added by {nameOf(ev.created_by)}</span>
          </div>
        </div>
      </div>
    </li>
  )
}
