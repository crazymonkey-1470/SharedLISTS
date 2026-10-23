import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useData, type EventInput } from '../state/data'
import type { CalEvent, Repeat } from '../lib/types'
import {
  DAY_MS,
  allDayDayNumber,
  allDayIso,
  dayToIso,
  dayToLocalDate,
  formatMonthDay,
  formatWeekday,
  isoToDay,
  localDateAt,
  localDayNumber,
  toTimeInput,
} from '../lib/dates'
import { Button, Field, InlineConfirm, Sheet, Toggle } from './ui'
import { ListIcon } from './icons'

interface Draft {
  title: string
  date: string
  allDay: boolean
  startTime: string
  endTime: string
  repeat: Repeat
  until: string
  notes: string
  listId: string
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function draftFrom(event: CalEvent | null, defaultDay: number): Draft {
  if (!event) {
    const now = new Date()
    const startTime = defaultDay === localDayNumber(now) && now.getHours() < 23 ? `${String(now.getHours() + 1).padStart(2, '0')}:00` : '09:00'
    return { title: '', date: dayToIso(defaultDay), allDay: false, startTime, endTime: addHour(startTime), repeat: 'none', until: '', notes: '', listId: '' }
  }
  const start = new Date(event.starts_at)
  const startTime = event.all_day ? '09:00' : toTimeInput(start)
  return {
    title: event.title,
    date: dayToIso(event.all_day ? allDayDayNumber(event.starts_at) : localDayNumber(start)),
    allDay: event.all_day,
    startTime,
    endTime: !event.all_day && event.ends_at ? toTimeInput(new Date(event.ends_at)) : addHour(startTime),
    repeat: event.repeat,
    until: event.repeat_until ?? '',
    notes: event.notes ?? '',
    listId: event.list_id ?? '',
  }
}

export default function EventSheet({
  event,
  defaultDay,
  onClose,
}: {
  /** The series being edited, or null for a new event. */
  event: CalEvent | null
  defaultDay: number
  onClose: () => void
}) {
  const { lists, saveEvent, deleteEvent, nameOf } = useData()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(event, defaultDay))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const day = draft.date ? isoToDay(draft.date) : null
  const attached = lists.find((l) => l.id === draft.listId) ?? null
  const overnight = !draft.allDay && draft.endTime <= draft.startTime

  const repeatOptions: { value: Repeat; label: string }[] = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: day === null ? 'Every week' : `Every week on ${formatWeekday(day)}` },
    { value: 'monthly', label: day === null ? 'Every month' : `Every month on day ${dayToLocalDate(day).getDate()}` },
    { value: 'yearly', label: day === null ? 'Every year' : `Every year on ${formatMonthDay(day)}` },
  ]

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) return setError('Give the event a title.')
    if (day === null) return setError('Pick a date.')
    if (draft.repeat !== 'none' && draft.until && draft.until < draft.date) return setError('"Repeat until" must be on or after the date.')

    let startsAt: string
    let endsAt: string | null
    if (draft.allDay) {
      startsAt = allDayIso(day)
      endsAt = null
    } else {
      const start = localDateAt(day, draft.startTime)
      let end = localDateAt(day, draft.endTime)
      if (end <= start) end = new Date(end.getTime() + DAY_MS) // ends after midnight
      startsAt = start.toISOString()
      endsAt = end.toISOString()
    }

    const input: EventInput = {
      title: draft.title.trim(),
      notes: draft.notes.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: draft.allDay,
      repeat: draft.repeat,
      repeat_until: draft.repeat === 'none' ? null : draft.until || null,
      list_id: draft.listId || null,
    }
    setBusy(true)
    setError(null)
    const ok = await saveEvent(input, event?.id)
    setBusy(false)
    if (ok) onClose()
  }

  async function onDelete() {
    if (!event) return
    setBusy(true)
    const ok = await deleteEvent(event.id)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Sheet open title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="field text-lg font-semibold"
          autoFocus={!event}
          maxLength={200}
          placeholder="Title"
          aria-label="Title"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
        />

        <Field label="Date">
          <input className="field" type="date" required value={draft.date} onChange={(e) => set('date', e.target.value)} />
        </Field>

        <Toggle label="All day" checked={draft.allDay} onChange={(v) => set('allDay', v)} />

        {!draft.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input
                className="field"
                type="time"
                required
                value={draft.startTime}
                onChange={(e) => {
                  const startTime = e.target.value
                  // keep the duration when moving the start
                  setDraft((d) => ({ ...d, startTime, endTime: d.endTime <= d.startTime ? d.endTime : shift(d.endTime, d.startTime, startTime) }))
                }}
              />
            </Field>
            <Field label="Ends" hint={overnight ? 'Ends the next day' : undefined}>
              <input className="field" type="time" required value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Repeat">
          <select className="field" value={draft.repeat} onChange={(e) => set('repeat', e.target.value as Repeat)}>
            {repeatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        {draft.repeat !== 'none' && (
          <Field label="Repeat until (optional)" hint={event ? 'Changes apply to every occurrence.' : undefined}>
            <div className="flex gap-2">
              <input className="field" type="date" min={draft.date} value={draft.until} onChange={(e) => set('until', e.target.value)} />
              {draft.until && (
                <Button variant="ghost" onClick={() => set('until', '')}>
                  Clear
                </Button>
              )}
            </div>
          </Field>
        )}

        <Field label="Notes">
          <textarea className="field min-h-20 resize-y" rows={3} maxLength={2000} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <Field label="Attach a list">
          <select className="field" value={draft.listId} onChange={(e) => set('listId', e.target.value)}>
            <option value="">None</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        {attached && (
          <button
            type="button"
            onClick={() => navigate(`/lists/${attached.id}`)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-sm font-semibold text-accent"
          >
            <ListIcon size={16} /> Open {attached.name}
          </button>
        )}

        {event && <p className="text-sm text-muted">Added by {nameOf(event.created_by)}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {confirmDelete ? (
          <InlineConfirm
            message={event?.repeat !== 'none' ? 'Delete this event and all its repeats?' : 'Delete this event?'}
            confirmLabel="Delete"
            busy={busy}
            onConfirm={() => void onDelete()}
            onCancel={() => setConfirmDelete(false)}
          />
        ) : (
          <div className="flex gap-2 pt-1">
            {event && (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            <Button variant="secondary" className="ml-auto" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" busy={busy}>
              Save
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  )
}

/** Moves `time` by the same amount `from` moved to `to` (all "HH:MM"), wrapping at midnight. */
function shift(time: string, from: string, to: string): string {
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const total = (((mins(time) + mins(to) - mins(from)) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
